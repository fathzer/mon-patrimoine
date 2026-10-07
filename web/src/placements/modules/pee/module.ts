import { BasePlacement, Category, getSocialContributionRate } from '../../kit/v1/index.js';
import { PeeEditor } from './Editor.js';
import { getPeeTaxExplanation } from './TaxExplanation.js';
import type { Evaluation, PlacementData, PlacementModuleStatic, FiscalProfile, PlacementIncome } from '../../kit/v1/index.js';

export interface PeeData extends PlacementData {
  totalDeposits?: number;
  currentValue?: number;
  netValue?: number;
  knowsNetValue?: boolean;
}

export class PeeModule extends BasePlacement {
  static getCategory(): Category {
    return Category.INVESTMENTS;
  }

  static getLabel(): string {
    return 'PEE';
  }

  static getEditorClass() {
    return PeeEditor;
  }

  static getTaxExplanation(placement: BasePlacement, fiscalProfile: FiscalProfile): string {
    return getPeeTaxExplanation(placement as PeeModule, fiscalProfile);
  }

  totalDeposits: number;
  currentValue: number;
  netValue: number;
  knowsNetValue: boolean;

  constructor(data: PeeData) {
    super({ ...data, type: 'pee' });
    this.totalDeposits = Number(data.totalDeposits) || 0;
    this.currentValue = Number(data.currentValue) || 0;
    this.netValue = Number(data.netValue) || 0;
    this.knowsNetValue = data.knowsNetValue === true;
  }

  getLatentGain(now: Date = new Date()): number {
    if (this.knowsNetValue) {
      // Derive latent gain from the known social charges and the current rate.
      // This is an approximation since the actual rate may differ (historical rates).
      return this.getSocialCharges(now) / this.getSocialChargesRate(now);
    }
    return Math.max(0, this.currentValue - this.totalDeposits);
  }

  getSocialChargesRate(now: Date = new Date()): number {
    return getSocialContributionRate(now);
  }

  getSocialCharges(now: Date = new Date()): number {
    if (this.knowsNetValue) {
      return Math.max(0, this.currentValue - this.netValue);
    }
    return this.getLatentGain(now) * this.getSocialChargesRate(now);
  }

  override getTaxableIncomes(_fiscalProfile: FiscalProfile, _now: Date = new Date()): PlacementIncome[] {
    // Capital and gains are exempt from income tax.
    return [];
  }

  override getEvaluation(fiscalProfile: FiscalProfile, now: Date = new Date()): Evaluation {
    const socialCharges = this.getSocialCharges(now);

    return {
      grossValue: this.currentValue,
      netValueBeforeIR: this.currentValue - socialCharges,
      socialCharges,
      latentGain: this.getLatentGain(now),
      imposition: this.getImposition(fiscalProfile, now)
    };
  }

  override toJSON(): PeeData {
    return {
      ...super.toJSON(),
      totalDeposits: this.totalDeposits,
      currentValue: this.currentValue,
      netValue: this.netValue,
      knowsNetValue: this.knowsNetValue
    };
  }
}

const _check: PlacementModuleStatic = PeeModule;
export default PeeModule;
