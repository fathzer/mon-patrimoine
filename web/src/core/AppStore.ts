import { EventBus } from './EventBus.js';
import { compareDates, todayString } from './DatedHistory.js';
import { Household } from '../fiscality/Household.js';
import type { HouseholdData } from '../fiscality/Household.js';
import { PlacementFactory } from '../placements/PlacementFactory.js';
import type { BasePlacement, PlacementData, Evaluation } from '../placements/BasePlacement.js';
import type { FiscalProfile } from '../fiscality/TaxCalculator.js';
import type { StorageManager } from '../storage/StorageManager.js';
import { DemoProvider } from '../storage/DemoProvider.js';

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
  /** View date (YYYY-MM-DD) when this summary is a historical reconstruction. */
  asOfDate?: string;
  totalGross?: number;
  finalNetValue?: number;
  categories?: string[];
  breakdown?: Record<string, BreakdownEntry>;
  evaluations?: EvaluationEntry[];
  /**
   * Presentation-only multiplier applied to displayed amounts (asset list,
   * totals, breakdown) to express them in current euros. Defaults to 1
   * (nominal euros of the time). Never affects stored values or calculations.
   */
  priceLevelFactor?: number;
  /** Latest published month of the selected inflation series, when known. */
  priceLevelBaseMonth?: string;
}

export interface TaxProfileHistoryEntry {
  /** Income year this profile applies to (and later years until the next entry). */
  year: number;
  profile: FiscalProfile;
}

/**
 * The tax profile as a dated entity — the same (state, asOf, history) triplet
 * as a placement, but keyed by income year: a tax profile describes a whole
 * income year (one declaration per year), so no finer granularity applies.
 * The state stays nested under `profile` so `FiscalProfile` remains a plain
 * value shared with the tax calculator, forms and tests.
 */
export interface TaxProfileEntity {
  profile: FiscalProfile;
  /** Income year `profile` was recorded for. */
  year?: number;
  /** Past profiles, sorted by `year`; omitted while empty. */
  history?: TaxProfileHistoryEntry[];
}

/** Format-1.1 profile entity — entry dates fold into income years on load. */
interface LegacyTaxProfileEntity {
  profile: FiscalProfile;
  asOf?: string;
  history?: { date: string; profile: FiscalProfile }[];
}

/** A user comment pinned to a date, shown as a marker on the history chart. */
export interface ChartAnnotation {
  date: string;
  text: string;
}

export interface ExportPayload {
  version: string;
  /** 1.2 payloads nest a year-keyed TaxProfileEntity; a 1.1 dated entity or a bare FiscalProfile (1.0) is accepted on load. */
  taxProfile: FiscalProfile | TaxProfileEntity | LegacyTaxProfileEntity;
  placements: PlacementData[];
  /** User annotations on the history chart — omitted while empty. */
  annotations?: ChartAnnotation[];
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

/** The income year of an ISO date (YYYY-MM-DD). */
function yearOf(date: string): number {
  return Number.parseInt(date.slice(0, 4), 10);
}

/** recordAt() for year-keyed entries — a year appears at most once. */
function recordYearEntry(
  entries: readonly TaxProfileHistoryEntry[],
  entry: TaxProfileHistoryEntry
): TaxProfileHistoryEntry[] {
  const rest = entries.filter(e => e.year !== entry.year);
  rest.push(entry);
  return rest.sort((a, b) => a.year - b.year);
}

export interface AppState {
  isAuthenticated: boolean;
  isLoading: boolean;
  taxProfile: FiscalProfile;
  /** Income year the current tax profile was recorded for. */
  taxProfileYear: number;
  /** Past tax profiles, sorted by year (the profile for year Y is the last entry with `year <= Y`). */
  taxProfileHistory: TaxProfileHistoryEntry[];
  placements: BasePlacement[];
  /** User annotations on the history chart, sorted by date (one per date). */
  annotations: ChartAnnotation[];
}

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
      taxProfileYear: new Date().getFullYear(),
      taxProfileHistory: [],
      placements: [],
      annotations: []
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

  /**
   * Enters demo mode: swaps in the read-only Gist-backed provider, then
   * runs the regular init flow. Nothing is persisted; a page reload
   * restores the demo data.
   */
  async loginDemo(): Promise<void> {
    this.storageManager.useProvider(new DemoProvider());
    await this.init();
  }

