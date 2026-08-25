import { Category, CategoryValues } from '../core/Categories.js';
import { TaxCalculator } from '../fiscality/TaxCalculator.js';
import type { FiscalProfile, PlacementIncome } from '../fiscality/TaxCalculator.js';
import { BasePlacementEditor } from '../ui/editors/BasePlacementEditor.js';
import type { AppStore } from '../core/AppStore.js';

/**
 * Identifies a placement type. Values are the folder names under `placements/`
 * and are discovered at runtime from `modules.json` by `PlacementFactory`.
 */
export type PlacementType = string;

export interface PlacementData {
  id?: string;
  type: PlacementType;
  label?: string;
  institution?: string;
}

export interface Evaluation {
  grossValue: number;
  netValueBeforeIR: number;
  socialCharges: number;
  latentGain: number;
  imposition: number;
  netValue?: number;
}

export type PlacementEditorConstructor = new (container: HTMLElement, store?: AppStore) => BasePlacementEditor;

/**
 * Base class for all placements.
 * Subclasses must define a DEFAULT_CATEGORY and implement getEvaluation and getTaxableIncomes.
 */
export abstract class BasePlacement {
  static readonly DEFAULT_CATEGORY: Category | null = null;

  /**
   * Returns the editor class used to configure this placement.
   */
  static getEditorClass(): PlacementEditorConstructor {
    return BasePlacementEditor as unknown as PlacementEditorConstructor;
  }

  id: string;
  type: PlacementType;
  label: string;
  institution: string;

  constructor(data: PlacementData) {
    if (new.target === BasePlacement) {
      throw new TypeError("Classe abstraite BasePlacement.");
    }
    const defaultCategory = (this.constructor as typeof BasePlacement).DEFAULT_CATEGORY;
    if (!defaultCategory || !CategoryValues.includes(defaultCategory)) {
      throw new TypeError(`Invalid DEFAULT_CATEGORY in ${this.constructor.name}. Must be one of: ${CategoryValues.join(', ')}`);
    }
    this.id = data.id || String(Date.now());
    this.type = data.type;
    this.label = data.label || '';
    this.institution = data.institution || '';
  }

  getCategory(): Category {
    return (this.constructor as typeof BasePlacement).DEFAULT_CATEGORY!;
  }

  /**
   * Evaluates the gross/net values and social charges of this placement.
   */
  abstract getEvaluation(fiscalProfile: FiscalProfile, now?: Date): Evaluation;

  /**
   * Returns the taxable income components for this placement.
   */
  abstract getTaxableIncomes(fiscalProfile: FiscalProfile, now?: Date): PlacementIncome[];

  /**
   * Computes the income tax due on this placement.
   * Relies on getTaxableIncomes and delegates tax computation to the TaxCalculator.
   */
  getImposition(fiscalProfile: FiscalProfile, now: Date = new Date()): number {
    return TaxCalculator.calculatePlacementTax(fiscalProfile, this.getTaxableIncomes(fiscalProfile, now));
  }

  /**
   * Serializes this placement to a plain object.
   */
  toJSON(): PlacementData {
    return {
      id: this.id,
      type: this.type,
      label: this.label,
      institution: this.institution
    };
  }
}
