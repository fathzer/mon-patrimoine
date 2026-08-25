import { EventBus } from './EventBus.js';
import { Household } from '../fiscality/Household.js';
import type { HouseholdData } from '../fiscality/Household.js';
import { PlacementFactory } from '../modules/PlacementFactory.js';
import type { BasePlacement, PlacementData, Evaluation } from '../modules/BasePlacement.js';
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

export interface ExportPayload {
  version: string;
  taxProfile: FiscalProfile;
  placements: PlacementData[];
}

export type AppStoreEvents = {
  'state:changed': GlobalSummary;
  'state:loading': boolean;
  'save:error': Error;
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
  placements: BasePlacement[];
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
      placements: []
    };
  }

  async init(): Promise<void> {
    this.emit('state:loading', true);
    await this.storageManager.initialize();
    const status = await this.storageManager.getStatus();

    this.state.isAuthenticated = status.isConnected;

    if (this.state.isAuthenticated) {
      let rawData = await this.storageManager.load() as Partial<ExportPayload> | null;
      if (!rawData) {
        rawData = this._getDefaultData();
        await this.storageManager.save(rawData);
      }
      this._hydrateState(rawData);
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

  updatePlacement(id: string, placementData: PlacementData): void {
    const index = this.state.placements.findIndex(p => p.id === id);
    if (index !== -1) {
      this.state.placements[index] = PlacementFactory.create({ ...placementData, id });
      this._persistAndEmit();
    }
  }

  deletePlacement(id: string): void {
    this.state.placements = this.state.placements.filter(p => p.id !== id);
    this._persistAndEmit();
  }

  getExportPayload(): ExportPayload {
    return {
      version: "1.0",
      taxProfile: this.state.taxProfile,
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
    this.state.placements = (rawData.placements || []).map(pData => PlacementFactory.create(pData));
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

    const evaluations: EvaluationEntry[] = this.state.placements.map(placement => {
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

  updateTaxProfile(newTaxProfile: TaxProfileInput): void {
    this.state.taxProfile = this._normalizeTaxProfile(newTaxProfile);

    this._persistAndEmit();
  }

  importData(rawData: Partial<ExportPayload>): void {
    this._hydrateState(rawData);
    this._persistAndEmit();
  }

  _getDefaultData(): ExportPayload {
    return {
      version: "1.0",
      taxProfile: AppStore.DEFAULT_TAX_PROFILE,
      placements: []
    };
  }
}
