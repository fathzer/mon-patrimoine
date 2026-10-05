import { EventBus } from './EventBus.js';
import { compareDates, recordAt, resolveAt } from './DatedHistory.js';
import { Household } from '../fiscality/Household.js';
import type { HouseholdData } from '../fiscality/Household.js';
import { PlacementFactory } from '../placements/PlacementFactory.js';
import type { BasePlacement, PlacementData, Evaluation } from '../placements/BasePlacement.js';
import type { FiscalProfile } from '../fiscality/TaxCalculator.js';
import type { StorageManager } from '../storage/StorageManager.js';

export interface EvaluationEntry {
  instance: BasePlacement;
  evaluation: Evaluation & { netValue: number };
}

export interface BreakdownEntry {
  gross: number;
  percentage: number;
}

export interface GlobalSummary {
  isAuthenticated: boolean;
  totalGross?: number;
  finalNetValue?: number;
  categories?: string[];
  breakdown?: Record<string, BreakdownEntry>;
  evaluations?: EvaluationEntry[];
}

export interface TaxProfileHistoryEntry {
  /** Date from which this profile applies (YYYY-MM-DD). */
  date: string;
  profile: FiscalProfile;
}

export interface ExportPayload {
  version: string;
  taxProfile: FiscalProfile;
  taxProfileAsOf?: string;
  taxProfileHistory?: TaxProfileHistoryEntry[];
  placements: PlacementData[];
}

export type AppStoreEvents = {
  'state:changed': GlobalSummary;
  'state:loading': boolean;
  'save:error': Error;
  'load:error': Error;
};

export interface TaxProfileInput {
  household?: Household | HouseholdData;
  taxableIncome?: number;
  usePfu?: boolean;
}

export interface AppState {
  isAuthenticated: boolean;
  isLoading: boolean;
  taxProfile: FiscalProfile;
  /** Effective date (YYYY-MM-DD) of the current tax profile. */
  taxProfileAsOf: string;
  /** Past tax profiles, sorted by date (the profile at date D is the last entry with `date <= D`). */
  taxProfileHistory: TaxProfileHistoryEntry[];
  placements: BasePlacement[];
}

/** Sentinel `from` date for the seed profile entry: "applies since forever". */
const PROFILE_HISTORY_START = '1970-01-01';

const todayString = (): string => new Date().toISOString().split('T')[0];

export class AppStore extends EventBus<AppStoreEvents> {
  static readonly DEFAULT_TAX_PROFILE: FiscalProfile = {
    household: new Household(),
    taxableIncome: 0,
    usePfu: true
  };

  storageManager: StorageManager;
  state: AppState;

  constructor(storageManager: StorageManager) {
    super();
    this.storageManager = storageManager;
    this.state = {
      isAuthenticated: false,
      isLoading: true,
      taxProfile: AppStore.DEFAULT_TAX_PROFILE,
      taxProfileAsOf: todayString(),
      taxProfileHistory: [{ date: PROFILE_HISTORY_START, profile: AppStore.DEFAULT_TAX_PROFILE }],
      placements: []
    };
  }

  async init(): Promise<void> {
    this.emit('state:loading', true);
    await this.storageManager.initialize();
    const status = await this.storageManager.getStatus();

    this.state.isAuthenticated = status.isConnected;

    if (this.state.isAuthenticated) {
      let rawData: Partial<ExportPayload> | null = null;
      let loadFailed = false;
      try {
        rawData = await this.storageManager.load() as Partial<ExportPayload> | null;
      } catch (error) {
        console.error('Failed to load data:', error);
        loadFailed = true;
        this.emit('load:error', error as Error);
      }
      // Only create the default file when no file exists yet. On a load failure,
      // the existing file must not be overwritten with empty data.
      if (!rawData && !loadFailed) {
        rawData = this._getDefaultData();
        await this.storageManager.save(rawData);
      }
      if (rawData != null && typeof rawData === 'object') {
        this._hydrateState(rawData);
      }
    }

    this.state.isLoading = false;
    this.emit('state:loading', false);
    this.emit('state:changed', this.getGlobalSummary());
  }

  async login(): Promise<void> {
    const ok = await this.storageManager.authenticate();
    if (ok) await this.init();
  }

