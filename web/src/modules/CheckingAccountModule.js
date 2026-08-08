import { BasePlacement } from './BasePlacement.js';
import { Categories } from '../core/Categories.js';

export class CheckingAccountModule extends BasePlacement {
  static DEFAULT_CATEGORY = Categories.BANK_ACCOUNTS;

  constructor(data) {
    super(data);
    this.currentValue = Number(data.currentValue) || 0;
  }

  getEvaluation() {
    return {
      grossValue: this.currentValue,
      netValueBeforeIR: this.currentValue,
      socialCharges: 0,
      latentGain: 0
    };
  }

  toJSON() {
    return {
      ...super.toJSON(),
      currentValue: this.currentValue
    };
  }
}
