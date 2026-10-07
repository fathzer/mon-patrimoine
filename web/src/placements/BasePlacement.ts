import { Category, CategoryValues } from '../core/Categories.js';
import { TaxCalculator } from '../fiscality/TaxCalculator.js';
import type { FiscalProfile, PlacementIncome } from '../fiscality/TaxCalculator.js';
import { compareDates, recordAt, resolveAt, valuesEqual } from '../core/DatedHistory.js';
import type { HistoryEntry } from '../core/DatedHistory.js';
import { BasePlacementEditor } from '../ui/BasePlacementEditor.js';
import type { AppStore } from '../core/AppStore.js';

/**
 * Minimal data required to create a placement.
 * Module-specific data interfaces extend this with their own fields.
 *
 * `type` is optional in constructor input: each module stamps its own
 * constant type (matching its folder name under placements/modules/).
 * It is required only in serialized data, where PlacementFactory uses it
 * to select the module class on deserialization.
 */
export interface PlacementData {
  id?: string;
  type?: string;
  label?: string;
  institution?: string;
  /** Effective date (YYYY-MM-DD) of the current evolving values. Defaults to today. */
  asOf?: string;
  /** Closure date: the placement does not exist after it, but keeps its history. */
  closedAt?: string | null;
  /** Past states of the module's evolving fields, sorted by date. */
  history?: HistoryEntry[];
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
  /** Effective date of the current evolving values (YYYY-MM-DD). */
  asOf: string;
  /** Closure date (YYYY-MM-DD), or null while the placement is active. */
  closedAt: string | null;
  /** Past states of the module's evolving fields, sorted by date. */
  history: HistoryEntry[];

  constructor(data: PlacementData) {
    const category = (this.constructor as unknown as PlacementModuleStatic).getCategory();
    if (!CategoryValues.includes(category)) {
      throw new TypeError(`Invalid category from getCategory() in ${this.constructor.name}. Must be one of: ${CategoryValues.join(', ')}`);
    }
    if (!data.type) {
      throw new TypeError(`Missing placement type: ${this.constructor.name} must set data.type before calling super()`);
    }
    this.id = data.id || String(Date.now());
    this.type = data.type;
    this.label = data.label || '';
    this.institution = data.institution || '';
    this.asOf = data.asOf || new Date().toISOString().split('T')[0];
    this.closedAt = data.closedAt ?? null;
    this.history = (Array.isArray(data.history) ? data.history : [])
      .map(e => ({ date: String(e.date), values: e.values ?? {} }))
      .sort((a, b) => compareDates(a.date, b.date));
  }

  /**
   * Returns the category of this placement instance.
   * Defaults to the module's static category; modules that let the user
   * choose a category per placement (e.g. custom) override this.
   */
  getCategory(): Category {
    return (this.constructor as unknown as PlacementModuleStatic).getCategory();
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
    return TaxCalculator.calculatePlacementTax(fiscalProfile, this.getTaxableIncomes(fiscalProfile, now), now.getFullYear());
  }

  /**
   * Returns the placement's evolving (history-tracked) values, i.e. the
   * serialized fields that may change over time. The default empty object
   * makes the module history-inert; modules opt in by overriding this
   * accessor. How nested histories are represented (e.g. stock grants) is
   * left to each module.
   */
  getEvolvingValues(): Record<string, unknown> {
    return {};
  }

  /**
   * Returns every date at which a placement state is known: the past history
   * entries plus the current state's effective date.
   */
  getHistoryDates(): string[] {
    return [...new Set([...this.history.map(e => e.date), this.asOf])].sort(compareDates);
  }

  /**
   * Reconstructs the serialized placement state effective at `date`, as a
   * PlacementData usable with PlacementFactory.create(). Returns null when
   * the placement was not tracked yet at that date (before its first known
   * state) or was already closed. The returned data carries no `history`
   * and its `asOf` is the resolved state date.
   */
  getDataAt(date: string): PlacementData | null {
    if (this.closedAt != null && date > this.closedAt) {
      return null;
    }
    const resolved = resolveAt(
      [...this.history, { date: this.asOf, values: this.getEvolvingValues() }],
      date
    );
    if (resolved == null) {
      return null;
    }
    const data = this.toJSON();
    delete data.history;
    return { ...data, ...resolved.values, asOf: resolved.date };
  }

  /**
   * Records a state transition when this (new) instance replaces `previous`.
   * If the evolving values changed, the previous current state is pushed
   * into `history` at its own effective date, and `effectiveDate` becomes
   * the new `asOf`. Only call when `effectiveDate >= previous.asOf` —
   * retroactive inserts go through insertHistoryEntry() instead.
   */
  recordState(previous: BasePlacement | null, effectiveDate: string): void {
    this.asOf = effectiveDate;
    if (previous == null) {
      return;
    }
    this.closedAt ??= previous.closedAt;
    if (previous.asOf < effectiveDate && !valuesEqual(previous.getEvolvingValues(), this.getEvolvingValues())) {
      this.history = recordAt(previous.history, { date: previous.asOf, values: previous.getEvolvingValues() });
    } else {
      this.history = previous.history;
    }
  }

  /**
   * Inserts or replaces a past evolving state (a retroactive correction).
   * The current state is left untouched; use for dates strictly before `asOf`.
   */
  insertHistoryEntry(date: string, values: Record<string, unknown>): void {
    this.history = recordAt(this.history, { date, values });
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
      institution: this.institution,
      asOf: this.asOf,
      ...(this.closedAt != null ? { closedAt: this.closedAt } : {}),
      ...(this.history.length > 0 ? { history: this.history } : {})
    };
  }
}
