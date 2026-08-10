import { BasePlacement } from './BasePlacement.js';
import { FISCAL_RATES } from '../fiscality/rates.js';
import { Categories } from '../core/Categories.js';
import { PeaEditor } from '../ui/editors/PeaEditor.js';

export class PeaModule extends BasePlacement {
  static DEFAULT_CATEGORY = Categories.INVESTMENTS;

  static getEditorClass() {
    return PeaEditor;
  }

  constructor(data) {
    super(data);
    this.totalDeposits = Number(data.totalDeposits) || 0;
    this.currentValue = Number(data.currentValue) || 0;
    this.openingDate = data.openingDate || new Date().toISOString().split('T')[0];
  }

  getEvaluation(fiscalProfile, now = new Date()) {
    const latentGain = Math.max(0, this.currentValue - this.totalDeposits);
    const ageInYears = Math.abs(now - new Date(this.openingDate)) / (1000 * 60 * 60 * 24 * 365.25);
    const socialCharges = latentGain * FISCAL_RATES.CSG_CRDS;

    return {
      grossValue: this.currentValue,
      netValueBeforeIR: this.currentValue - socialCharges,
      socialCharges,
      latentGain
    };
  }

  toJSON() {
    return {
      ...super.toJSON(),
      totalDeposits: this.totalDeposits,
      currentValue: this.currentValue,
      openingDate: this.openingDate
    };
  }
}
