import { BasePlacement, Category, SOCIAL_CONTRIBUTION_RATES } from '../kit/v1/index.js';
import { HomeSavingsEditor } from './Editor.js';
import type { Evaluation, PlacementData, PlacementModuleStatic, FiscalProfile, PlacementIncome } from '../kit/v1/index.js';

export type HomeSavingsType = 'pel' | 'cel';

export interface HomeSavingsData extends PlacementData {
  currentValue?: number;
  interestAmount?: number;
  homeSavingsType?: HomeSavingsType;
  openingDate?: string;
  taxExempt?: boolean;
  promotionalInterest?: number;
}

export const CSG_2018_THRESHOLD = new Date('2018-01-01T00:00:00');

export class HomeSavingsModule extends BasePlacement {
  static getCategory(): Category {
    return Category.SAVING_ACCOUNTS;
  }

  static getLabel(): string {
    return 'Épargne Logement';
  }

  static getEditorClass() {
    return HomeSavingsEditor;
  }

  currentValue: number;
  interestAmount: number;
  homeSavingsType: HomeSavingsType;
  openingDate: string;
  taxExempt: boolean;
  promotionalInterest: number;

  constructor(data: HomeSavingsData) {
    super(data);
    this.currentValue = Number(data.currentValue) || 0;
    this.interestAmount = Number(data.interestAmount) || 0;
    this.homeSavingsType = data.homeSavingsType || 'pel';
    this.openingDate = data.openingDate || new Date().toISOString().split('T')[0];
    this.taxExempt = false;
    this.promotionalInterest = 0;
  }

  getTotalInterest(): number {
    return this.interestAmount + this.promotionalInterest;
  }

  _getOpeningMidnight(): Date {
    const openingDate = new Date(this.openingDate);
    return new Date(openingDate.getFullYear(), openingDate.getMonth(), openingDate.getDate());
  }

  _getNowMidnight(now: Date = new Date()): Date {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  _getTwelfthAnniversary(): Date {
    const openingMidnight = this._getOpeningMidnight();
    const twelfthAnniversary = new Date(openingMidnight);
    twelfthAnniversary.setFullYear(twelfthAnniversary.getFullYear() + 12);
    return twelfthAnniversary;
  }

  isOlderThanTwelveYears(now: Date = new Date()): boolean {
    const nowMidnight = this._getNowMidnight(now);
    const twelfthAnniversary = this._getTwelfthAnniversary();
    return nowMidnight > twelfthAnniversary;
  }

  isOpenedBefore2018(): boolean {
    return this._getOpeningMidnight() < CSG_2018_THRESHOLD;
  }

  getSocialChargesRate(now: Date = new Date()): number {
    if (this.homeSavingsType === 'cel') {
      return this.isOpenedBefore2018() ? SOCIAL_CONTRIBUTION_RATES.OLD_CSG_CRDS : SOCIAL_CONTRIBUTION_RATES.CSG_CRDS;
    }

    if (this.isOpenedBefore2018()) {
      return this.isOlderThanTwelveYears(now) ? SOCIAL_CONTRIBUTION_RATES.CSG_CRDS : SOCIAL_CONTRIBUTION_RATES.OLD_CSG_CRDS;
    }

    return SOCIAL_CONTRIBUTION_RATES.CSG_CRDS;
  }

  isPfuEligible(now: Date = new Date()): boolean {
    const nowMidnight = this._getNowMidnight(now);
    const twelfthAnniversary = this._getTwelfthAnniversary();
    return !this.isOpenedBefore2018()
      || (this.homeSavingsType === 'pel' && nowMidnight > twelfthAnniversary);
  }

  getSocialCharges(now: Date = new Date()): number {
    return this.getTotalInterest() * this.getSocialChargesRate(now);
  }

  override getTaxableIncomes(fiscalProfile: FiscalProfile, now: Date = new Date()): PlacementIncome[] {
    if (!this.isPfuEligible(now)) {
      return [];
    }
    const totalInterest = this.getTotalInterest();
    return [{ assietteImposition: totalInterest, eligiblePfu: true, deductionRevenus: totalInterest }];
  }

  override getEvaluation(fiscalProfile: FiscalProfile, now: Date = new Date()): Evaluation {
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

  override toJSON(): HomeSavingsData {
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

const _check: PlacementModuleStatic = HomeSavingsModule;
export default HomeSavingsModule;
