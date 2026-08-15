import { BasePlacement } from './BasePlacement.js';
import { Categories } from '../core/Categories.js';
import { FISCAL_RATES } from '../fiscality/rates.js';
import { TaxCalculator } from '../fiscality/TaxCalculator.js';
import { LifeInsuranceEditor } from '../ui/editors/LifeInsuranceEditor.js';

const REFORM_DATE = '2017-09-27';
export const UC_SOCIAL_RATE = FISCAL_RATES.OLD_CSG_CRDS;
export const PFU_BEFORE_8Y = FISCAL_RATES.PFU_IR_RATE;
export const PFU_AFTER_8Y_PRE_2017 = 0.075;
const PFU_AFTER_8Y_POST_2017_LOW = 0.075;
const PFU_AFTER_8Y_POST_2017_HIGH = 0.128;
export const PREMIUM_THRESHOLD = 150000;
export const ALLOWANCE_SINGLE = 4600;
export const ALLOWANCE_COUPLE = 9200;
const COUPLE_STATUSES = new Set(['married', 'pacsed']);

export class LifeInsuranceModule extends BasePlacement {
  static DEFAULT_CATEGORY = Categories.LIFE_INSURANCE;

  static getEditorClass() {
    return LifeInsuranceEditor;
  }

  constructor(data) {
    super(data);
    this.openingDate = data.openingDate || new Date().toISOString().split('T')[0];
    this.totalPremiums = Number(data.totalPremiums) || 0;
    const rawPre2017 = Number(data.pre2017Premiums) || 0;
    this.pre2017Premiums = this._isPre2017Contract(this.openingDate) ? Math.min(rawPre2017, this.totalPremiums) : 0;
    this.currentValue = Number(data.currentValue) || 0;
    this.euroFundsValue = Number(data.euroFundsValue) || 0;
  }

  isPre2017Contract() {
    return this._isPre2017Contract(this.openingDate);
  }

  _isPre2017Contract(dateString) {
    return dateString && dateString < REFORM_DATE;
  }

  getContractYears(now = new Date()) {
    const opening = new Date(this.openingDate);
    let years = now.getFullYear() - opening.getFullYear();
    const monthDiff = now.getMonth() - opening.getMonth();
    const dayDiff = now.getDate() - opening.getDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      years--;
    }
    return Math.max(0, years);
  }

  getLatentGain() {
    return Math.max(0, this.currentValue - this.totalPremiums);
  }

  getSocialCharges() {
    const totalGain = this.getLatentGain();
    const euroShare = this.currentValue > 0 ? this.euroFundsValue / this.currentValue : 0;
    const ucShare = 1 - euroShare;
    const ucGain = totalGain * ucShare;
    return ucGain * UC_SOCIAL_RATE;
  }

  getImposition(fiscalProfile, now = new Date()) {
    const totalGain = this.getLatentGain();
    if (totalGain <= 0) {
      return 0;
    }
    const euroShare = this.currentValue > 0 ? this.euroFundsValue / this.currentValue : 0;
    const ucShare = 1 - euroShare;
    const preShare = this.totalPremiums > 0 ? this.pre2017Premiums / this.totalPremiums : 0;
    const postShare = 1 - preShare;
    const contractYears = this.getContractYears(now);
    return contractYears < 8
      ? this._computePre8YearsImposition(fiscalProfile, totalGain, totalGain * ucShare)
      : this._computePost8YearsImposition(fiscalProfile, totalGain, ucShare, preShare, postShare);
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

  _computePre8YearsImposition(fiscalProfile, totalGain, ucGain) {
    if (!fiscalProfile?.usePfu) {
      return TaxCalculator.calculateTax(fiscalProfile, { assietteImposition: totalGain, deductionRevenus: ucGain });
    }
    return totalGain * PFU_BEFORE_8Y;
  }

  _computePost8YearsImposition(fiscalProfile, totalGain, ucShare, preShare, postShare) {
    const isCouple = COUPLE_STATUSES.has(fiscalProfile?.maritalStatus);
    const allowance = isCouple ? ALLOWANCE_COUPLE : ALLOWANCE_SINGLE;
    const taxableGain = Math.max(0, totalGain - allowance);
    if (taxableGain <= 0) {
      return 0;
    }

    if (!fiscalProfile?.usePfu) {
      const ucTaxableGain = taxableGain * ucShare;
      return TaxCalculator.calculateTax(fiscalProfile, { assietteImposition: taxableGain, deductionRevenus: ucTaxableGain });
    }

    const post2017Premiums = Math.max(0, this.totalPremiums - this.pre2017Premiums);
    const preTaxableGain = taxableGain * preShare;
    const postTaxableGain = taxableGain * postShare;
    const preImposition = preTaxableGain * PFU_AFTER_8Y_PRE_2017;

    let postImposition;
    if (post2017Premiums <= PREMIUM_THRESHOLD) {
      postImposition = postTaxableGain * PFU_AFTER_8Y_POST_2017_LOW;
    } else {
      const firstFraction = Math.min(1, PREMIUM_THRESHOLD / post2017Premiums);
      const postGainFirst = postTaxableGain * firstFraction;
      const postGainRest = postTaxableGain - postGainFirst;
      postImposition = postGainFirst * PFU_AFTER_8Y_POST_2017_LOW + postGainRest * PFU_AFTER_8Y_POST_2017_HIGH;
    }

    return preImposition + postImposition;
  }

  toJSON() {
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
