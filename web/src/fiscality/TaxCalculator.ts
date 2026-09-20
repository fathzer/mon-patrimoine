import { FISCAL_RATES } from './rates.js';
import type { Household, HouseholdLike, MaritalStatus } from './Household.js';

export interface FiscalProfile {
  household: Household;
  taxableIncome: number;
  usePfu?: boolean;
}

export interface FiscalMetricsInput {
  household: HouseholdLike;
  taxableIncome?: number;
}

export interface PlacementIncome {
  assietteImposition: number;
  eligiblePfu?: boolean;
  deductionRevenus?: number;
  tauxSpecifique?: number;
}

export interface FiscalMetrics {
  parts: number;
  halfPartReductionCeiling: number;
  tmi: number;
}

export interface RawTaxResult {
  rawTax: number;
  tmi: number;
}

export interface FinalTaxResult {
  finalTax: number;
  decote: number;
  tmi: number;
  extraPartsBenefit: number;
}

export interface IncomeProcessingDelta {
  flatTaxDelta: number;
  rniDelta: number;
}

export interface ChildrenImpact {
  extraParts: number;
  ceiling: number;
}

/**
 * Computes income tax and family fiscal metrics for French households.
 */
export class TaxCalculator {
  /**
   * Computes global income tax across multiple incomes. Not implemented yet.
   */
  static calculateGobalTax(profile: FiscalProfile | undefined, ...incomes: PlacementIncome[]): number {
    let tax = 0;

    for (const income of incomes) {
      const base = income?.assietteImposition ?? 0;
      if (base <= 0) {
        continue;
      }
      // TODO: implement per-income tax and aggregate it
    }

    return tax;
  }

  /**
   * Computes the tax impact and RNI delta for a single placement income.
   * @private
   */
  private static _processPlacementIncome(profile: FiscalProfile | undefined, income: PlacementIncome): IncomeProcessingDelta {
    if (!Number.isFinite(income.assietteImposition)) {
      throw new TypeError('income.assietteImposition must be a number');
    }
    const base = income.assietteImposition;
    if (base <= 0) {
      return { flatTaxDelta: 0, rniDelta: 0 };
    }

    if (income?.eligiblePfu) {
      if (profile?.usePfu) {
        const rate = income?.tauxSpecifique ?? FISCAL_RATES.PFU_IR_RATE;
        return { flatTaxDelta: base * rate, rniDelta: 0 };
      }
      return { flatTaxDelta: 0, rniDelta: base };
    }

    const deduction = (income?.deductionRevenus ?? 0) * FISCAL_RATES.PFU_CSG_REDUCTION_RATE;
    if (income?.tauxSpecifique != null) {
      return { flatTaxDelta: base * income.tauxSpecifique, rniDelta: -deduction };
    }
    return { flatTaxDelta: 0, rniDelta: base - deduction };
  }

  /**
   * Computes the total tax due on a list of placement incomes.
   * PFU-eligible incomes are taxed at the flat rate when the profile opts for the PFU.
   * Other incomes are aggregated into a modified taxable income, and the progressive
   * tax difference between this new base and the original RNI is added to the flat tax.
   */
  static calculatePlacementTax(profile: FiscalProfile, incomes: PlacementIncome[]): number {
    if (!Array.isArray(incomes)) {
      throw new TypeError('incomes must be an array of PlacementIncome');
    }
    if (!Number.isFinite(profile?.taxableIncome)) {
      throw new TypeError('profile.taxableIncome must be a number');
    }
    if (incomes.length === 0) {
      return 0;
    }

    const rni = profile.taxableIncome;
    let flatTax = 0;
    let modifiedRni = rni;

    for (const income of incomes) {
      const { flatTaxDelta, rniDelta } = this._processPlacementIncome(profile, income);
      flatTax += flatTaxDelta;
      modifiedRni += rniDelta;
    }

    if (modifiedRni !== rni) {
      const fiscalMetrics = this.computeFiscalMetrics(profile);
      const taxOnModified = this.computeRawTax(modifiedRni, fiscalMetrics.parts).rawTax;
      const taxOnRni = this.computeRawTax(rni, fiscalMetrics.parts).rawTax;
      flatTax += taxOnModified - taxOnRni;
    }

    return Math.max(0, flatTax);
  }

