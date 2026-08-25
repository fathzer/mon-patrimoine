import { BasePlacement } from '../../modules/BasePlacement.js';
import { Category } from '../../core/Categories.js';
import { SavingsAccountEditor } from './Editor.js';
import { SOCIAL_CONTRIBUTION_RATES } from '../../fiscality/rates.js';
import type { Evaluation, PlacementData, PlacementModuleStatic } from '../../modules/BasePlacement.js';
import type { FiscalProfile, PlacementIncome } from '../../fiscality/TaxCalculator.js';

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
