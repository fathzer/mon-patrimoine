import { BasePlacement, Category, getSocialContributionRate } from '../../kit/v1/index.js';
import { CtoEditor } from './Editor.js';
import { getCtoTaxExplanation } from './TaxExplanation.js';
import type { Evaluation, PlacementData, PlacementModuleStatic, FiscalProfile, PlacementIncome } from '../../kit/v1/index.js';

export interface CtoData extends PlacementData {
  acquisitionValue?: number;
  cashBalance?: number;
  currentValue?: number;
}

export class CtoModule extends BasePlacement {
  static getCategory(): Category {
    return Category.INVESTMENTS;
  }

  static getLabel(): string {
    return 'Compte-Titres Ordinaire';
  }

  static getEditorClass() {
    return CtoEditor;
  }

  static getTaxExplanation(placement: BasePlacement, fiscalProfile: FiscalProfile): string {
    return getCtoTaxExplanation(placement as CtoModule, fiscalProfile);
  }

  acquisitionValue: number;
  cashBalance: number;
  currentValue: number;

  constructor(data: CtoData) {
    super({ ...data, type: 'cto' });
    this.acquisitionValue = Number(data.acquisitionValue) || 0;
    this.cashBalance = Number(data.cashBalance) || 0;
    this.currentValue = Number(data.currentValue) || 0;
  }

  getLatentGain(): number {
    return Math.max(0, this.currentValue - this.acquisitionValue - this.cashBalance);
  }

  getSocialChargesRate(now: Date = new Date()): number {
    return getSocialContributionRate(now);
  }

  getSocialCharges(now: Date = new Date()): number {
    return this.getLatentGain() * this.getSocialChargesRate(now);
  }

  override getTaxableIncomes(fiscalProfile: FiscalProfile, now: Date = new Date()): PlacementIncome[] {
    const latentGain = this.getLatentGain();
    return latentGain > 0
      ? [{ assietteImposition: latentGain, eligiblePfu: true, deductionRevenus: latentGain }]
      : [];
  }

  override getEvaluation(fiscalProfile: FiscalProfile, now: Date = new Date()): Evaluation {
    const socialCharges = this.getSocialCharges(now);

    return {
      grossValue: this.currentValue,
      netValueBeforeIR: this.currentValue - socialCharges,
      socialCharges,
      latentGain: this.getLatentGain(),
      imposition: this.getImposition(fiscalProfile, now)
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

const _check: PlacementModuleStatic = CtoModule;
export default CtoModule;