  async logout(): Promise<void> {
    await this.storageManager.disconnect();
    this.state.isAuthenticated = false;
    this.state.placements = [];
    this.emit('state:changed', this.getGlobalSummary());
  }

  addPlacement(placementData: PlacementData): void {
    const instance = PlacementFactory.create(placementData);
    this.state.placements.push(instance);
    this._persistAndEmit();
  }

  /**
   * Replaces a placement's current state with `placementData`.
   *
   * When `placementData.asOf` is in the past relative to the previous state,
   * the new evolving values become a history entry at that date (a
   * retroactive correction) and the current evolving values are preserved;
   * absolute fields still apply globally. Otherwise the previous current
   * state is pushed into history at its own `asOf` and the new data becomes
   * the current state.
   */
  updatePlacement(id: string, placementData: PlacementData): void {
    const index = this.state.placements.findIndex(p => p.id === id);
    if (index === -1) {
      return;
    }
    const previous = this.state.placements[index];
    const data = { ...placementData, id };
    const effectiveDate = data.asOf || todayString();
    const instance = PlacementFactory.create(data);

    if (effectiveDate < previous.asOf) {
      const evolvingKeys = Object.keys(instance.getEvolvingValues());
      const previousData = previous.toJSON() as Record<string, unknown>;
      const merged = {
        ...data,
        asOf: previous.asOf,
        closedAt: data.closedAt ?? previous.closedAt,
        history: previous.history
      } as Record<string, unknown>;
      for (const key of evolvingKeys) {
        merged[key] = previousData[key];
      }
      const corrected = PlacementFactory.create(merged as PlacementData);
      corrected.insertHistoryEntry(effectiveDate, instance.getEvolvingValues());
      this.state.placements[index] = corrected;
    } else {
      instance.recordState(previous, effectiveDate);
      this.state.placements[index] = instance;
    }
    this._persistAndEmit();
  }

  /**
   * Marks a placement as closed at `closedAt` (default: today). The placement
   * and its history are preserved; it is excluded from the current summary
   * and resolves to no state after the closure date.
   */
  closePlacement(id: string, closedAt: string = todayString()): void {
    const placement = this.state.placements.find(p => p.id === id);
    if (placement) {
      placement.closedAt = closedAt;
      this._persistAndEmit();
    }
  }

  deletePlacement(id: string): void {
    this.state.placements = this.state.placements.filter(p => p.id !== id);
    this._persistAndEmit();
  }

  getExportPayload(): ExportPayload {
    return {
      version: "1.1",
      taxProfile: this.state.taxProfile,
      taxProfileAsOf: this.state.taxProfileAsOf,
      taxProfileHistory: this.state.taxProfileHistory,
      placements: this.state.placements.map(p => p.toJSON())
    };
  }

  _persistAndEmit(): void {
    const payload = this.getExportPayload();
    this.storageManager.save(payload)
      .then((ok: boolean) => {
        if (!ok) throw new Error('Storage reported a failed save');
        console.log('Data successfully saved:', payload);
      })
      .catch((error: Error) => {
        console.error('Failed to save data:', error);
        this.emit('save:error', error);
      });
    const globalSummary = this.getGlobalSummary();
    console.log('Emitting state:changed with:', globalSummary);
    this.emit('state:changed', globalSummary);
  }

  _hydrateState(rawData: Partial<ExportPayload>): void {
    this.state.taxProfile = this._normalizeTaxProfile(rawData.taxProfile);
    this.state.taxProfileAsOf = rawData.taxProfileAsOf || todayString();
    // Migration from 1.0 payloads: seed the history so that the current
    // profile applies to every date before the first recorded change.
    this.state.taxProfileHistory = (Array.isArray(rawData.taxProfileHistory) && rawData.taxProfileHistory.length > 0)
      ? rawData.taxProfileHistory
          .map(e => ({ date: String(e.date), profile: this._normalizeTaxProfile(e.profile) }))
          .sort((a, b) => compareDates(a.date, b.date))
      : [{ date: PROFILE_HISTORY_START, profile: this.state.taxProfile }];
    this.state.placements = (Array.isArray(rawData.placements) ? rawData.placements : [])
      .map(pData => PlacementFactory.create(pData));
  }