  async logout(): Promise<void> {
    await this.storageManager.disconnect();
    // Leaving demo mode must not leak its provider into the next login.
    this.storageManager.restoreDefaultProvider();
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
      // previousData first: serialized fields absent from the form payload
      // (nested histories — priceHistory, sharesHistory...) must survive a
      // retroactive save. Evolving keys are then restored to the previous
      // current values — the retro save only writes a history entry.
      const merged = {
        ...previousData,
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
      // closedAt is a global field: a payload that omits it keeps the
      // previous value, while an explicit null reopens the placement.
      if (data.closedAt === undefined) {
        instance.closedAt = previous.closedAt;
      }
      instance.recordState(previous, effectiveDate);
      this.state.placements[index] = instance;
    }
    this._persistAndEmit();
  }

  /**
   * Marks a placement as closed at `closedAt` (default: today). The placement
   * and its history are preserved; it is excluded from the current summary
   * and resolves to no state after the closure date.
   * Pass null to reopen a placement that was closed by mistake.
   */
  closePlacement(id: string, closedAt: string | null = todayString()): void {
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

  /**
   * Deletes the state recorded at `date` on a placement — the undo path
   * for a wrong entry. Deleting the current point (asOf) rolls the
   * placement back to its previous recorded state.
   */
  deleteStateAt(id: string, date: string): void {
    const placement = this.state.placements.find(p => p.id === id);
    if (!placement) {
      return;
    }
    if (date === placement.asOf) {
      placement.deleteCurrentState();
    } else {
      placement.deleteHistoryEntry(date);
    }
    this._persistAndEmit();
  }

  getExportPayload(): ExportPayload {
    return {
      version: "1.2",
      taxProfile: {
        profile: this.state.taxProfile,
        year: this.state.taxProfileYear,
        // Omitted while empty, like the placements' `history`: a history with
        // no recorded change adds nothing to the serialized payload.
        ...(this.state.taxProfileHistory.length > 0
          ? { history: this.state.taxProfileHistory }
          : {})
      },
      placements: this.state.placements.map(p => p.toJSON()),
      // Omitted while empty, like the placements' `history`.
      ...(this.state.annotations.length > 0 ? { annotations: this.state.annotations } : {})
    };
  }

  /**
   * Upserts the annotation at `date` — a single annotation per date keeps the
   * chart markers unambiguous. An empty text removes the annotation.
   */
  setAnnotation(date: string, text: string): void {
    const trimmed = text.trim();
    this.state.annotations = this.state.annotations.filter(a => a.date !== date);
    if (trimmed) {
      this.state.annotations.push({ date, text: trimmed });
      this.state.annotations.sort((a, b) => compareDates(a.date, b.date));
    }
    this._persistAndEmit();
  }

  removeAnnotation(date: string): void {
    this.state.annotations = this.state.annotations.filter(a => a.date !== date);
    this._persistAndEmit();
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
    // 1.2 nests the year-keyed profile entity ({profile, year, history});
    // 1.1 stored it by date ({asOf, history[].date}) — dates fold into their
    // income year, the last entry of a same-year group wins; 1.0 stores the
    // bare profile. getTaxProfileForYear falls back to the earliest entry
    // for years preceding every recorded point.
    const entity = rawData.taxProfile != null && 'profile' in rawData.taxProfile
      ? rawData.taxProfile as TaxProfileEntity | LegacyTaxProfileEntity
      : { profile: rawData.taxProfile as FiscalProfile } as TaxProfileEntity;
    this.state.taxProfile = this._normalizeTaxProfile(entity.profile);
    const currentYear = new Date().getFullYear();
    const recordedYear = ('year' in entity && entity.year != null ? entity.year : undefined)
      ?? ('asOf' in entity && entity.asOf ? yearOf(entity.asOf) : undefined)
      ?? currentYear;
    this.state.taxProfileYear = Math.min(recordedYear, currentYear);
    const entries = Array.isArray(entity.history)
      ? entity.history
          .map(e => ({
            year: 'year' in e && e.year != null ? e.year : yearOf((e as { date: string }).date),
            sortKey: 'date' in e ? (e as { date: string }).date : `${'year' in e ? e.year : 0}-01-01`,
            profile: this._normalizeTaxProfile(e.profile)
          }))
          .sort((a, b) => compareDates(a.sortKey, b.sortKey))
      : [];
    // One profile per year: entries of the same year keep the latest record,
    // and the current point owns its own year (a 1.1 history entry folded
    // into the current year drops silently).
    const byYear = new Map<number, FiscalProfile>();
    for (const e of entries) {
      byYear.set(e.year, e.profile);
    }
    this.state.taxProfileHistory = [...byYear.entries()]
      .map(([year, profile]) => ({ year, profile }))
      .filter(e => e.year < this.state.taxProfileYear)
      .sort((a, b) => a.year - b.year);
    this.state.placements = (Array.isArray(rawData.placements) ? rawData.placements : [])
      .map(pData => PlacementFactory.create(pData));
    this.state.annotations = (Array.isArray(rawData.annotations) ? rawData.annotations : [])
      .filter(a => a && typeof a.date === 'string' && typeof a.text === 'string' && a.text.trim())
      .map(a => ({ date: a.date, text: a.text.trim() }))
      .sort((a, b) => compareDates(a.date, b.date));
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
    return this._buildSummary(null);
  }

  /**
   * Builds the summary at a view date. `viewDate === null` means the current
   * view (live instances, current tax profile); otherwise every placement is
   * reconstructed via `getDataAt(viewDate)` and evaluated with the tax
   * profile effective at that date. Placements without a state at the view
   * date (closed, or not yet tracked) are absent from `evaluations` — the UI
   * derives them as `state.placements` minus the evaluated ids.
   */
  getSummaryAt(viewDate: string | null): GlobalSummary {
    return this._buildSummary(viewDate);
  }

  _buildSummary(viewDate: string | null): GlobalSummary {
    if (!this.state.isAuthenticated) {
      return { isAuthenticated: false };
    }

    const effectiveDate = viewDate ?? todayString();
    const now = viewDate == null ? new Date() : new Date(`${viewDate}T12:00:00`);
    const profile = viewDate == null ? this.state.taxProfile : this.getTaxProfileAt(viewDate);
    let totalGross = 0;
    let totalNet = 0;
    const breakdown: Record<string, BreakdownEntry> = {};
    const categoriesSet = new Set<string>();
    const evaluations: EvaluationEntry[] = [];

    for (const placement of this.state.placements) {
      const instance = this._resolveInstanceAt(placement, viewDate, effectiveDate);
      if (instance == null) continue;
      const evaluation = instance.getEvaluation(profile, now);
      const netValue = (evaluation.netValueBeforeIR ?? 0) - (evaluation.imposition ?? 0);
      totalGross += evaluation.grossValue;
      totalNet += netValue;

      const cat = instance.getCategory();
      categoriesSet.add(cat);
      if (!breakdown[cat]) breakdown[cat] = { gross: 0, percentage: 0 };
      breakdown[cat].gross += evaluation.grossValue;

      evaluations.push({ instance, evaluation: { ...evaluation, netValue } });
    }

    Object.keys(breakdown).forEach(cat => {
      breakdown[cat].percentage = totalGross > 0
        ? Math.round((breakdown[cat].gross / totalGross) * 10000) / 100
        : 0;
    });

    return {
      isAuthenticated: true,
      ...(viewDate != null ? { asOfDate: viewDate } : {}),
      totalGross,
      finalNetValue: totalNet,
      categories: Array.from(categoriesSet),
      breakdown,
      evaluations
    };
  }

  /**
   * The instance contributing to a summary: the live placement in the current
   * view (same exclusion rule as history mode — closed from `effectiveDate`
   * onward, the closure day included), or a reconstruction of the state at
   * `viewDate` in history mode. Null when the placement has no state at
   * that date.
   */
  _resolveInstanceAt(placement: BasePlacement, viewDate: string | null, effectiveDate: string): BasePlacement | null {
    if (viewDate == null) {
      return placement.closedAt == null || placement.closedAt > effectiveDate ? placement : null;
    }
    const data = placement.getDataAt(effectiveDate);
    return data == null ? null : PlacementFactory.create(data);
  }

  getTaxProfile(): FiscalProfile {
    return this.state.taxProfile;
  }

  /**
   * Resolves the profile effective for `year` together with the year it was
   * actually recorded for: the last entry with `entry.year <= year` —
   * history entries plus the current profile as an implicit last point at
   * `taxProfileYear`. The earliest entry applies when `year` precedes all
   * recorded points.
   */
  resolveTaxProfileForYear(year: number): { profile: FiscalProfile; recordedYear: number } {
    const entries = [
      ...this.state.taxProfileHistory,
      { year: this.state.taxProfileYear, profile: this.state.taxProfile }
    ];
    let resolved = entries[0];
    for (const entry of entries) {
      if (entry.year <= year) {
        resolved = entry;
      } else {
        break;
      }
    }
    return { profile: resolved.profile, recordedYear: resolved.year };
  }

  /** The tax profile effective for an income year. */
  getTaxProfileForYear(year: number): FiscalProfile {
    return this.resolveTaxProfileForYear(year).profile;
  }

  /** The tax profile effective at `date` — the profile of its income year. */
  getTaxProfileAt(date: string): FiscalProfile {
    return this.getTaxProfileForYear(yearOf(date));
  }

  /**
   * Gross/net totals at each given date for `placements`. A placement
   * contributes only when it has a state at that date. Used by the
   * history chart; a placement whose module fails to load is skipped.
   * @param dates query dates (YYYY-MM-DD), ascending — each placement
   *   resolves its states in a single merge-join pass over them.
   * @param placements placements to total; defaults to all.
   * @returns one `{ date, gross, net }` point per input date, aligned by index.
   */
  getValueSeries(dates: string[], placements: BasePlacement[] = this.state.placements): { date: string; gross: number; net: number }[] {
    const perPlacement = placements.map(p => p.getDataSeriesAt(dates));
    return dates.map((date, j) => {
      const profile = this.getTaxProfileAt(date);
      const now = new Date(`${date}T12:00:00`);
      let gross = 0;
      let net = 0;
      for (const series of perPlacement) {
        const data = series[j];
        if (data == null) continue;
        try {
          const evaluation = PlacementFactory.create(data).getEvaluation(profile, now);
          gross += evaluation.grossValue || 0;
          net += (evaluation.netValueBeforeIR ?? 0) - (evaluation.imposition ?? 0);
        } catch {
          // A placement whose module failed to load is skipped, not fatal.
        }
      }
      return { date, gross, net };
    });
  }

  /** All years holding a recorded profile point, ascending. */
  getTaxProfileYears(): number[] {
    return [...this.state.taxProfileHistory.map(e => e.year), this.state.taxProfileYear]
      .sort((a, b) => a - b);
  }

  hasTaxProfileHistoryEntry(year: number): boolean {
    return this.state.taxProfileHistory.some(e => e.year === year);
  }

  /**
   * Removes the profile point recorded for `year` — the year then resolves
   * from the previous recorded point. The current profile is not part of
   * `taxProfileHistory` and can never be deleted this way.
   */
  deleteTaxProfileHistoryEntry(year: number): void {
    this.state.taxProfileHistory = this.state.taxProfileHistory.filter(e => e.year !== year);
    this._persistAndEmit();
  }

  /**
   * Records the profile for `year` (default: the current income year; a
   * later year is clamped — a profile describes a whole income year, so no
   * point can be in the future). `year === taxProfileYear` updates the
   * current profile in place; a more recent `year` pushes the previous
   * profile into `taxProfileHistory`; a past `year` records a history
   * entry instead, leaving the current profile untouched.
   */
  updateTaxProfile(newTaxProfile: TaxProfileInput, year?: number): void {
    const currentYear = new Date().getFullYear();
    const targetYear = Math.min(year ?? currentYear, currentYear);
    const normalized = this._normalizeTaxProfile(newTaxProfile);

    if (targetYear < this.state.taxProfileYear) {
      this.state.taxProfileHistory = recordYearEntry(
        this.state.taxProfileHistory,
        { year: targetYear, profile: normalized }
      );
    } else {
      if (targetYear > this.state.taxProfileYear
        && JSON.stringify(this.state.taxProfile) !== JSON.stringify(normalized)) {
        this.state.taxProfileHistory = recordYearEntry(
          this.state.taxProfileHistory,
          { year: this.state.taxProfileYear, profile: this.state.taxProfile }
        );
      }
      this.state.taxProfile = normalized;
      this.state.taxProfileYear = targetYear;
    }

    this._persistAndEmit();
  }

  importData(rawData: Partial<ExportPayload>): void {
    this._hydrateState(rawData);
    this._persistAndEmit();
  }

  _getDefaultData(): ExportPayload {
    return {
      version: "1.2",
      taxProfile: { profile: AppStore.DEFAULT_TAX_PROFILE, year: new Date().getFullYear() },
      placements: []
    };
  }
}
