import { Category, CategoryValues } from '../core/Categories.js';
import { TaxCalculator } from '../fiscality/TaxCalculator.js';
import type { FiscalProfile, PlacementIncome } from '../fiscality/TaxCalculator.js';
import { BasePlacementEditor } from '../ui/editors/BasePlacementEditor.js';
import type { AppStore } from '../core/AppStore.js';

export interface PlacementData {
  id?: string;
  type: string;
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
 * Describes the static side (constructor) that every placement module must
 * provide. Since TypeScript does not support `abstract static`, this interface
 * is used as a compile-time contract: each module verifies itself against it
 * via `const _check: PlacementModuleStatic = MyModule;`.
 */
export interface PlacementModuleStatic {
  getCategory(): Category;
  getLabel(): string;
  getEditorClass(): PlacementEditorConstructor;
}

/**
 * Base class for all placements.
 * Subclasses must define static getCategory, getLabel, getEditorClass (enforced
 * via {@link PlacementModuleStatic}) and implement getEvaluation and
 * getTaxableIncomes.
 */
export abstract class BasePlacement {
  id: string;
  type: string;
  label: string;
  institution: string;

  constructor(data: PlacementData) {
    const category = (this.constructor as unknown as PlacementModuleStatic).getCategory();
    if (!CategoryValues.includes(category)) {
      throw new TypeError(`Invalid category from getCategory() in ${this.constructor.name}. Must be one of: ${CategoryValues.join(', ')}`);
    }
    this.id = data.id || String(Date.now());
    this.type = data.type;
    this.label = data.label || '';
    this.institution = data.institution || '';
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
