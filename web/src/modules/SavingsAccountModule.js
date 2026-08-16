import { BasePlacement } from './BasePlacement.js';
import { SavingsAccountEditor } from '../ui/editors/SavingsAccountEditor.js';
import { SOCIAL_CONTRIBUTION_RATES } from '../fiscality/rates.js';
import { TaxCalculator } from '../fiscality/TaxCalculator.js';
import { Categories } from '../core/Categories.js';

export class SavingsAccountModule extends BasePlacement {
  static DEFAULT_CATEGORY = Categories.SAVING_ACCOUNTS;

  static getEditorClass() {
    return SavingsAccountEditor;
  }

  constructor(data) {
    super(data);
    this.currentValue = Number(data.currentValue) || 0;
    this.interestAmount = Number(data.interestAmount) || 0;
    this.taxExempt = data.taxExempt !== false;
    this.promotionalInterest = this.taxExempt ? 0 : (Number(data.promotionalInterest) || 0);
  }

  getTotalInterest() {
    return this.interestAmount + this.promotionalInterest;
  }

  getSocialChargesRate() {
    return SOCIAL_CONTRIBUTION_RATES.CSG_CRDS;
  }

  getSocialCharges() {
    return this.taxExempt ? 0 : this.getTotalInterest() * this.getSocialChargesRate();
  }

  getImposition(fiscalProfile) {
    if (this.taxExempt) {
      return 0;
    }
    const totalInterest = this.getTotalInterest();
    return TaxCalculator.calculateTax(fiscalProfile, { assietteImposition: totalInterest, eligiblePfu: true, deductionRevenus: totalInterest });
  }

  getEvaluation(fiscalProfile, now = new Date()) {
    const totalInterest = this.getTotalInterest();
    const grossValue = this.currentValue + totalInterest;
    const socialCharges = this.getSocialCharges();

    return {
      grossValue,
      netValueBeforeIR: grossValue - socialCharges,
      socialCharges,
      latentGain: totalInterest,
      imposition: this.getImposition(fiscalProfile)
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
