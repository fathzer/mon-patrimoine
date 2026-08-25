import { BasePlacement } from '../../modules/BasePlacement.js';
import { Category } from '../../core/Categories.js';
import { SOCIAL_CONTRIBUTION_RATES } from '../../fiscality/rates.js';
import { CtoEditor } from './Editor.js';
import type { Evaluation, PlacementData } from '../../modules/BasePlacement.js';
import type { FiscalProfile, PlacementIncome } from '../../fiscality/TaxCalculator.js';

export interface CtoData extends PlacementData {
  acquisitionValue?: number;
  cashBalance?: number;
  currentValue?: number;
}

export class CtoModule extends BasePlacement {
  static override readonly DEFAULT_CATEGORY = Category.INVESTMENTS;

  static override getEditorClass() {
    return CtoEditor;
  }

  acquisitionValue: number;
  cashBalance: number;
  currentValue: number;

  constructor(data: CtoData) {
    super(data);
    this.acquisitionValue = Number(data.acquisitionValue) || 0;
    this.cashBalance = Number(data.cashBalance) || 0;
    this.currentValue = Number(data.currentValue) || 0;
  }

  getLatentGain(): number {
    return Math.max(0, this.currentValue - this.acquisitionValue - this.cashBalance);
  }

  getSocialChargesRate(): number {
    return SOCIAL_CONTRIBUTION_RATES.CSG_CRDS;
  }

  getSocialCharges(): number {
    return this.getLatentGain() * this.getSocialChargesRate();
  }

  override getTaxableIncomes(fiscalProfile: FiscalProfile, now: Date = new Date()): PlacementIncome[] {
    const latentGain = this.getLatentGain();
    return latentGain > 0
      ? [{ assietteImposition: latentGain, eligiblePfu: true, deductionRevenus: latentGain }]
      : [];
  }

  override getEvaluation(fiscalProfile: FiscalProfile): Evaluation {
    const socialCharges = this.getSocialCharges();

    return {
      grossValue: this.currentValue,
      netValueBeforeIR: this.currentValue - socialCharges,
      socialCharges,
      latentGain: this.getLatentGain(),
      imposition: this.getImposition(fiscalProfile)
    };
  }

  override toJSON(): CtoData {
    return {
      ...super.toJSON(),
      acquisitionValue: this.acquisitionValue,
      cashBalance: this.cashBalance,
      currentValue: this.currentValue
    };
  }
}

export default CtoModule;
