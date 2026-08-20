import { BasePlacement } from './BasePlacement.js';
import { Categories } from '../core/Categories.js';
import { StockGrantEditor } from '../ui/editors/StockGrantEditor.js';
import { SOCIAL_CONTRIBUTION_RATES } from '../fiscality/rates.js';

/** @typedef {import('../fiscality/TaxCalculator.js').FiscalProfile} FiscalProfile */
/** @typedef {import('../fiscality/TaxCalculator.js').PlacementIncome} PlacementIncome */

export class StockGrantModule extends BasePlacement {
  static DEFAULT_CATEGORY = Categories.INVESTMENTS;

  static getEditorClass() {
    return StockGrantEditor;
  }

  constructor(data) {
    super(data);
    this.stockName = data.stockName || '';
    this.currentPrice = Number(data.currentPrice) || 0;
    this.attributions = Array.isArray(data.attributions) ? data.attributions : [];
  }

  getLatentGain() {
    const totalShares = this.attributions.reduce((sum, a) => sum + (Number(a.numberOfShares) || 0), 0);
    return totalShares * this.currentPrice;
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

  getEvaluation(fiscalProfile, now = new Date()) {
    const grossValue = this.getLatentGain();
    const socialCharges = this.getSocialCharges();

    return {
      grossValue,
      netValueBeforeIR: grossValue - socialCharges,
      socialCharges: socialCharges,
      latentGain: grossValue,
      imposition: this.getImposition(fiscalProfile)
    };
  }

  toJSON() {
    return {
      ...super.toJSON(),
      stockName: this.stockName,
      currentPrice: this.currentPrice,
      attributions: this.attributions
    };
  }
}
