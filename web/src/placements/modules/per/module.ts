import { BasePlacement, Category, SOCIAL_CONTRIBUTION_RATES } from '../../kit/v1/index.js';
import { PerEditor } from './Editor.js';
import { getPerTaxExplanation } from './TaxExplanation.js';
import type { Evaluation, PlacementData, PlacementModuleStatic, FiscalProfile, PlacementIncome } from '../../kit/v1/index.js';

/** Identifiers for the three PER compartments. */
export type PerCompartmentKey = 'deducted' | 'non_deducted' | 'employee_savings';

/** Raw data for a single compartment, as stored in persistence. */
export interface PerCompartmentData {
  /** Amount contributed to this compartment. Required. */
  contributions: number;
  /** Explicitly entered capital gain, or `undefined` when not provided. */
  gain?: number;
}

export interface PerData extends PlacementData {
  grossValue?: number;
  /** Known net value before income tax (after social charges). Optional. */
  netValue?: number;
  knowsNetValue?: boolean;
  deducted?: PerCompartmentData;
  nonDeducted?: PerCompartmentData;
  employeeSavings?: PerCompartmentData;
}

/** Effective values for a compartment after gain allocation. */
export interface CompartmentValues {
  contributions: number;
  /** Effective gain (explicitly entered or proportionally allocated). */
  gain: number;
  /** Whether the gain was explicitly entered by the user. */
  gainEntered: boolean;
}

const COMPARTMENT_KEYS: readonly PerCompartmentKey[] = ['deducted', 'non_deducted', 'employee_savings'];

export class PerModule extends BasePlacement {
  static getCategory(): Category {
    return Category.INVESTMENTS;
  }

  static getLabel(): string {
    return 'PER / PERECO';
  }

  static getEditorClass() {
    return PerEditor;
  }

  static getTaxExplanation(placement: BasePlacement, fiscalProfile: FiscalProfile): string {
    return getPerTaxExplanation(placement as PerModule, fiscalProfile);
  }

  grossValue: number;
  /** Known net value before income tax. Only meaningful when knowsNetValue is true. */
  netValue: number;
  knowsNetValue: boolean;
  deducted: PerCompartmentData;
  nonDeducted: PerCompartmentData;
  employeeSavings: PerCompartmentData;

  constructor(data: PerData) {
    super({ ...data, type: 'per' });
    this.grossValue = Number(data.grossValue) || 0;
    this.netValue = Number(data.netValue) || 0;
    this.knowsNetValue = data.knowsNetValue === true;
    this.deducted = PerModule.normalizeCompartment(data.deducted);
    this.nonDeducted = PerModule.normalizeCompartment(data.nonDeducted);
    this.employeeSavings = PerModule.normalizeCompartment(data.employeeSavings);
  }

  private static normalizeCompartment(c: PerCompartmentData | undefined): PerCompartmentData {
    const contributions = Number(c?.contributions) || 0;
    const rawGain = c?.gain;
    return {
      contributions,
      gain: rawGain == null ? undefined : Number(rawGain) || 0
    };
  }

  private getCompartmentData(key: PerCompartmentKey): PerCompartmentData {
    switch (key) {
      case 'deducted': return this.deducted;
      case 'non_deducted': return this.nonDeducted;
      case 'employee_savings': return this.employeeSavings;
    }
  }

