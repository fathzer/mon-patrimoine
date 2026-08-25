import { BasePlacement } from './BasePlacement.js';
import { Category } from '../core/Categories.js';
import { CheckingAccountEditor } from '../ui/editors/CheckingAccountEditor.js';
import type { Evaluation, PlacementData } from './BasePlacement.js';
import type { FiscalProfile, PlacementIncome } from '../fiscality/TaxCalculator.js';

export interface CheckingAccountData extends PlacementData {
  currentValue?: number;
  cardBalance?: number;
}

export class CheckingAccountModule extends BasePlacement {
  static override readonly DEFAULT_CATEGORY = Category.BANK_ACCOUNTS;

  static override getEditorClass() {
    return CheckingAccountEditor;
  }

  currentValue: number;
  cardBalance: number;

  constructor(data: CheckingAccountData) {
    super(data);
    this.currentValue = Number(data.currentValue) || 0;
    this.cardBalance = Number(data.cardBalance) || 0;
  }

  override getEvaluation(fiscalProfile: FiscalProfile, now: Date = new Date()): Evaluation {
    const grossValue = this.currentValue - this.cardBalance;
    return {
      grossValue: grossValue,
      netValueBeforeIR: grossValue,
      socialCharges: 0,
      latentGain: 0,
      imposition: this.getImposition(fiscalProfile, now)
    };
  }

  override getTaxableIncomes(fiscalProfile: FiscalProfile, now: Date = new Date()): PlacementIncome[] {
    return [];
  }

  override toJSON(): CheckingAccountData {
    return {
      ...super.toJSON(),
      currentValue: this.currentValue,
      cardBalance: this.cardBalance
    };
  }
}
