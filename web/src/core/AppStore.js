import { EventBus } from './EventBus.js';
import { Household } from '../fiscality/Household.js';
import { PlacementFactory } from '../modules/PlacementFactory.js';

/** @typedef {import('../fiscality/TaxCalculator.js').FiscalProfile} FiscalProfile */

export class AppStore extends EventBus {
  static DEFAULT_TAX_PROFILE = {
    household: new Household(),
    taxableIncome: 0,
    usePfu: true
  };

  constructor(storageManager) {
    super();
    this.storageManager = storageManager;
    this.state = {
      isAuthenticated: false,
      isLoading: true,
      taxProfile: AppStore.DEFAULT_TAX_PROFILE,
      placements: []
    };
  }

  async init() {
    this.emit('state:loading', true);
    await this.storageManager.initialize();
    const status = await this.storageManager.getStatus();

    this.state.isAuthenticated = status.isConnected;

    if (this.state.isAuthenticated) {
      let rawData = await this.storageManager.load();
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

  async login() {
    const ok = await this.storageManager.authenticate();
    if (ok) await this.init();
  }

  async logout() {
    await this.storageManager.disconnect();
    this.state.isAuthenticated = false;
    this.state.placements = [];
    this.emit('state:changed', this.getGlobalSummary());
  }

  addPlacement(placementData) {
    const instance = PlacementFactory.create(placementData);
    this.state.placements.push(instance);
    this._persistAndEmit();
  }

  updatePlacement(id, placementData) {
    const index = this.state.placements.findIndex(p => p.id === id);
    if (index !== -1) {
      this.state.placements[index] = PlacementFactory.create({ ...placementData, id });
      this._persistAndEmit();
    }
  }

  deletePlacement(id) {
    this.state.placements = this.state.placements.filter(p => p.id !== id);
    this._persistAndEmit();
  }

  getExportPayload() {
    return {
      version: "1.0",
      taxProfile: this.state.taxProfile,
      placements: this.state.placements.map(p => p.toJSON())
    };
  }

  _persistAndEmit() {
    const payload = this.getExportPayload();
    this.storageManager.save(payload)
      .then((ok) => {
        if (!ok) throw new Error('Storage reported a failed save');
        console.log('Data successfully saved:', payload);
      })
      .catch((error) => {
        console.error('Failed to save data:', error);
        this.emit('save:error', error);
      });
    const globalSummary = this.getGlobalSummary();
    console.log('Emitting state:changed with:', globalSummary);
    this.emit('state:changed', globalSummary);
  }

  _hydrateState(rawData) {
    this.state.taxProfile = this._normalizeTaxProfile(rawData.taxProfile);
    this.state.placements = (rawData.placements || []).map(pData => PlacementFactory.create(pData));
  }

  _normalizeTaxProfile(taxProfile = {}) {
    const current = this.getTaxProfile();
    const household = taxProfile.household ?? current.household;
    const taxableIncome = Number.isFinite(taxProfile.taxableIncome) ? taxProfile.taxableIncome : current.taxableIncome;
    const usePfu = typeof taxProfile.usePfu === 'boolean' ? taxProfile.usePfu : current.usePfu;

    return {
      household: Household.from(household),
      taxableIncome,
      usePfu
    };
  }

  getGlobalSummary() {
    if (!this.state.isAuthenticated) {
      return { isAuthenticated: false };
    }

    const now = new Date();
    let totalGross = 0;
    let totalNetBeforeIR = 0;
    const breakdown = {};
    const categoriesSet = new Set();

    const evaluations = this.state.placements.map(placement => {
      const evaluation = placement.getEvaluation(this.state.taxProfile, now);
      totalGross += evaluation.grossValue;
      totalNetBeforeIR += evaluation.netValueBeforeIR;

      const cat = placement.getCategory();
      categoriesSet.add(cat);
      if (!breakdown[cat]) breakdown[cat] = { gross: 0, percentage: 0 };
      breakdown[cat].gross += evaluation.grossValue;

      return { instance: placement, evaluation };
    });

    Object.keys(breakdown).forEach(cat => {
      breakdown[cat].percentage = totalGross > 0
        ? Math.round((breakdown[cat].gross / totalGross) * 10000) / 100
        : 0;
    });

    return {
      isAuthenticated: true,
      totalGross,
      finalNetValue: totalNetBeforeIR,
      categories: Array.from(categoriesSet),
      breakdown,
      evaluations
    };
  }

  /**
   * @returns {FiscalProfile}
   */
  getTaxProfile() {
    return this.state.taxProfile;
  }

  /**
   * Updates the stored tax profile.
   * @param {FiscalProfile} newTaxProfile
   */
  updateTaxProfile(newTaxProfile) {
    this.state.taxProfile = this._normalizeTaxProfile(newTaxProfile);

    this._persistAndEmit();
  }

  importData(rawData) {
    this._hydrateState(rawData);
    this._persistAndEmit();
  }

  _getDefaultData() {
    return {
      version: "1.0",
      taxProfile: AppStore.DEFAULT_TAX_PROFILE,
      placements: []
    };
  }
}
