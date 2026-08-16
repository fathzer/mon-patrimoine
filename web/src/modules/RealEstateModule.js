import { BasePlacement } from './BasePlacement.js';
import { Categories } from '../core/Categories.js';
import { SOCIAL_CONTRIBUTION_RATES } from '../fiscality/rates.js';
import { RealEstateEditor } from '../ui/editors/RealEstateEditor.js';

const STANDARD_SOCIAL_RATE = SOCIAL_CONTRIBUTION_RATES.OLD_CSG_CRDS;
const YEAR_6_21_REDUCTION = 0.0165;
const YEAR_22_REDUCTION = 0.016;
const YEAR_23_30_REDUCTION = 0.09;
const INCOME_TAX_RATE = 0.19;
const INCOME_TAX_REDUCTION_RATE = 0.06;
const REDUCTION_AT_21 = 16 * YEAR_6_21_REDUCTION;
const REDUCTION_AT_22 = REDUCTION_AT_21 + YEAR_22_REDUCTION;

export const FIVE_YEARS_LIMIT = 5;
export const ACQUISITION_FEES_FLAT_RATE = 0.075;
export const WORKS_FLAT_RATE = 0.15;

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
    this.freeAcquisition = data.freeAcquisition === true;
    this.acquisitionFees = Number(data.acquisitionFees ?? data.acquisitionFeesAmount) || 0;
    this.works = Number(data.works ?? data.worksAmount) || 0;
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

    const grossGain = Math.max(0, this.currentValue - this.acquisitionPrice);
    const totalDeductions = this.getTotalDeductions(now);
    const netGain = Math.max(0, grossGain - totalDeductions);
    const holdingYears = this.getHoldingYears(now);
    const reductionRate = this.getReductionRate(holdingYears);
    const taxableGain = netGain * (1 - reductionRate);
    const socialCharges = taxableGain * STANDARD_SOCIAL_RATE;

    const irReductionRate = this.getIncomeTaxReduction(holdingYears);
    const irBase = netGain * (1 - irReductionRate);
    const imposition = irBase > 0
      ? irBase * INCOME_TAX_RATE
      : 0;

    return {
      grossValue: this.currentValue,
      netValueBeforeIR: this.currentValue - socialCharges,
      socialCharges,
      latentGain: netGain,
      imposition
    };
  }

  getHoldingYears(now) {
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

  getDeductibleAcquisitionFees() {
    if (this.primaryResidence) return 0;
    if (this.acquisitionFees > 0) return this.acquisitionFees;
    if (this.freeAcquisition) return 0;
    return this.acquisitionPrice * ACQUISITION_FEES_FLAT_RATE;
  }

  getDeductibleWorks(now = new Date()) {
    if (this.primaryResidence) return 0;
    if (this.works > 0) return this.works;
    const holdingYears = this.getHoldingYears(now);
    return holdingYears >= FIVE_YEARS_LIMIT ? this.acquisitionPrice * WORKS_FLAT_RATE : 0;
  }

  getTotalDeductions(now = new Date()) {
    return this.getDeductibleAcquisitionFees() + this.getDeductibleWorks(now);
  }

  getReductionRate(years) {
    if (years <= 5) return 0;
    if (years <= 21) return Math.min((years - 5) * YEAR_6_21_REDUCTION, REDUCTION_AT_21);

    let reduction = REDUCTION_AT_22;
    reduction += Math.max(0, years - 22) * YEAR_23_30_REDUCTION;
    return Math.min(reduction, 1);
  }

  getIncomeTaxReduction(years) {
    if (years <= 5) return 0;
    return Math.min((years - 5) * INCOME_TAX_REDUCTION_RATE, 1);
  }

  getSocialChargesRate() {
    return STANDARD_SOCIAL_RATE;
  }

  getIncomeTaxRate() {
    return INCOME_TAX_RATE;
  }

  getIncomeTaxReductionRate() {
    return INCOME_TAX_REDUCTION_RATE;
  }

  getYear6To21ReductionRate() {
    return YEAR_6_21_REDUCTION;
  }

  getYear22ReductionRate() {
    return YEAR_22_REDUCTION;
  }

  getYear23To30ReductionRate() {
    return YEAR_23_30_REDUCTION;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      primaryResidence: this.primaryResidence,
      currentValue: this.currentValue,
      acquisitionDate: this.acquisitionDate,
      acquisitionPrice: this.acquisitionPrice,
      freeAcquisition: this.freeAcquisition,
      acquisitionFees: this.acquisitionFees,
      works: this.works
    };
  }
}
