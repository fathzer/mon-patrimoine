import { BasePlacement, Category, FISCAL_RATES, SOCIAL_CONTRIBUTION_RATES, MaritalStatus } from '../../kit/v1/index.js';
import { LifeInsuranceEditor } from './Editor.js';
import { getLifeInsuranceTaxExplanation } from './TaxExplanation.js';
import type { Evaluation, PlacementData, PlacementModuleStatic, FiscalProfile, PlacementIncome } from '../../kit/v1/index.js';

export interface LifeInsuranceData extends PlacementData {
  openingDate?: string;
  totalPremiums?: number;
  pre2017Premiums?: number;
  currentValue?: number;
  euroFundsValue?: number;
}

const REFORM_DATE = '2017-09-27';
export const UC_SOCIAL_RATE = SOCIAL_CONTRIBUTION_RATES.OLD_CSG_CRDS;
export const PFU_BEFORE_8Y = FISCAL_RATES.PFU_IR_RATE;
export const PFU_AFTER_8Y_PRE_2017 = 0.075;
const PFU_AFTER_8Y_POST_2017_LOW = 0.075;
export const PFU_AFTER_8Y_POST_2017_HIGH = 0.128;
export const PREMIUM_THRESHOLD = 150000;
export const ALLOWANCE_SINGLE = 4600;
export const ALLOWANCE_COUPLE = 9200;

/**
 * Which premiums a taxable-gain tranche stems from: 'all' for contracts
 * younger than 8 years (single undivided tranche), 'pre2017'/'post2017' for
 * the reform-date split, 'post2017OverCeiling' for the post-2017 fraction
 * beyond the premium ceiling.
 */
export type GainTrancheScope = 'all' | 'pre2017' | 'post2017' | 'post2017OverCeiling';

export interface GainTaxTranche {
  scope: GainTrancheScope;
  base: number;
  rate: number;
}

/**
 * Breakdown of the income-tax rule applied to a contract, shared by the tax
 * computation and the tax explanation so the two can never diverge.
 */
export interface IncomeTaxBreakdown {
  latentGain: number;
  /** Allowance deducted from the gain: 0 before 8 years. */
  allowance: number;
  /** Gain remaining after the allowance. */
  taxableGain: number;
  /** PFU tranches (empty when taxed at the progressive scale). */
  tranches: GainTaxTranche[];
}

export class LifeInsuranceModule extends BasePlacement {
  static getCategory(): Category {
    return Category.LIFE_INSURANCE;
  }

  static getLabel(): string {
    return 'Assurance-vie';
  }

  static getEditorClass() {
    return LifeInsuranceEditor;
  }

  static getTaxExplanation(placement: BasePlacement, fiscalProfile: FiscalProfile): string {
    return getLifeInsuranceTaxExplanation(placement as LifeInsuranceModule, fiscalProfile);
  }

  openingDate: string;
  totalPremiums: number;
  pre2017Premiums: number;
  currentValue: number;
  euroFundsValue: number;

  constructor(data: LifeInsuranceData) {
    super({ ...data, type: 'life_insurance' });
    this.openingDate = data.openingDate || new Date().toISOString().split('T')[0];
    this.totalPremiums = Number(data.totalPremiums) || 0;
    const rawPre2017 = Number(data.pre2017Premiums) || 0;
    this.pre2017Premiums = this._isPre2017Contract(this.openingDate) ? Math.min(rawPre2017, this.totalPremiums) : 0;
    this.currentValue = Number(data.currentValue) || 0;
    this.euroFundsValue = Number(data.euroFundsValue) || 0;
  }

  isPre2017Contract(): boolean {
    return this._isPre2017Contract(this.openingDate);
  }

  _isPre2017Contract(dateString: string): boolean {
    return !!dateString && dateString < REFORM_DATE;
  }

