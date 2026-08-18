import { BasePlacement } from './BasePlacement.js';
import { Categories } from '../core/Categories.js';
import { CheckingAccountEditor } from '../ui/editors/CheckingAccountEditor.js';

/** @typedef {import('../fiscality/TaxCalculator.js').FiscalProfile} FiscalProfile */
/** @typedef {import('../fiscality/TaxCalculator.js').PlacementIncome} PlacementIncome */

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

  getEvaluation(fiscalProfile, now = new Date()) {
    const grossValue = this.currentValue - this.cardBalance;
    return {
      grossValue: grossValue,
      netValueBeforeIR: grossValue,
      socialCharges: 0,
      latentGain: 0,
      imposition: this.getImposition(fiscalProfile, now)
    };
  }

  /**
   * @param {FiscalProfile} fiscalProfile
   * @param {Date} [now]
   * @returns {PlacementIncome[]} always an empty list for checking accounts
   */
  getTaxableIncomes(fiscalProfile, now = new Date()) {
    return [];
  }

  toJSON() {
    return {
      ...super.toJSON(),
      currentValue: this.currentValue,
      cardBalance: this.cardBalance
    };
  }
}