  /**
   * Computes tax for a specific placement income using the chosen tax mode.
   */
  static calculateTax(profile: FiscalProfile | undefined, income: PlacementIncome): number {
    const base = income?.assietteImposition ?? 0;
    if (base <= 0) {
      return 0;
    }

    const eligiblePfu = income?.eligiblePfu ?? false;
    const deductionRevenus = income?.deductionRevenus ?? 0;
    const tauxSpecifique = income?.tauxSpecifique;

    let taxableBase = base;
    if (deductionRevenus > 0) {
      const deduction = deductionRevenus * FISCAL_RATES.PFU_CSG_REDUCTION_RATE;
      taxableBase = Math.max(0, taxableBase - deduction);
    }

    let rate = -1;
    if (eligiblePfu && profile?.usePfu) {
      rate = tauxSpecifique ?? FISCAL_RATES.PFU_IR_RATE;
    } else if (tauxSpecifique != null) {
      rate = tauxSpecifique;
    }

    if (rate > 0) {
      return Math.max(0, taxableBase * rate);
    }
    // TODO: A corriger (Tout est faux dans le cas hors PFU, en plus il doit manquer les déductions du revenu de la CSG déductible)

    const { tmi } = this.computeFiscalMetrics(profile as FiscalProfile);
    return taxableBase * tmi;
  }

  /**
   * Computes the fiscal metrics displayed in the UI.
   */
  static computeFiscalMetrics(profile: FiscalMetricsInput | undefined): FiscalMetrics {
    const household = profile?.household;
    const taxableIncome = Number.isFinite(profile?.taxableIncome) ? (profile as FiscalMetricsInput).taxableIncome! : 0;
    const parentsParts = this._getParentsParts(household?.maritalStatus);
    const { extraParts, ceiling } = this._computeChildrenImpact(household);
    const parts = parentsParts + extraParts;
    const tmi = this._computeTmi(taxableIncome, parts);

    return { parts, halfPartReductionCeiling: ceiling, tmi };
  }