  /**
   * Computes effective values for all three compartments, allocating any
   * missing gain proportionally to contributions among compartments whose
   * gain was not explicitly entered.
   *
   * Invariant: sum of contributions + sum of effective gains = grossValue
   * (when grossValue >= contributions + known gains).
   */
  getComputedCompartments(): Record<PerCompartmentKey, CompartmentValues> {
    const totalContributions = COMPARTMENT_KEYS.reduce((sum, k) => sum + this.getCompartmentData(k).contributions, 0);
    const totalKnownGains = COMPARTMENT_KEYS.reduce((sum, k) => {
      const g = this.getCompartmentData(k).gain;
      return sum + (g ?? 0);
    }, 0);
    const totalGain = Math.max(0, this.grossValue - totalContributions);
    const missingGain = Math.max(0, totalGain - totalKnownGains);

    // Compartments whose gain was not explicitly entered participate in allocation.
    const missingKeys = COMPARTMENT_KEYS.filter(k => this.getCompartmentData(k).gain == null);
    const missingContributions = missingKeys.reduce((sum, k) => sum + this.getCompartmentData(k).contributions, 0);

    const result = {} as Record<PerCompartmentKey, CompartmentValues>;
    for (const k of COMPARTMENT_KEYS) {
      const data = this.getCompartmentData(k);
      const gainEntered = data.gain != null;
      let gain: number;
      if (gainEntered) {
        gain = data.gain!;
      } else if (missingContributions > 0) {
        gain = (data.contributions / missingContributions) * missingGain;
      } else {
        gain = 0;
      }
      result[k] = { contributions: data.contributions, gain, gainEntered };
    }
    return result;
  }

  /** Total contributions across all three compartments. */
  getTotalContributions(): number {
    return COMPARTMENT_KEYS.reduce((sum, k) => sum + this.getCompartmentData(k).contributions, 0);
  }

  /** Total effective gain across all three compartments. */
  getLatentGain(): number {
    const c = this.getComputedCompartments();
    return c.deducted.gain + c.non_deducted.gain + c.employee_savings.gain;
  }

  getSocialChargesRate(): number {
    return SOCIAL_CONTRIBUTION_RATES.CSG_CRDS;
  }

  /**
   * Social charges are levied only on gains (all three compartments).
   * No social charges on capital in any compartment.
   * When the user provides a known net value before IR, social charges are
   * derived from it instead of computed from gains.
   */
  getSocialCharges(): number {
    if (this.knowsNetValue) {
      return Math.max(0, this.grossValue - this.netValue);
    }
    return this.getLatentGain() * this.getSocialChargesRate();
  }

  override getTaxableIncomes(_fiscalProfile: FiscalProfile, _now: Date = new Date()): PlacementIncome[] {
    const c = this.getComputedCompartments();
    const incomes: PlacementIncome[] = [];

    // Compartment 1 - Deducted voluntary contributions:
    //   Capital: taxed at progressive scale (barème), no PFU option.
    if (c.deducted.contributions > 0) {
      incomes.push({ assietteImposition: c.deducted.contributions });
    }
    //   Gains: PFU eligible (or barème on option).
    if (c.deducted.gain > 0) {
      incomes.push({ assietteImposition: c.deducted.gain, eligiblePfu: true, deductionRevenus: c.deducted.gain });
    }

    // Compartment 1 - Non-deducted voluntary contributions:
    //   Capital: exempt from IR (already taxed at entry).
    //   Gains: PFU eligible (or barème on option).
    if (c.non_deducted.gain > 0) {
      incomes.push({ assietteImposition: c.non_deducted.gain, eligiblePfu: true, deductionRevenus: c.non_deducted.gain });
    }

    // Compartment 2 - Employee savings:
    //   Capital and gains: exempt from IR.

    return incomes;
  }

  override getEvaluation(fiscalProfile: FiscalProfile, now: Date = new Date()): Evaluation {
    const socialCharges = this.getSocialCharges();
    const netValueBeforeIR = this.knowsNetValue
      ? this.netValue
      : this.grossValue - socialCharges;
    const imposition = this.getImposition(fiscalProfile, now);

    return {
      grossValue: this.grossValue,
      netValueBeforeIR,
      socialCharges,
      latentGain: this.getLatentGain(),
      imposition,
      netValue: netValueBeforeIR - imposition
    };
  }

  override toJSON(): PerData {
    return {
      ...super.toJSON(),
      grossValue: this.grossValue,
      netValue: this.netValue,
      knowsNetValue: this.knowsNetValue,
      deducted: this.deducted,
      nonDeducted: this.nonDeducted,
      employeeSavings: this.employeeSavings
    };
  }
}

const _check: PlacementModuleStatic = PerModule;
export default PerModule;
