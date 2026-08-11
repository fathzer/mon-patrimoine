import { BasePlacement } from './BasePlacement.js';
import { Categories } from '../core/Categories.js';
import { CheckingAccountEditor } from '../ui/editors/CheckingAccountEditor.js';

export class CheckingAccountModule extends BasePlacement {
  static DEFAULT_CATEGORY = Categories.BANK_ACCOUNTS;

  static getEditorClass() {
    return CheckingAccountEditor;
  }

  constructor(data) {
    super(data);
    this.currentValue = Number(data.currentValue) || 0;
    this.cardBalance = Number(data.cardBalance) || 0;
  }

  getEvaluation() {
    return {
      grossValue: this.currentValue,
      netValueBeforeIR: Math.max(0, this.currentValue - this.cardBalance),
      socialCharges: 0,
      latentGain: 0,
      imposition: 0
    };
  }

  toJSON() {
    return {
      ...super.toJSON(),
      currentValue: this.currentValue,
      cardBalance: this.cardBalance
    };
  }
}
