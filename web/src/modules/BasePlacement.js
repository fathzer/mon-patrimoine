import { CategoryValues } from '../core/Categories.js';

export class BasePlacement {
  static DEFAULT_CATEGORY = null;

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

  getCategory() {
    return this.constructor.DEFAULT_CATEGORY;
  }

  getEvaluation(fiscalProfile, now = new Date()) {
    throw new Error(`getEvaluation() non implémentée pour ${this.type}`);
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      label: this.label,
      institution: this.institution
    };
  }
}