  /**
   * Computes raw income tax for a given taxable income and number of parts.
   */
  static computeRawTax(taxableIncome: number, parts: number): RawTaxResult {
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

  /**
   * Convenience method to compute the final tax from a Household and a net taxable income.
   */
  static calculate(household: Household, rni: number, year: number = new Date().getFullYear()): FinalTaxResult {
    if (!household || !Number.isFinite(rni)) {
      throw new Error('Household and RNI are required');
    }
    const fiscalMetrics = this.computeFiscalMetrics({ household, taxableIncome: rni });
    const parentsParts = this._getParentsParts(household.maritalStatus);
    const extraParts = fiscalMetrics.parts - parentsParts;
    return this.computeFinalTax(rni, household.maritalStatus, extraParts, fiscalMetrics.halfPartReductionCeiling);
  }

  /**
   * Computes the final tax including extra parts cap and decote.
   */
  static computeFinalTax(taxableIncome: number, maritalStatus: MaritalStatus, extraParts: number, reductionCeiling: number): FinalTaxResult {
    const parentsParts = this._getParentsParts(maritalStatus);
    const totalParts = parentsParts + extraParts;
    const withExtra = this.computeRawTax(taxableIncome, totalParts);
    const withoutExtra = this.computeRawTax(taxableIncome, parentsParts);
    const cappedRaw = Math.max(0, withoutExtra.rawTax - reductionCeiling);
    const selected = withExtra.rawTax >= cappedRaw ? withExtra : { rawTax: cappedRaw, tmi: withoutExtra.tmi };
    const rawTax = selected.rawTax;
    const tmi = selected.tmi;
    const decote = this._computeDecote(rawTax, maritalStatus);
    const finalTax = Math.round(Math.max(0, rawTax - decote));
    const extraPartsBenefit = Math.max(0, withoutExtra.rawTax - rawTax);
    return { finalTax, decote, tmi, extraPartsBenefit };
  }

  /**
   * Returns the number of parent-only fiscal parts.
   * @returns 1 for single, 2 for married
   */
  private static _getParentsParts(maritalStatus: MaritalStatus | undefined): number {
    return maritalStatus === 'married' ? 2 : 1;
  }

  /**
   * Computes the extra parts and reduction ceiling generated by children.
   */
  private static _computeChildrenImpact(household: HouseholdLike | undefined): ChildrenImpact {
    const maritalStatus = household?.maritalStatus ?? 'single';
    const childrenCount = household?.childrenCount ?? 0;
    const alternateChildrenCount = household?.alternateChildrenCount ?? 0;
    const totalChildren = childrenCount + alternateChildrenCount;

    const childParts = this._computeChildrenParts(childrenCount, totalChildren);

    // Widowed taxpayers with dependent children keep the deceased spouse's part.
    const widowParts = maritalStatus === 'widowed' && totalChildren > 0 ? 1 : 0;

    const statusParts = this._computeStatusParts(household, maritalStatus, childrenCount, alternateChildrenCount);
    const extraParts = childParts + widowParts + statusParts;
    const ceiling = this._computeReductionCeiling(household, maritalStatus, childrenCount, extraParts);
    return { extraParts, ceiling };
  }

  /**
   * Computes the parts granted by children: the first two grant 0.5 part each,
   * subsequent children grant 1 part. An alternated child receives half of the
   * part it would have as exclusive. Exclusive children are counted first.
   */
  private static _computeChildrenParts(childrenCount: number, totalChildren: number): number {
    let childParts = 0;
    for (let i = 1; i <= totalChildren; i += 1) {
      const isAlternate = i > childrenCount;
      const fullPart = i <= 2 ? 0.5 : 1;
      childParts += isAlternate ? fullPart / 2 : fullPart;
    }
    return childParts;
  }

  /**
   * Computes the extra parts granted by the household situation, mirroring the
   * OpenFisca nbptr formula: single parent (case T), invalidity/veteran cases
   * (P, F, W, S, G) and case L.
   */
  private static _computeStatusParts(
    household: HouseholdLike | undefined,
    maritalStatus: MaritalStatus,
    childrenCount: number,
    alternateChildrenCount: number
  ): number {
    if (maritalStatus === 'married') {
      return this._computeCoupleCaseParts(household);
    }
    return this._computeLoneAdultCaseParts(household, childrenCount + alternateChildrenCount)
      + this._computeSingleParentPart(household, maritalStatus, childrenCount, alternateChildrenCount);
  }

  /**
   * Computes the invalidity/veteran half parts for a married or civil union
   * couple (OpenFisca n4). Each spouse's invalidity grants a cumulative half
   * part (cases P and F); veteran cases (W, S) grant a single half part, and
   * the two groups never add up: the household gets the better of the two.
   */
  private static _computeCoupleCaseParts(household: HouseholdLike | undefined): number {
    const caseP = household?.caseP ?? false;
    const caseF = household?.caseF ?? false;
    const invalidityHalfParts = (caseP ? 1 : 0) + (caseF ? 1 : 0);
    const veteranHalfParts = (household?.caseW ?? false) || (household?.caseS ?? false) ? 1 : 0;
    return Math.max(invalidityHalfParts, veteranHalfParts) * FISCAL_RATES.EXTRA_PARTS.CHILD;
  }

  /**
   * Computes the invalidity/veteran half part for a single or widowed
   * declarant (OpenFisca n3 and n6). With dependents, only the declarant's
   * invalidity (case P) grants a half part; without dependents, cases P/W/G
   * and case L are mutually exclusive and grant a single half part at most.
   */
  private static _computeLoneAdultCaseParts(household: HouseholdLike | undefined, totalChildren: number): number {
    const halfPart = FISCAL_RATES.EXTRA_PARTS.CHILD;
    const caseP = household?.caseP ?? false;
    if (totalChildren > 0) {
      return caseP ? halfPart : 0;
    }
    const veteranOrCaseL = (household?.caseW ?? false) || (household?.caseG ?? false) || (household?.caseL ?? false);
    return caseP || veteranOrCaseL ? halfPart : 0;
  }

  /**
   * Computes the single parent extra part (case T), for single/divorced
   * taxpayers only: a half part with at least one exclusive child or two
   * alternate-custody children, a quarter part with a single
   * alternate-custody child.
   */
  private static _computeSingleParentPart(
    household: HouseholdLike | undefined,
    maritalStatus: MaritalStatus,
    childrenCount: number,
    alternateChildrenCount: number
  ): number {
    const halfPart = FISCAL_RATES.EXTRA_PARTS.CHILD;
    if (maritalStatus !== 'single' || !(household?.isSingleParent ?? false)) {
      return 0;
    }
    if (childrenCount > 0 || alternateChildrenCount >= 2) {
      return halfPart;
    }
    return alternateChildrenCount === 1 ? halfPart / 2 : 0;
  }

  /**
   * Computes the ceiling applied to the tax reduction granted by extra parts,
   * mirroring the OpenFisca ir_plaf_qf formula. The base ceiling depends on
   * the situation: case T shares the single-parent ceiling over the first two
   * half parts, case L replaces the general ceiling entirely, otherwise each
   * extra half part is capped at the general rate. Complementary post-ceiling
   * reductions for invalidity/veteran cases and widowed taxpayers are fixed
   * amounts, which is equivalent to increasing the ceiling.
   */
  private static _computeReductionCeiling(
    household: HouseholdLike | undefined,
    maritalStatus: MaritalStatus,
    childrenCount: number,
    extraParts: number
  ): number {
    const ceilings = FISCAL_RATES.EXTRA_PARTS.CEILING;
    const extraHalfParts = extraParts * 2;
    let ceiling: number;

    if (maritalStatus === 'single' && (household?.isSingleParent ?? false)) {
      const cappedHalfParts = Math.min(extraHalfParts, 2);
      ceiling = ceilings.SINGLE_PARENT * cappedHalfParts / 2 + ceilings.CHILD * (extraHalfParts - cappedHalfParts);
    } else if (maritalStatus !== 'married' && (household?.caseL ?? false) && childrenCount === 0) {
      ceiling = ceilings.CASE_L;
    } else {
      ceiling = ceilings.CHILD * extraHalfParts;
    }

    // The invalidity/veteran complementary reduction (reduc_postplafond)
    // applies whenever a case is ticked, even if it granted no extra part,
    // and doubles only for a married couple with both cases P and F.
    const caseP = household?.caseP ?? false;
    const caseF = household?.caseF ?? false;
    const hasInvalidityOrVeteranCase = caseP || caseF
      || (household?.caseW ?? false) || (household?.caseS ?? false) || (household?.caseG ?? false);
    if (hasInvalidityOrVeteranCase) {
      ceiling += ceilings.DISABILITY_POST_CAP_REDUCTION
        * (maritalStatus === 'married' && caseP && caseF ? 2 : 1);
    }

    // Widowed taxpayers with a child in exclusive custody get an additional
    // complementary reduction (reduc_postplafond_veuf).
    if (maritalStatus === 'widowed' && childrenCount > 0) {
      ceiling += ceilings.WIDOW_POST_CAP_REDUCTION;
    }

    return ceiling;
  }

  /**
   * Computes the decote for a raw tax amount and marital status.
   */
  private static _computeDecote(rawTax: number, maritalStatus: MaritalStatus): number {
    const decoteLimit = maritalStatus === 'married'
      ? FISCAL_RATES.DECOTE.limit_couple
      : FISCAL_RATES.DECOTE.limit_single;
    return Math.round(Math.max(0, decoteLimit - FISCAL_RATES.DECOTE.rate * rawTax));
  }

  /**
   * Computes the marginal income tax rate (TMI) from taxable income and parts.
   */
  private static _computeTmi(taxableIncome: number, parts: number): number {
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
