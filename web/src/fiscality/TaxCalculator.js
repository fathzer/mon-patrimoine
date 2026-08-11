import { FISCAL_RATES } from './rates.js';

export class TaxCalculator {
  static calculateTax(profile, options) {
    //TODO A corriger (il doit manquer les déductions du revenu de la CSG déductible)
    const base = options?.assietteImposition ?? 0;
    if (base <= 0) {
      return 0;
    }

    const eligiblePfu = options?.eligiblePfu ?? false;
    const deductionRevenus = options?.deductionRevenus ?? 0;
    const tauxSpecifique = options?.tauxSpecifique;

    let taxableBase = base;
    if (deductionRevenus > 0) {
      const deduction = deductionRevenus * FISCAL_RATES.PFU_CSG_REDUCTION_RATE;
      taxableBase = Math.max(0, taxableBase - deduction);
    }

    let rate;
    if (eligiblePfu && profile?.usePfu) {
      rate = FISCAL_RATES.PFU_IR_RATE;
    } else if (tauxSpecifique != null) {
      rate = tauxSpecifique;
    } else {
      rate = profile?.tmi ?? 0;
    }

    return Math.max(0, taxableBase * rate);
  }
}
