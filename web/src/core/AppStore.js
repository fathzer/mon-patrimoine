import { EventBus } from './EventBus.js';
import { PlacementFactory } from '../modules/PlacementFactory.js';

export class AppStore extends EventBus {
  static DEFAULT_TAX_PROFILE = {
    maritalStatus: 'single',
    childrenCount: 0,
    fiscalParts: 1,
    mode: 'direct',
    customTmi: 0.30,
    rfr: 0,
    tmi: 0.30,
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

  async addPlacement(placementData) {
    const instance = PlacementFactory.create(placementData);
    this.state.placements.push(instance);
    await this._persistAndEmit();
  }

  async updatePlacement(id, placementData) {
    const index = this.state.placements.findIndex(p => p.id === id);
    if (index !== -1) {
      this.state.placements[index] = PlacementFactory.create({ ...placementData, id });
      await this._persistAndEmit();
    }
  }

  async deletePlacement(id) {
    this.state.placements = this.state.placements.filter(p => p.id !== id);
    await this._persistAndEmit();
  }

  async _persistAndEmit() {
    const payload = {
      version: "1.0",
      taxProfile: this.state.taxProfile,
      placements: this.state.placements.map(p => p.toJSON())
    };
    try {
      await this.storageManager.save(payload);
      console.log('Data successfully saved:', payload);
    } catch (error) {
      console.error('Failed to save data:', error);
    }
    const globalSummary = this.getGlobalSummary();
    console.log('Emitting state:changed with:', globalSummary);
    this.emit('state:changed', globalSummary);
  }

  _hydrateState(rawData) {
    this.state.taxProfile = rawData.taxProfile || this.state.taxProfile;
    this.state.placements = (rawData.placements || []).map(pData => PlacementFactory.create(pData));
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

    console.log("Getting global summary with state", this.state);
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
        ? Math.round((breakdown[cat].gross / totalGross) * 100) 
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

  getTaxProfile() {
    return this.state.taxProfile;
  }

  async updateTaxProfile(newTaxProfile) {
    this.state.taxProfile = {
      ...this.getTaxProfile(),
      ...newTaxProfile
    };

    await this._persistAndEmit();
  }

  _getDefaultData() {
    return {
      version: "1.0",
      taxProfile: AppStore.DEFAULT_TAX_PROFILE,
      placements: []
    };
  }
}
