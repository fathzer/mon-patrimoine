export class BasePlacement {
  constructor(data) {
    if (new.target === BasePlacement) {
      throw new TypeError("Classe abstraite BasePlacement.");
    }
    this.id = data.id || String(Date.now());
    this.type = data.type;
    this.category = data.category || 'other';
    this.label = data.label || '';
    this.institution = data.institution || '';
    this.rawContent = data;
  }

  getEvaluation(fiscalProfile, now = new Date()) {
    throw new Error(`getEvaluation() non implémentée pour ${this.type}`);
  }

  toJSON() {
    return { ...this.rawContent, id: this.id, type: this.type, category: this.category, label: this.label, institution: this.institution };
  }
}
