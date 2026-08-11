import { BasePlacement } from './BasePlacement.js';
import { FISCAL_RATES } from '../fiscality/rates.js';
import { Categories } from '../core/Categories.js';

export class SavingsAccountBaseModule extends BasePlacement {
  static DEFAULT_CATEGORY = Categories.SAVING_ACCOUNTS;

  constructor(data) {
    super(data);
    this.currentValue = Number(data.currentValue) || 0;
    this.interestAmount = Number(data.interestAmount) || 0;
    this.taxExempt = data.taxExempt !== false;
    this.promotionalInterest = this.taxExempt ? 0 : (Number(data.promotionalInterest) || 0);
  }

  getEvaluation(fiscalProfile, now = new Date()) {
    const totalInterest = this.interestAmount + this.promotionalInterest;
    const grossValue = this.currentValue + totalInterest;
    const socialCharges = this.taxExempt ? 0 : totalInterest * FISCAL_RATES.CSG_CRDS;

    return {
      grossValue,
      netValueBeforeIR: grossValue - socialCharges,
      socialCharges,
      latentGain: totalInterest
    };
  }

  toJSON() {
    return {
      ...super.toJSON(),
      currentValue: this.currentValue,
      interestAmount: this.interestAmount,
      promotionalInterest: this.promotionalInterest,
      taxExempt: this.taxExempt
    };
  }
}