  getContractYears(now: Date = new Date()): number {
    const opening = new Date(this.openingDate);
    let years = now.getFullYear() - opening.getFullYear();
    const monthDiff = now.getMonth() - opening.getMonth();
    const dayDiff = now.getDate() - opening.getDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      years--;
    }
    return Math.max(0, years);
  }

  getLatentGain(): number {
    return Math.max(0, this.currentValue - this.totalPremiums);
  }

  getSocialCharges(): number {
    const totalGain = this.getLatentGain();
    const euroShare = this.currentValue > 0 ? this.euroFundsValue / this.currentValue : 0;
    const ucShare = 1 - euroShare;
    const ucGain = totalGain * ucShare;
    return ucGain * UC_SOCIAL_RATE;
  }

  override getTaxableIncomes(fiscalProfile: FiscalProfile, now: Date = new Date()): PlacementIncome[] {
    const totalGain = this.getLatentGain();
    if (totalGain <= 0) {
      return [];
    }
    const euroShare = this.currentValue > 0 ? this.euroFundsValue / this.currentValue : 0;
    const ucShare = 1 - euroShare;
    const contractYears = this.getContractYears(now);
    return contractYears < 8
      ? this._computePre8YearsTaxableIncomes(fiscalProfile, totalGain, totalGain * ucShare)
      : this._computePost8YearsTaxableIncomes(fiscalProfile, totalGain, ucShare);
  }

  /**
   * Breaks down the income-tax rule actually applied to this contract, so the
   * tax explanation can describe it without duplicating the computation.
   */
  getIncomeTaxBreakdown(fiscalProfile: FiscalProfile | undefined, now: Date = new Date()): IncomeTaxBreakdown {
    const latentGain = this.getLatentGain();
    const years = this.getContractYears(now);
    const allowance = years >= 8 ? this._getAllowance(fiscalProfile) : 0;
    const taxableGain = Math.max(0, latentGain - allowance);
    const tranches = fiscalProfile?.usePfu && taxableGain > 0
      ? (years >= 8 ? this._getPfuTranchesAfter8Years(taxableGain) : [{ scope: 'all' as const, base: taxableGain, rate: PFU_BEFORE_8Y }])
      : [];
    return { latentGain, allowance, taxableGain, tranches };
  }

  _getAllowance(fiscalProfile: FiscalProfile | undefined): number {
    return MaritalStatus.isCouple(fiscalProfile?.household?.maritalStatus) ? ALLOWANCE_COUPLE : ALLOWANCE_SINGLE;
  }

  /**
   * Splits the taxable gain of a contract older than 8 years into the tranches
   * taxed at the reduced and standard PFU rates.
   */
  _getPfuTranchesAfter8Years(taxableGain: number): GainTaxTranche[] {
    const post2017Premiums = Math.max(0, this.totalPremiums - this.pre2017Premiums);
    const preShare = this.totalPremiums > 0 ? this.pre2017Premiums / this.totalPremiums : 0;
    const preTaxableGain = taxableGain * preShare;
    const postTaxableGain = taxableGain - preTaxableGain;
    const postLowGain = post2017Premiums > PREMIUM_THRESHOLD
      ? postTaxableGain * PREMIUM_THRESHOLD / post2017Premiums
      : postTaxableGain;

    const tranches: GainTaxTranche[] = [];
    if (preTaxableGain > 0) {
      tranches.push({ scope: 'pre2017', base: preTaxableGain, rate: PFU_AFTER_8Y_PRE_2017 });
    }
    if (postLowGain > 0) {
      tranches.push({ scope: 'post2017', base: postLowGain, rate: PFU_AFTER_8Y_POST_2017_LOW });
    }
    if (postTaxableGain - postLowGain > 0) {
      tranches.push({ scope: 'post2017OverCeiling', base: postTaxableGain - postLowGain, rate: PFU_AFTER_8Y_POST_2017_HIGH });
    }
    return tranches;
  }

  override getEvaluation(fiscalProfile: FiscalProfile, now: Date = new Date()): Evaluation {
    const socialCharges = this.getSocialCharges();

    return {
      grossValue: this.currentValue,
      netValueBeforeIR: this.currentValue - socialCharges,
      socialCharges,
      latentGain: this.getLatentGain(),
      imposition: this.getImposition(fiscalProfile, now)
    };
  }

  _computePre8YearsTaxableIncomes(fiscalProfile: FiscalProfile, totalGain: number, ucGain: number): PlacementIncome[] {
    if (!fiscalProfile?.usePfu) {
      return [{ assietteImposition: totalGain, deductionRevenus: ucGain }];
    }
    return [{ assietteImposition: totalGain, eligiblePfu: true, tauxSpecifique: PFU_BEFORE_8Y }];
  }

  _computePost8YearsTaxableIncomes(fiscalProfile: FiscalProfile, totalGain: number, ucShare: number): PlacementIncome[] {
    const taxableGain = Math.max(0, totalGain - this._getAllowance(fiscalProfile));
    if (taxableGain <= 0) {
      return [];
    }

    if (!fiscalProfile?.usePfu) {
      const ucTaxableGain = taxableGain * ucShare;
      return [{ assietteImposition: taxableGain, deductionRevenus: ucTaxableGain }];
    }

    return this._getPfuTranchesAfter8Years(taxableGain)
      .map(tranche => ({ assietteImposition: tranche.base, tauxSpecifique: tranche.rate }));
  }

  override toJSON(): LifeInsuranceData {
    return {
      ...super.toJSON(),
      openingDate: this.openingDate,
      totalPremiums: this.totalPremiums,
      pre2017Premiums: this.pre2017Premiums,
      currentValue: this.currentValue,
      euroFundsValue: this.euroFundsValue
    };
  }
}

const _check: PlacementModuleStatic = LifeInsuranceModule;
export default LifeInsuranceModule;
