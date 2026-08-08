import { BasePlacement } from './BasePlacement.js';

export class CheckingAccountModule extends BasePlacement {
  constructor(data) {
    super(data);
    this.category = data.category || 'bank_accounts';
    this.currentValue = Number(data.currentValue) || 0;
  }

  getEvaluation() {
    return {
      grossValue: this.currentValue,
      netValueBeforeIR: this.currentValue,
      socialCharges: 0,
      taxableIncomeBase: 0,
      latentGain: 0
    };
  }
}
