import { BasePlacement } from './BasePlacement.js';
import { Categories } from '../core/Categories.js';
import { SOCIAL_CONTRIBUTION_RATES } from '../fiscality/rates.js';
import { CtoEditor } from '../ui/editors/CtoEditor.js';

/** @typedef {import('../fiscality/TaxCalculator.js').FiscalProfile} FiscalProfile */
/** @typedef {import('../fiscality/TaxCalculator.js').PlacementIncome} PlacementIncome */

export class CtoModule extends BasePlacement {
  static DEFAULT_CATEGORY = Categories.INVESTMENTS;

  static getEditorClass() {
    return CtoEditor;
  }

  constructor(data) {
    super(data);
    this.acquisitionValue = Number(data.acquisitionValue) || 0;
    this.cashBalance = Number(data.cashBalance) || 0;
    this.currentValue = Number(data.currentValue) || 0;
  }

  getLatentGain() {
    return Math.max(0, this.currentValue - this.acquisitionValue - this.cashBalance);
  }

  getSocialChargesRate() {
    return SOCIAL_CONTRIBUTION_RATES.CSG_CRDS;
  }

  getSocialCharges() {
    return this.getLatentGain() * this.getSocialChargesRate();
  }

  /**
   * @param {FiscalProfile} fiscalProfile
   * @param {Date} [now]
   * @returns {PlacementIncome[]}
   */
  getTaxableIncomes(fiscalProfile, now = new Date()) {
    const latentGain = this.getLatentGain();
    return latentGain > 0
      ? [{ assietteImposition: latentGain, eligiblePfu: true, deductionRevenus: latentGain }]
      : [];
  }

  getEvaluation(fiscalProfile) {
    const socialCharges = this.getSocialCharges();

    return {
      grossValue: this.currentValue,
      netValueBeforeIR: this.currentValue - socialCharges,
      socialCharges,
      latentGain: this.getLatentGain(),
      imposition: this.getImposition(fiscalProfile)
    };
  }

  toJSON() {
    return {
      ...super.toJSON(),
      acquisitionValue: this.acquisitionValue,
      cashBalance: this.cashBalance,
      currentValue: this.currentValue
    };
  }
}
