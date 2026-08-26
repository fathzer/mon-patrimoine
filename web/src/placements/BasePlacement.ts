import { Category, CategoryValues } from '../core/Categories.js';
import { TaxCalculator } from '../fiscality/TaxCalculator.js';
import type { FiscalProfile, PlacementIncome } from '../fiscality/TaxCalculator.js';
import { BasePlacementEditor } from '../ui/BasePlacementEditor.js';
import type { AppStore } from '../core/AppStore.js';

/**
 * Minimal data required to create a placement.
 * Module-specific data interfaces extend this with their own fields.
 */
export interface PlacementData {
  id?: string;
  type: string;
  label?: string;
  institution?: string;
}

/**
 * Result of evaluating a placement's financial position.
 * @property grossValue - Total gross value of the placement.
 * @property netValueBeforeIR - Value after social charges but before income tax.
 * @property socialCharges - Total social contributions paid.
 * @property latentGain - Unrealized capital gain.
 * @property imposition - Income tax due on this placement.
 * @property netValue - Final net value (after IR), if applicable.
 */
export interface Evaluation {
  grossValue: number;
  netValueBeforeIR: number;
  socialCharges: number;
  latentGain: number;
  imposition: number;
  netValue?: number;
}

/**
 * Constructor signature for placement editors.
 * The host creates an editor via `PlacementFactory.getEditorClass(type)`.
 * The optional AppStore is passed to editors that need cross-placement
 * context (e.g. real estate detecting an existing primary residence).
 */
export type PlacementEditorConstructor = new (container: HTMLElement, store?: AppStore) => BasePlacementEditor;

/**
 * Function signature for tax explanation providers.
 * The host calls it via `PlacementFactory.getTaxExplanation(type, placement, fp)`
 * to render the tax explanation panel for a placement.
 *
 * Modules typically delegate to a `TaxExplanation.ts` helper, but the only
 * contract is that this function returns the HTML string for the panel.
 */
export type TaxExplanationProvider = (placement: BasePlacement, fiscalProfile: FiscalProfile) => string;

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
  getTaxExplanation: TaxExplanationProvider;
}

/**
 * Base class for all placements.
 *
 * Each placement type (checking account, PEA, real estate, ...) extends this
 * class and provides:
 * - Static metadata: `getCategory()`, `getLabel()`, `getEditorClass()`,
 *   `getTaxExplanation()` (enforced at compile time via
 *   {@link PlacementModuleStatic}).
 * - Instance evaluation: `getEvaluation()` and `getTaxableIncomes()`.
 *
 * The host (AppStore) creates placements via `PlacementFactory.create(data)`,
 * reads their evaluation via `getEvaluation()`, and serializes them via
 * `toJSON()`.
 *
 * Subclasses call `getImposition()` from within `getEvaluation()` to compute
 * the income tax due; they do not reimplement it.
 */
export abstract class BasePlacement {
  /** Unique identifier (auto-generated if not provided in data). */
  id: string;
  /** Placement type name (matches the folder name under placements/modules/). */
  type: string;
  /** User-defined label for this placement. */
  label: string;
  /** Financial institution holding this placement. */
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
   * Evaluates the gross/net values, social charges, and income tax for this
   * placement. Called by the host (AppStore) to compute the portfolio state.
   *
   * Implementations typically call `this.getImposition(fiscalProfile, now)`
   * to obtain the `imposition` field of the returned {@link Evaluation}.
   */
  abstract getEvaluation(fiscalProfile: FiscalProfile, now?: Date): Evaluation;

  /**
   * Returns the taxable income components produced by this placement.
   * Used internally by {@link getImposition} to compute income tax.
   * Not called directly by the host.
   */
  protected abstract getTaxableIncomes(fiscalProfile: FiscalProfile, now?: Date): PlacementIncome[];

  /**
   * Computes the income tax due on this placement.
   * Delegates tax computation to {@link TaxCalculator.calculatePlacementTax}
   * using the taxable incomes from {@link getTaxableIncomes}.
   *
   * Subclasses call this from `getEvaluation()`; they do not override it.
   */
  protected getImposition(fiscalProfile: FiscalProfile, now: Date = new Date()): number {
    return TaxCalculator.calculatePlacementTax(fiscalProfile, this.getTaxableIncomes(fiscalProfile, now));
  }

  /**
   * Serializes this placement to a plain object for persistence.
   * Subclasses override and merge their specific fields with `super.toJSON()`.
   * Called by the host (AppStore) when saving the portfolio.
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
