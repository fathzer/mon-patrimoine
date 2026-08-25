import { BasePlacement, Category, SOCIAL_CONTRIBUTION_RATES } from '../kit/v1/index.js';
import { PeaEditor } from './Editor.js';
import type { Evaluation, PlacementData, PlacementModuleStatic, FiscalProfile, PlacementIncome } from '../kit/v1/index.js';

export interface PeaData extends PlacementData {
  totalDeposits?: number;
  currentValue?: number;
  openingDate?: string;
}

export class PeaModule extends BasePlacement {
  static getCategory(): Category {
    return Category.INVESTMENTS;
  }

  static getLabel(): string {
    return 'PEA';
  }

  static getEditorClass() {
    return PeaEditor;
  }

  totalDeposits: number;
  currentValue: number;
  openingDate: string;

  constructor(data: PeaData) {
    super(data);
    this.totalDeposits = Number(data.totalDeposits) || 0;
    this.currentValue = Number(data.currentValue) || 0;
    this.openingDate = data.openingDate || new Date().toISOString().split('T')[0];
  }

  getHoldingYears(now: Date = new Date()): number {
    const opening = new Date(this.openingDate);
    let years = now.getFullYear() - opening.getFullYear();
    const monthDiff = now.getMonth() - opening.getMonth();
    const dayDiff = now.getDate() - opening.getDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      years--;
    }
    return Math.max(0, years);
  }

  isExemptFromIncomeTax(now: Date = new Date()): boolean {
    return this.getHoldingYears(now) >= 5;
  }

  isPre2018(): boolean {
    return !!this.openingDate && this.openingDate < '2018-01-01';
  }

  getLatentGain(): number {
    return Math.max(0, this.currentValue - this.totalDeposits);
  }

  getSocialChargesRate(): number {
    return SOCIAL_CONTRIBUTION_RATES.CSG_CRDS;
  }

  getSocialCharges(): number {
    return this.getLatentGain() * this.getSocialChargesRate();
  }

  override getTaxableIncomes(fiscalProfile: FiscalProfile, now: Date = new Date()): PlacementIncome[] {
    if (this.isExemptFromIncomeTax(now)) {
      return [];
    }
    const latentGain = this.getLatentGain();
    return [{ assietteImposition: latentGain, eligiblePfu: true, deductionRevenus: latentGain }];
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

  override toJSON(): PeaData {
    return {
      ...super.toJSON(),
      totalDeposits: this.totalDeposits,
      currentValue: this.currentValue,
      openingDate: this.openingDate
    };
  }
}

const _check: PlacementModuleStatic = PeaModule;
export default PeaModule;
