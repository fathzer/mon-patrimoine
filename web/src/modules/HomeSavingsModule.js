import { SavingsAccountBaseModule } from './SavingsAccountBaseModule.js';
import { HomeSavingsEditor } from '../ui/editors/HomeSavingsEditor.js';
import { FISCAL_RATES } from '../fiscality/rates.js';

const CSG_2018_THRESHOLD = new Date('2018-01-01T00:00:00');

export class HomeSavingsModule extends SavingsAccountBaseModule {
  static getEditorClass() {
    return HomeSavingsEditor;
  }

  constructor(data) {
    super(data);
    this.homeSavingsType = data.homeSavingsType || 'pel';
    this.openingDate = data.openingDate || new Date().toISOString().split('T')[0];
    this.taxExempt = false;
    this.promotionalInterest = 0;
  }

  getEvaluation(fiscalProfile, now = new Date()) {
    const totalInterest = this.interestAmount + this.promotionalInterest;
    const grossValue = this.currentValue + totalInterest;
    const socialRate = this._getSocialChargesRate(now);
    const socialCharges = totalInterest * socialRate;

    return {
      grossValue,
      netValueBeforeIR: grossValue - socialCharges,
      socialCharges,
      latentGain: totalInterest
    };
  }

  _getSocialChargesRate(now) {
    const openingDate = new Date(this.openingDate);
    const openingMidnight = new Date(openingDate.getFullYear(), openingDate.getMonth(), openingDate.getDate());

    if (this.homeSavingsType === 'cel') {
      return openingMidnight < CSG_2018_THRESHOLD ? FISCAL_RATES.OLD_CSG_CRDS : FISCAL_RATES.CSG_CRDS;
    }

    if (openingMidnight >= CSG_2018_THRESHOLD) {
      return FISCAL_RATES.CSG_CRDS;
    }

    const twelfthAnniversary = new Date(openingMidnight);
    twelfthAnniversary.setFullYear(twelfthAnniversary.getFullYear() + 12);
    const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return nowMidnight <= twelfthAnniversary ? FISCAL_RATES.OLD_CSG_CRDS : FISCAL_RATES.CSG_CRDS;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      homeSavingsType: this.homeSavingsType,
      openingDate: this.openingDate
    };
  }
}
