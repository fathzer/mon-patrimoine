import { BasePlacement } from './BasePlacement.js';
import { HomeSavingsEditor } from '../ui/editors/HomeSavingsEditor.js';
import { SOCIAL_CONTRIBUTION_RATES } from '../fiscality/rates.js';
import { Categories } from '../core/Categories.js';

/** @typedef {import('../fiscality/TaxCalculator.js').FiscalProfile} FiscalProfile */
/** @typedef {import('../fiscality/TaxCalculator.js').PlacementIncome} PlacementIncome */

export const CSG_2018_THRESHOLD = new Date('2018-01-01T00:00:00');

export class HomeSavingsModule extends BasePlacement {
  static DEFAULT_CATEGORY = Categories.SAVING_ACCOUNTS;

  static getEditorClass() {
    return HomeSavingsEditor;
  }

  constructor(data) {
    super(data);
    this.currentValue = Number(data.currentValue) || 0;
    this.interestAmount = Number(data.interestAmount) || 0;
    this.homeSavingsType = data.homeSavingsType || 'pel';
    this.openingDate = data.openingDate || new Date().toISOString().split('T')[0];
    this.taxExempt = false;
    this.promotionalInterest = 0;
  }

  getTotalInterest() {
    return this.interestAmount + this.promotionalInterest;
  }

  _getOpeningMidnight() {
    const openingDate = new Date(this.openingDate);
    return new Date(openingDate.getFullYear(), openingDate.getMonth(), openingDate.getDate());
  }

  _getNowMidnight(now = new Date()) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  _getTwelfthAnniversary() {
    const openingMidnight = this._getOpeningMidnight();
    const twelfthAnniversary = new Date(openingMidnight);
    twelfthAnniversary.setFullYear(twelfthAnniversary.getFullYear() + 12);
    return twelfthAnniversary;
  }

  isOlderThanTwelveYears(now = new Date()) {
    const nowMidnight = this._getNowMidnight(now);
    const twelfthAnniversary = this._getTwelfthAnniversary();
    return nowMidnight > twelfthAnniversary;
  }

  isOpenedBefore2018() {
    return this._getOpeningMidnight() < CSG_2018_THRESHOLD;
  }

  getSocialChargesRate(now = new Date()) {
    if (this.homeSavingsType === 'cel') {
      return this.isOpenedBefore2018() ? SOCIAL_CONTRIBUTION_RATES.OLD_CSG_CRDS : SOCIAL_CONTRIBUTION_RATES.CSG_CRDS;
    }

    if (this.isOpenedBefore2018()) {
      return this.isOlderThanTwelveYears(now) ? SOCIAL_CONTRIBUTION_RATES.CSG_CRDS : SOCIAL_CONTRIBUTION_RATES.OLD_CSG_CRDS;
    }

    return SOCIAL_CONTRIBUTION_RATES.CSG_CRDS;
  }

  isPfuEligible(now = new Date()) {
    const nowMidnight = this._getNowMidnight(now);
    const twelfthAnniversary = this._getTwelfthAnniversary();
    return !this.isOpenedBefore2018()
      || (this.homeSavingsType === 'pel' && nowMidnight > twelfthAnniversary);
  }

  getSocialCharges(now = new Date()) {
    return this.getTotalInterest() * this.getSocialChargesRate(now);
  }

  /**
   * @param {FiscalProfile} fiscalProfile
   * @param {Date} [now]
   * @returns {PlacementIncome[]}
   */
  getTaxableIncomes(fiscalProfile, now = new Date()) {
    if (!this.isPfuEligible(now)) {
      return [];
    }
    const totalInterest = this.getTotalInterest();
    return [{ assietteImposition: totalInterest, eligiblePfu: true, deductionRevenus: totalInterest }];
  }

  getEvaluation(fiscalProfile, now = new Date()) {
    const totalInterest = this.getTotalInterest();
    const grossValue = this.currentValue + totalInterest;
    const socialCharges = this.getSocialCharges(now);

    return {
      grossValue,
      netValueBeforeIR: grossValue - socialCharges,
      socialCharges,
      latentGain: totalInterest,
      imposition: this.getImposition(fiscalProfile, now)
    };
  }

  toJSON() {
    return {
      ...super.toJSON(),
      currentValue: this.currentValue,
      interestAmount: this.interestAmount,
      promotionalInterest: this.promotionalInterest,
      taxExempt: this.taxExempt,
      homeSavingsType: this.homeSavingsType,
      openingDate: this.openingDate
    };
  }
}
