import { BasePlacement, Category, FISCAL_RATES, SOCIAL_CONTRIBUTION_RATES } from '../kit/v1/index.js';
import { LifeInsuranceEditor } from './Editor.js';
import type { Evaluation, PlacementData, PlacementModuleStatic, FiscalProfile, PlacementIncome } from '../kit/v1/index.js';

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
const PFU_AFTER_8Y_POST_2017_HIGH = 0.128;
export const PREMIUM_THRESHOLD = 150000;
export const ALLOWANCE_SINGLE = 4600;
export const ALLOWANCE_COUPLE = 9200;
const COUPLE_STATUSES = new Set(['married', 'pacsed']);

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

  openingDate: string;
  totalPremiums: number;
  pre2017Premiums: number;
  currentValue: number;
  euroFundsValue: number;

  constructor(data: LifeInsuranceData) {
    super(data);
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
    const preShare = this.totalPremiums > 0 ? this.pre2017Premiums / this.totalPremiums : 0;
    const postShare = 1 - preShare;
    const contractYears = this.getContractYears(now);
    return contractYears < 8
      ? this._computePre8YearsTaxableIncomes(fiscalProfile, totalGain, totalGain * ucShare)
      : this._computePost8YearsTaxableIncomes(fiscalProfile, totalGain, ucShare, preShare, postShare);
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

  _computePost8YearsTaxableIncomes(fiscalProfile: FiscalProfile, totalGain: number, ucShare: number, preShare: number, postShare: number): PlacementIncome[] {
    const isCouple = COUPLE_STATUSES.has(fiscalProfile?.household?.maritalStatus ?? '');
    const allowance = isCouple ? ALLOWANCE_COUPLE : ALLOWANCE_SINGLE;
    const taxableGain = Math.max(0, totalGain - allowance);
    if (taxableGain <= 0) {
      return [];
    }

    if (!fiscalProfile?.usePfu) {
      const ucTaxableGain = taxableGain * ucShare;
      return [{ assietteImposition: taxableGain, deductionRevenus: ucTaxableGain }];
    }

    const post2017Premiums = Math.max(0, this.totalPremiums - this.pre2017Premiums);
    const preTaxableGain = taxableGain * preShare;
    const postTaxableGain = taxableGain * postShare;
    const preIncome: PlacementIncome = { assietteImposition: preTaxableGain, tauxSpecifique: PFU_AFTER_8Y_PRE_2017 };

    if (post2017Premiums <= PREMIUM_THRESHOLD) {
      const postIncome: PlacementIncome = { assietteImposition: postTaxableGain, tauxSpecifique: PFU_AFTER_8Y_POST_2017_LOW };
      return [preIncome, postIncome];
    }

    const firstFraction = Math.min(1, PREMIUM_THRESHOLD / post2017Premiums);
    const postGainFirst = postTaxableGain * firstFraction;
    const postGainRest = postTaxableGain - postGainFirst;
    const postIncomeLow: PlacementIncome = { assietteImposition: postGainFirst, tauxSpecifique: PFU_AFTER_8Y_POST_2017_LOW };
    const postIncomeHigh: PlacementIncome = { assietteImposition: postGainRest, tauxSpecifique: PFU_AFTER_8Y_POST_2017_HIGH };
    return [preIncome, postIncomeLow, postIncomeHigh];
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
