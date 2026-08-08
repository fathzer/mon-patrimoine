export class BasePlacement {
  constructor(data) {
    if (new.target === BasePlacement) {
      throw new TypeError("Classe abstraite BasePlacement.");
    }
    this.id = data.id;
    this.type = data.type;
    this.category = data.category || 'other';
    this.label = data.label || 'Placement sans nom';
    this.institution = data.institution || '';
    this.rawContent = data;
  }

  getEvaluation(fiscalProfile, now = new Date()) {
    throw new Error(`getEvaluation() non implémentée pour ${this.type}`);
  }

  toJSON() {
    return { ...this.rawContent };
  }
}
