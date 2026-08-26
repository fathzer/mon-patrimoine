import { BasePlacement, Category, SOCIAL_CONTRIBUTION_RATES } from '../../kit/v1/index.js';
import { SavingsAccountEditor } from './Editor.js';
import type { Evaluation, PlacementData, PlacementModuleStatic, FiscalProfile, PlacementIncome } from '../../kit/v1/index.js';

export interface SavingsAccountData extends PlacementData {
  currentValue?: number;
  interestAmount?: number;
  taxExempt?: boolean;
  promotionalInterest?: number;
}

export class SavingsAccountModule extends BasePlacement {
  static getCategory(): Category {
    return Category.SAVING_ACCOUNTS;
  }

  static getLabel(): string {
    return 'Livret';
  }

  static getEditorClass() {
    return SavingsAccountEditor;
  }

  currentValue: number;
  interestAmount: number;
  taxExempt: boolean;
  promotionalInterest: number;

  constructor(data: SavingsAccountData) {
    super(data);
    this.currentValue = Number(data.currentValue) || 0;
    this.interestAmount = Number(data.interestAmount) || 0;
    this.taxExempt = data.taxExempt !== false;
    this.promotionalInterest = this.taxExempt ? 0 : (Number(data.promotionalInterest) || 0);
  }

  getTotalInterest(): number {
    return this.interestAmount + this.promotionalInterest;
  }

  getSocialChargesRate(): number {
    return SOCIAL_CONTRIBUTION_RATES.CSG_CRDS;
  }

  getSocialCharges(): number {
    return this.taxExempt ? 0 : this.getTotalInterest() * this.getSocialChargesRate();
  }

  override getTaxableIncomes(fiscalProfile: FiscalProfile, now: Date = new Date()): PlacementIncome[] {
    if (this.taxExempt) {
      return [];
    }
    const totalInterest = this.getTotalInterest();
    return [{ assietteImposition: totalInterest, eligiblePfu: true, deductionRevenus: totalInterest }];
  }

  override getEvaluation(fiscalProfile: FiscalProfile, now: Date = new Date()): Evaluation {
    const totalInterest = this.getTotalInterest();
    const grossValue = this.currentValue + totalInterest;
    const socialCharges = this.getSocialCharges();

    return {
      grossValue,
      netValueBeforeIR: grossValue - socialCharges,
      socialCharges,
      latentGain: totalInterest,
      imposition: this.getImposition(fiscalProfile)
    };
  }

  override toJSON(): SavingsAccountData {
    return {
      ...super.toJSON(),
      currentValue: this.currentValue,
      interestAmount: this.interestAmount,
      promotionalInterest: this.promotionalInterest,
      taxExempt: this.taxExempt
    };
  }
}

const _check: PlacementModuleStatic = SavingsAccountModule;
export default SavingsAccountModule;
