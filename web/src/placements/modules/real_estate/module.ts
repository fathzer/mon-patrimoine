import { BasePlacement, Category, SOCIAL_CONTRIBUTION_RATES } from '../../kit/v1/index.js';
import { RealEstateEditor } from './Editor.js';
import { getRealEstateTaxExplanation } from './TaxExplanation.js';
import type { Evaluation, PlacementData, PlacementModuleStatic, FiscalProfile, PlacementIncome } from '../../kit/v1/index.js';

export interface RealEstateData extends PlacementData {
  primaryResidence?: boolean;
  currentValue?: number;
  acquisitionDate?: string;
  acquisitionPrice?: number;
  freeAcquisition?: boolean;
  acquisitionFees?: number;
  acquisitionFeesAmount?: number;
  works?: number;
  worksAmount?: number;
}

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
  static getCategory(): Category {
    return Category.REAL_ESTATE;
  }

  static getLabel(): string {
    return 'Immobilier';
  }

  static getEditorClass() {
    return RealEstateEditor;
  }

  static getTaxExplanation(placement: BasePlacement, _fiscalProfile: FiscalProfile): string {
    return getRealEstateTaxExplanation(placement as RealEstateModule);
  }

  primaryResidence: boolean;
  currentValue: number;
  acquisitionDate: string;
  acquisitionPrice: number;
  freeAcquisition: boolean;
  acquisitionFees: number;
  works: number;

  constructor(data: RealEstateData) {
    super(data);
    this.primaryResidence = data.primaryResidence === true;
    this.currentValue = Number(data.currentValue) || 0;
    this.acquisitionDate = data.acquisitionDate || '';
    this.acquisitionPrice = Number(data.acquisitionPrice) || 0;
    this.freeAcquisition = data.freeAcquisition === true;
    this.acquisitionFees = Number(data.acquisitionFees ?? data.acquisitionFeesAmount) || 0;
    this.works = Number(data.works ?? data.worksAmount) || 0;
  }

  override getEvaluation(fiscalProfile: FiscalProfile, now: Date = new Date()): Evaluation {
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

    const imposition = this.getImposition(fiscalProfile, now);

    return {
      grossValue: this.currentValue,
      netValueBeforeIR: this.currentValue - socialCharges,
      socialCharges,
      latentGain: netGain,
      imposition
    };
  }

  override getTaxableIncomes(fiscalProfile: FiscalProfile, now: Date = new Date()): PlacementIncome[] {
    if (this.primaryResidence) {
      return [];
    }

    const grossGain = Math.max(0, this.currentValue - this.acquisitionPrice);
    const totalDeductions = this.getTotalDeductions(now);
    const netGain = Math.max(0, grossGain - totalDeductions);
    const holdingYears = this.getHoldingYears(now);
    const irReductionRate = this.getIncomeTaxReduction(holdingYears);
    const irBase = netGain * (1 - irReductionRate);

    if (irBase <= 0) {
      return [];
    }

    return [{ assietteImposition: irBase, tauxSpecifique: INCOME_TAX_RATE }];
  }

  getHoldingYears(now: Date): number {
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

  getDeductibleAcquisitionFees(): number {
    if (this.primaryResidence) return 0;
    if (this.acquisitionFees > 0) return this.acquisitionFees;
    if (this.freeAcquisition) return 0;
    return this.acquisitionPrice * ACQUISITION_FEES_FLAT_RATE;
  }

  getDeductibleWorks(now: Date = new Date()): number {
    if (this.primaryResidence) return 0;
    if (this.works > 0) return this.works;
    const holdingYears = this.getHoldingYears(now);
    return holdingYears >= FIVE_YEARS_LIMIT ? this.acquisitionPrice * WORKS_FLAT_RATE : 0;
  }

  getTotalDeductions(now: Date = new Date()): number {
    return this.getDeductibleAcquisitionFees() + this.getDeductibleWorks(now);
  }

  getReductionRate(years: number): number {
    if (years <= 5) return 0;
    if (years <= 21) return Math.min((years - 5) * YEAR_6_21_REDUCTION, REDUCTION_AT_21);

    let reduction = REDUCTION_AT_22;
    reduction += Math.max(0, years - 22) * YEAR_23_30_REDUCTION;
    return Math.min(reduction, 1);
  }

  getIncomeTaxReduction(years: number): number {
    if (years <= 5) return 0;
    return Math.min((years - 5) * INCOME_TAX_REDUCTION_RATE, 1);
  }

  getSocialChargesRate(): number {
    return STANDARD_SOCIAL_RATE;
  }

  getIncomeTaxRate(): number {
    return INCOME_TAX_RATE;
  }

  getIncomeTaxReductionRate(): number {
    return INCOME_TAX_REDUCTION_RATE;
  }

  getYear6To21ReductionRate(): number {
    return YEAR_6_21_REDUCTION;
  }

  getYear22ReductionRate(): number {
    return YEAR_22_REDUCTION;
  }

  getYear23To30ReductionRate(): number {
    return YEAR_23_30_REDUCTION;
  }

  override toJSON(): RealEstateData {
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

const _check: PlacementModuleStatic = RealEstateModule;
export default RealEstateModule;
