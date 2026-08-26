import { BasePlacement, Category } from '../../kit/v1/index.js';
import { CheckingAccountEditor } from './Editor.js';
import type { Evaluation, PlacementData, PlacementModuleStatic, FiscalProfile, PlacementIncome } from '../../kit/v1/index.js';

export interface CheckingAccountData extends PlacementData {
  currentValue?: number;
  cardBalance?: number;
}

export class CheckingAccountModule extends BasePlacement {
  static getCategory(): Category {
    return Category.BANK_ACCOUNTS;
  }

  static getLabel(): string {
    return 'Compte Courant';
  }

  static getEditorClass() {
    return CheckingAccountEditor;
  }

  static getTaxExplanation(_placement: BasePlacement, _fiscalProfile: FiscalProfile): string {
    return '';
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

const _check: PlacementModuleStatic = CheckingAccountModule;
export default CheckingAccountModule;