  _normalizeTaxProfile(taxProfile: TaxProfileInput = {}): FiscalProfile {
    const current = this.getTaxProfile();
    const household = taxProfile.household ?? current.household;
    const taxableIncome = Number.isFinite(taxProfile.taxableIncome) ? taxProfile.taxableIncome! : current.taxableIncome;
    const usePfu = typeof taxProfile.usePfu === 'boolean' ? taxProfile.usePfu : current.usePfu;

    return {
      household: Household.from(household as HouseholdData),
      taxableIncome,
      usePfu
    };
  }

  getGlobalSummary(): GlobalSummary {
    if (!this.state.isAuthenticated) {
      return { isAuthenticated: false };
    }

    const now = new Date();
    let totalGross = 0;
    let totalNet = 0;
    const breakdown: Record<string, BreakdownEntry> = {};
    const categoriesSet = new Set<string>();

    const evaluations: EvaluationEntry[] = this.state.placements
      .filter(p => p.closedAt == null || p.closedAt >= todayString())
      .map(placement => {
        const evaluation = placement.getEvaluation(this.state.taxProfile, now);
        const netValue = (evaluation.netValueBeforeIR ?? 0) - (evaluation.imposition ?? 0);
        totalGross += evaluation.grossValue;
        totalNet += netValue;

        const cat = placement.getCategory();
        categoriesSet.add(cat);
        if (!breakdown[cat]) breakdown[cat] = { gross: 0, percentage: 0 };
        breakdown[cat].gross += evaluation.grossValue;

        return { instance: placement, evaluation: { ...evaluation, netValue } };
      });

    Object.keys(breakdown).forEach(cat => {
      breakdown[cat].percentage = totalGross > 0
        ? Math.round((breakdown[cat].gross / totalGross) * 10000) / 100
        : 0;
    });

    return {
      isAuthenticated: true,
      totalGross,
      finalNetValue: totalNet,
      categories: Array.from(categoriesSet),
      breakdown,
      evaluations
    };
  }

  getTaxProfile(): FiscalProfile {
    return this.state.taxProfile;
  }

  /**
   * Returns the tax profile effective at `date`: the last entry with
   * `from <= date` — history entries plus the current profile, which acts as
   * an implicit last entry at `taxProfileAsOf`. The earliest entry applies
   * when `date` precedes all of them.
   */
  getTaxProfileAt(date: string): FiscalProfile {
    const entries = [
      ...this.state.taxProfileHistory,
      { date: this.state.taxProfileAsOf, profile: this.state.taxProfile }
    ].sort((a, b) => compareDates(a.date, b.date));
    return (resolveAt(entries, date) ?? entries[0]).profile;
  }

  /**
   * Replaces the current tax profile. `asOf` is the effective date of the new
   * profile (default: today). When the profile actually changed, the previous
   * one is pushed into `taxProfileHistory` at its own `asOf`. An `asOf` in the
   * past records the new profile as a history entry instead (a retroactive
   * correction), leaving the current profile untouched.
   */
  updateTaxProfile(newTaxProfile: TaxProfileInput, asOf?: string): void {
    const effectiveDate = asOf || todayString();
    const normalized = this._normalizeTaxProfile(newTaxProfile);

    if (effectiveDate < this.state.taxProfileAsOf) {
      this.state.taxProfileHistory = recordAt(
        this.state.taxProfileHistory,
        { date: effectiveDate, profile: normalized }
      );
    } else {
      if (effectiveDate > this.state.taxProfileAsOf
        && JSON.stringify(this.state.taxProfile) !== JSON.stringify(normalized)) {
        this.state.taxProfileHistory = recordAt(
          this.state.taxProfileHistory,
          { date: this.state.taxProfileAsOf, profile: this.state.taxProfile }
        );
      }
      this.state.taxProfile = normalized;
      this.state.taxProfileAsOf = effectiveDate;
    }

    this._persistAndEmit();
  }

  importData(rawData: Partial<ExportPayload>): void {
    this._hydrateState(rawData);
    this._persistAndEmit();
  }

  _getDefaultData(): ExportPayload {
    return {
      version: "1.1",
      taxProfile: AppStore.DEFAULT_TAX_PROFILE,
      taxProfileAsOf: todayString(),
      taxProfileHistory: [{ date: PROFILE_HISTORY_START, profile: AppStore.DEFAULT_TAX_PROFILE }],
      placements: []
    };
  }
}
