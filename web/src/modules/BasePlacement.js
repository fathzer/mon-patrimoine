import { CategoryValues } from '../core/Categories.js';
import { TaxCalculator } from '../fiscality/TaxCalculator.js';
import { BasePlacementEditor } from '../ui/editors/BasePlacementEditor.js';

/** @typedef {import('../fiscality/TaxCalculator.js').FiscalProfile} FiscalProfile */
/** @typedef {import('../fiscality/TaxCalculator.js').PlacementIncome} PlacementIncome */

/**
 * Base class for all placements.
 * Subclasses must define a DEFAULT_CATEGORY and implement getEvaluation and getTaxableIncomes.
 */
export class BasePlacement {
  static DEFAULT_CATEGORY = null;

  /**
   * Returns the editor class used to configure this placement.
   * @returns {typeof BasePlacementEditor}
   */
  static getEditorClass() {
    return BasePlacementEditor;
  }

  /**
   * @param {Object} data - raw placement data
   */
  constructor(data) {
    if (new.target === BasePlacement) {
      throw new TypeError("Classe abstraite BasePlacement.");
    }
    if (!this.constructor.DEFAULT_CATEGORY || !CategoryValues.includes(this.constructor.DEFAULT_CATEGORY)) {
      throw new TypeError(`Invalid DEFAULT_CATEGORY in ${this.constructor.name}. Must be one of: ${CategoryValues.join(', ')}`);
    }
    this.id = data.id || String(Date.now());
    this.type = data.type;
    this.label = data.label || '';
    this.institution = data.institution || '';
  }

  /**
   * @returns {string} category identifier
   */
  getCategory() {
    return this.constructor.DEFAULT_CATEGORY;
  }

  /**
   * Evaluates the gross/net values and social charges of this placement.
   * @param {FiscalProfile} fiscalProfile
   * @param {Date} [now]
   * @returns {Object} evaluation summary
   */
  getEvaluation(fiscalProfile, now = new Date()) {
    throw new Error(`getEvaluation() non implémentée pour ${this.type}`);
  }

  /**
   * Returns the taxable income components for this placement.
   * @param {FiscalProfile} fiscalProfile
   * @param {Date} [now]
   * @returns {PlacementIncome[]} list of taxable income components
   */
  getTaxableIncomes(fiscalProfile, now = new Date()) {
    throw new Error(`getTaxableIncomes() non implémentée pour ${this.type}`);
  }

  /**
   * Computes the income tax due on this placement.
   * Relies on getTaxableIncomes and delegates tax computation to the TaxCalculator.
   * @param {FiscalProfile} fiscalProfile
   * @param {Date} [now]
   * @returns {number} tax due
   */
  getImposition(fiscalProfile, now = new Date()) {
    return TaxCalculator.calculatePlacementTax(fiscalProfile, this.getTaxableIncomes(fiscalProfile, now));
  }

  /**
   * Serializes this placement to a plain object.
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      label: this.label,
      institution: this.institution
    };
  }
}
