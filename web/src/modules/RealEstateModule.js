import { BasePlacement } from './BasePlacement.js';
import { Categories } from '../core/Categories.js';
import { FISCAL_RATES } from '../fiscality/rates.js';
import { TaxCalculator } from '../fiscality/TaxCalculator.js';
import { RealEstateEditor } from '../ui/editors/RealEstateEditor.js';

const STANDARD_SOCIAL_RATE = FISCAL_RATES.CSG_CRDS;
const YEAR_6_21_REDUCTION = 0.0165;
const YEAR_22_REDUCTION = 0.016;
const YEAR_23_30_REDUCTION = 0.09;
const REDUCTION_AT_21 = 16 * YEAR_6_21_REDUCTION;
const REDUCTION_AT_22 = REDUCTION_AT_21 + YEAR_22_REDUCTION;

export class RealEstateModule extends BasePlacement {
  static DEFAULT_CATEGORY = Categories.REAL_ESTATE;

  static getEditorClass() {
    return RealEstateEditor;
  }

  constructor(data) {
    super(data);
    this.primaryResidence = data.primaryResidence === true;
    this.currentValue = Number(data.currentValue) || 0;
    this.acquisitionDate = data.acquisitionDate || '';
    this.acquisitionPrice = Number(data.acquisitionPrice) || 0;
  }

  getEvaluation(fiscalProfile, now = new Date()) {
    if (this.primaryResidence) {
      return {
        grossValue: this.currentValue,
        netValueBeforeIR: this.currentValue,
        socialCharges: 0,
        latentGain: 0,
        imposition: 0
      };
    }

    const gain = Math.max(0, this.currentValue - this.acquisitionPrice);
    const holdingYears = this._getHoldingYears(now);
    const reductionRate = this._getReductionRate(holdingYears);
    const taxableGain = gain * (1 - reductionRate);
    const socialCharges = taxableGain * STANDARD_SOCIAL_RATE;

    const irReductionRate = holdingYears <= 5 ? 0 : Math.min((holdingYears - 5) * 0.06, 1);
    const irBase = gain * (1 - irReductionRate);
    const imposition = irBase > 0
      ? TaxCalculator.calculateTax(fiscalProfile, { assietteImposition: irBase, tauxSpecifique: 0.19 })
      : 0;

    return {
      grossValue: this.currentValue,
      netValueBeforeIR: this.currentValue - socialCharges,
      socialCharges,
      latentGain: gain,
      imposition
    };
  }

  _getHoldingYears(now) {
    if (!this.acquisitionDate) return 0;

    const acquisition = new Date(this.acquisitionDate);
    let years = now.getFullYear() - acquisition.getFullYear();
    const monthDiff = now.getMonth() - acquisition.getMonth();
    const dayDiff = now.getDate() - acquisition.getDate();

    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      years--;
    }

    return Math.max(0, years);
  }

  _getReductionRate(years) {
    if (years <= 5) return 0;
    if (years <= 21) return Math.min((years - 5) * YEAR_6_21_REDUCTION, REDUCTION_AT_21);

    let reduction = REDUCTION_AT_22;
    reduction += Math.max(0, years - 22) * YEAR_23_30_REDUCTION;
    return Math.min(reduction, 1);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      primaryResidence: this.primaryResidence,
      currentValue: this.currentValue,
      acquisitionDate: this.acquisitionDate,
      acquisitionPrice: this.acquisitionPrice
    };
  }
}
