import { FISCAL_RATES } from './rates.js';

export class TaxCalculator {
  static calculateTax(profile, options) {
    //TODO A corriger (Tout est faux dans le cas hors PFU, en plus il doit manquer les déductions du revenu de la CSG déductible)
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
      const { tmi } = this.computeFiscalMetrics(profile);
      rate = tmi;
    }

    return Math.max(0, taxableBase * rate);
  }

  static computeFiscalMetrics(profile) {
    const childrenCount = profile?.household?.childrenCount ?? 0;
    const alternateChildrenCount = profile?.household?.alternateChildrenCount ?? 0;
    const isSingleParent = profile?.household?.isSingleParent ?? false;
    const parentsParts = this._getParentsParts(profile?.household?.maritalStatus);
    const taxableIncome = Number.isFinite(profile?.taxableIncome) ? profile.taxableIncome : 0;

    const equivalentChildren = childrenCount + alternateChildrenCount * FISCAL_RATES.EXTRA_PARTS.CHILD;
    const childParts = this._computeChildParts(equivalentChildren);
    const { bonus, discount } = this._computeSingleParentAdjustment(childrenCount, alternateChildrenCount, isSingleParent);
    const parts = parentsParts + childParts + bonus;
    const tmi = this._computeTmi(taxableIncome, parts);

    const halfPartReductionCeiling = childParts * 2 * FISCAL_RATES.EXTRA_PARTS.CEILING.CHILD + discount;

    return { parts, halfPartReductionCeiling, tmi };
  }

  static computeRawTax(taxableIncome, parts) {
    if (parts <= 0 || taxableIncome <= 0) {
      return { rawTax: 0, tmi: 0 };
    }
    const incomePerPart = taxableIncome / parts;
    let taxPerPart = 0;
    let previousLimit = 0;
    let tmi = 0;
    for (const bracket of FISCAL_RATES.INCOME_TAX_BRACKETS) {
      if (incomePerPart <= previousLimit) {
        break;
      }
      const bracketTaxable = Math.min(incomePerPart, bracket.limit) - previousLimit;
      if (bracketTaxable > 0) {
        taxPerPart += bracketTaxable * bracket.rate;
        tmi = bracket.rate;
      }
      previousLimit = bracket.limit;
    }
    return { rawTax: taxPerPart * parts, tmi };
  }

  static computeFinalTax(taxableIncome, maritalStatus, extraParts, reductionCeiling) {
    const parentsParts = this._getParentsParts(maritalStatus);
    const totalParts = parentsParts + extraParts;
    const withExtra = this.computeRawTax(taxableIncome, totalParts);
    const withoutExtra = this.computeRawTax(taxableIncome, parentsParts);
    const cappedRaw = withoutExtra.rawTax - reductionCeiling;
    const selected = withExtra.rawTax >= cappedRaw ? withExtra : { rawTax: cappedRaw, tmi: withoutExtra.tmi };
    const rawTax = selected.rawTax;
    const tmi = selected.tmi;
    const decoteLimit = maritalStatus === 'married'
      ? FISCAL_RATES.DECOTE.limit_couple
      : FISCAL_RATES.DECOTE.limit_single;
    const decote = Math.round(Math.max(0, decoteLimit - FISCAL_RATES.DECOTE.rate * rawTax));
    const finalTax = Math.round(Math.max(0, rawTax - decote));
    const extraPartsBenefit = Math.max(0, withoutExtra.rawTax - rawTax);
    return { finalTax, decote, tmi, extraPartsBenefit };
  }

  static _getParentsParts(maritalStatus) {
    return maritalStatus === 'married' ? 2 : 1;
  }

  static _computeChildParts(equivalentChildren) {
    const childPart = FISCAL_RATES.EXTRA_PARTS.CHILD;
    if (equivalentChildren <= 2) {
      return equivalentChildren * childPart;
    }
    const firstTwoParts = 2 * childPart;
    return firstTwoParts + (equivalentChildren - 2) * firstTwoParts;
  }

  static _computeSingleParentAdjustment(childrenCount, alternateChildrenCount, isSingleParent) {
    const { CHILD, CEILING } = FISCAL_RATES.EXTRA_PARTS;
    if (!isSingleParent) {
      return { bonus: 0, discount: 0 };
    }
    if (childrenCount > 0) {
      const bonus = CHILD;
      return { bonus, discount: bonus * 2 * CEILING.SINGLE_PARENT };
    }
    if (alternateChildrenCount > 0) {
      const bonus = CHILD / 2;
      return { bonus, discount: bonus * 2 * CEILING.SINGLE_PARENT };
    }
    return { bonus: 0, discount: 0 };
  }

  static _computeTmi(taxableIncome, parts) {
    if (parts <= 0 || taxableIncome <= 0) {
      return 0;
    }
    const incomePerPart = taxableIncome / parts;
    for (const bracket of FISCAL_RATES.INCOME_TAX_BRACKETS) {
      if (incomePerPart <= bracket.limit) {
        return bracket.rate;
      }
    }
    return 0;
  }
}
