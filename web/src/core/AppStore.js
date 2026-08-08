import { EventBus } from './EventBus.js';
import { PlacementFactory } from '../modules/PlacementFactory.js';

export class AppStore extends EventBus {
  constructor(storageManager) {
    super();
    this.storageManager = storageManager;
    this.state = {
      isLoading: true,
      taxProfile: { marginalTaxRate: 0.30, customRates: { csgCrds: 0.172 } },
      placements: []
    };
  }

  async init() {
    this.emit('state:loading', true);
    await this.storageManager.initialize();
    let rawData = await this.storageManager.load();

    if (!rawData) {
      rawData = this._getDemoData();
      await this.storageManager.save(rawData);
    }

    this._hydrateState(rawData);
    this.state.isLoading = false;
    this.emit('state:loading', false);
    this.emit('state:changed', this.getGlobalSummary());
  }

  _hydrateState(rawData) {
    this.state.taxProfile = rawData.taxProfile || this.state.taxProfile;
    this.state.placements = (rawData.placements || []).map(pData => PlacementFactory.create(pData));
  }

  getGlobalSummary() {
    const now = new Date();
    let totalGross = 0;
    let totalNetBeforeIR = 0;
    let totalSocialCharges = 0;

    const breakdown = {};
    const categoriesSet = new Set();

    const evaluations = this.state.placements.map(placement => {
      const evaluation = placement.getEvaluation(this.state.taxProfile, now);
      totalGross += evaluation.grossValue;
      totalNetBeforeIR += evaluation.netValueBeforeIR;
      totalSocialCharges += evaluation.socialCharges;

      const cat = placement.category;
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
      totalGross,
      finalNetValue: totalNetBeforeIR,
      totalSocialCharges,
      categories: Array.from(categoriesSet),
      breakdown,
      evaluations
    };
  }

  _getDemoData() {
    return {
      version: "1.2",
      taxProfile: { marginalTaxRate: 0.30 },
      placements: [
        { id: "1", type: "checking_account", category: "bank_accounts", label: "Compte Courant Principal", institution: "BNP Paribas", currentValue: 4500 },
        { id: "2", type: "checking_account", category: "bank_accounts", label: "Livret A", institution: "BNP Paribas", currentValue: 22950 },
        { id: "3", type: "pea", category: "investments", label: "PEA Actions Tech", institution: "Boursorama", openingDate: "2018-01-10", totalDeposits: 25000, currentValue: 41200 }
      ]
    };
  }
}
