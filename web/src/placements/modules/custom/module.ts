import { BasePlacement, Category } from '../../kit/v1/index.js';
import { CustomEditor } from './Editor.js';
import type { Evaluation, PlacementData, PlacementModuleStatic, FiscalProfile, PlacementIncome } from '../../kit/v1/index.js';

export interface CustomData extends PlacementData {
  grossValue?: number;
  socialCharges?: number;
  incomeTax?: number;
  category?: Category;
}

/**
 * Custom placement for assets not covered by the other modules.
 * The user directly enters the gross value, social charges and income tax
 * amounts: no tax computation is performed.
 */
export class CustomModule extends BasePlacement {
  static getCategory(): Category {
    return Category.OTHER;
  }

  static getLabel(): string {
    return 'Placement personnalisé';
  }

  static getEditorClass() {
    return CustomEditor;
  }

  static getTaxExplanation(_placement: BasePlacement, _fiscalProfile: FiscalProfile): string {
    return `
<div class="tax-explanation">
  <h2>Placement personnalisé</h2>
  <p>Les prélèvements sociaux et l'impôt sur le revenu de ce placement sont saisis manuellement : aucun calcul automatique n'est effectué.</p>
</div>`;
  }

  grossValue: number;
  socialCharges: number;
  incomeTax: number;
  category: Category;

  constructor(data: CustomData) {
    super(data);
    this.grossValue = Number(data.grossValue) || 0;
    this.socialCharges = Number(data.socialCharges) || 0;
    this.incomeTax = Number(data.incomeTax) || 0;
    this.category = data.category ?? Category.OTHER;
  }

  /**
   * The category is chosen by the user for each custom placement,
   * so it is stored as instance data rather than derived from the module.
   */
  override getCategory(): Category {
    return this.category;
  }

  override getEvaluation(_fiscalProfile: FiscalProfile, _now: Date = new Date()): Evaluation {
    const netValueBeforeIR = this.grossValue - this.socialCharges;
    return {
      grossValue: this.grossValue,
      netValueBeforeIR,
      socialCharges: this.socialCharges,
      latentGain: 0,
      imposition: this.incomeTax,
      netValue: netValueBeforeIR - this.incomeTax
    };
  }

  protected override getTaxableIncomes(_fiscalProfile: FiscalProfile, _now: Date = new Date()): PlacementIncome[] {
    return [];
  }

  override toJSON(): CustomData {
    return {
      ...super.toJSON(),
      grossValue: this.grossValue,
      socialCharges: this.socialCharges,
      incomeTax: this.incomeTax,
      category: this.category
    };
  }
}

const _check: PlacementModuleStatic = CustomModule;
export default CustomModule;
