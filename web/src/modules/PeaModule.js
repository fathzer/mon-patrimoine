import { BasePlacement } from './BasePlacement.js';
import { SOCIAL_CONTRIBUTION_RATES } from '../fiscality/rates.js';
import { Categories } from '../core/Categories.js';
import { PeaEditor } from '../ui/editors/PeaEditor.js';

/** @typedef {import('../fiscality/TaxCalculator.js').FiscalProfile} FiscalProfile */
/** @typedef {import('../fiscality/TaxCalculator.js').PlacementIncome} PlacementIncome */

export class PeaModule extends BasePlacement {
  static DEFAULT_CATEGORY = Categories.INVESTMENTS;

  static getEditorClass() {
    return PeaEditor;
  }

  constructor(data) {
    super(data);
    this.totalDeposits = Number(data.totalDeposits) || 0;
    this.currentValue = Number(data.currentValue) || 0;
    this.openingDate = data.openingDate || new Date().toISOString().split('T')[0];
  }

  getHoldingYears(now = new Date()) {
    const opening = new Date(this.openingDate);
    let years = now.getFullYear() - opening.getFullYear();
    const monthDiff = now.getMonth() - opening.getMonth();
    const dayDiff = now.getDate() - opening.getDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      years--;
    }
    return Math.max(0, years);
  }

  isExemptFromIncomeTax(now = new Date()) {
    return this.getHoldingYears(now) >= 5;
  }

  isPre2018() {
    return this.openingDate && this.openingDate < '2018-01-01';
  }

  getLatentGain() {
    return Math.max(0, this.currentValue - this.totalDeposits);
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
    if (this.isExemptFromIncomeTax(now)) {
      return [];
    }
    const latentGain = this.getLatentGain();
    return [{ assietteImposition: latentGain, eligiblePfu: true, deductionRevenus: latentGain }];
  }

  getEvaluation(fiscalProfile, now = new Date()) {
    const socialCharges = this.getSocialCharges();

    return {
      grossValue: this.currentValue,
      netValueBeforeIR: this.currentValue - socialCharges,
      socialCharges,
      latentGain: this.getLatentGain(),
      imposition: this.getImposition(fiscalProfile, now)
    };
  }

  toJSON() {
    return {
      ...super.toJSON(),
      totalDeposits: this.totalDeposits,
      currentValue: this.currentValue,
      openingDate: this.openingDate
    };
  }
}
