import { BasePlacement } from './BasePlacement.js';
import { FISCAL_RATES } from '../fiscality/rates.js';

export class PeaModule extends BasePlacement {
  constructor(data) {
    super(data);
    this.category = data.category || 'investments';
    this.totalDeposits = Number(data.totalDeposits) || 0;
    this.currentValue = Number(data.currentValue) || 0;
    this.openingDate = new Date(data.openingDate);
  }

  getLatentGain() {
    return Math.max(0, this.currentValue - this.totalDeposits);
  }

  getAgeInYears(now = new Date()) {
    return Math.abs(now - this.openingDate) / (1000 * 60 * 60 * 24 * 365.25);
  }

  getEvaluation(fiscalProfile, now = new Date()) {
    const latentGain = this.getLatentGain();
    const ageInYears = this.getAgeInYears(now);
    const csgRate = fiscalProfile?.customRates?.csgCrds || FISCAL_RATES.CSG_CRDS;
    const socialCharges = latentGain * csgRate;

    return {
      grossValue: this.currentValue,
      netValueBeforeIR: this.currentValue - socialCharges,
      socialCharges: socialCharges,
      taxableIncomeBase: ageInYears >= 5 ? 0 : latentGain,
      latentGain: latentGain
    };
  }
}
