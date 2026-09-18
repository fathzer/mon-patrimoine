import { BasePlacementEditor, Category, CategoryValues, I18n } from '../../kit/v1/index.js';
import type { BasePlacement } from '../../kit/v1/index.js';
import type { CustomModule } from './module.js';

const labels = {
  institution: 'Établissement (facultatif)',
  category: 'Catégorie',
  grossValue: 'Valeur brute (€)',
  socialCharges: 'Prélèvements sociaux (€)',
  incomeTax: 'Impôt sur le revenu (€)'
};

export class CustomEditor extends BasePlacementEditor {
  /** The base renders a mandatory institution field; ours is optional. */
  protected override hasInstitution(): boolean {
    return false;
  }

  protected override renderAfterInstitution(placement: BasePlacement | null): string {
    const p = placement as CustomModule | null;
    const currentCategory = p?.category ?? Category.OTHER;
    const options = CategoryValues.map(cat => {
      const categoryLabel = I18n.t(`categories.${cat}`);
      return `<option value="${cat}"${cat === currentCategory ? ' selected' : ''}>${categoryLabel}</option>`;
    }).join('\n          ');

    return `
      <div class="form-group">
        <label>${labels.institution}</label>
        <input type="text" name="institution" class="form-control" value="${p?.institution || ''}" />
      </div>
      <div class="form-group">
        <label>${labels.category}</label>
        <select name="category" class="form-control">
          ${options}
        </select>
      </div>
      <div class="form-group">
        <label>${labels.grossValue}</label>
        <input type="number" step="0.01" name="grossValue" class="form-control" value="${p?.grossValue || 0}" required />
      </div>
      <div class="form-group">
        <label>${labels.socialCharges}</label>
        <input type="number" step="0.01" name="socialCharges" class="form-control" value="${p?.socialCharges || 0}" />
      </div>
      <div class="form-group">
        <label>${labels.incomeTax}</label>
        <input type="number" step="0.01" name="incomeTax" class="form-control" value="${p?.incomeTax || 0}" />
      </div>
    `;
  }

  protected override bindPlacementEvents(): void {
    (['grossValue', 'socialCharges', 'incomeTax', 'category'] as const).forEach(name => {
      const input = this.container.querySelector<HTMLElement>(`[name="${name}"]`);
      input?.addEventListener('input', () => this.notifyValidityChange());
      input?.addEventListener('change', () => this.notifyValidityChange());
    });
  }

  protected override isPlacementValid(): boolean {
    const grossValue = this.container.querySelector<HTMLInputElement>('input[name="grossValue"]');
    return grossValue ? grossValue.checkValidity() : true;
  }

  protected override collectData(): Record<string, unknown> {
    const categoryValue = this.container.querySelector<HTMLSelectElement>('select[name="category"]')?.value;
    return {
      grossValue: Number(this.container.querySelector<HTMLInputElement>('input[name="grossValue"]')?.value) || 0,
      socialCharges: Number(this.container.querySelector<HTMLInputElement>('input[name="socialCharges"]')?.value) || 0,
      incomeTax: Number(this.container.querySelector<HTMLInputElement>('input[name="incomeTax"]')?.value) || 0,
      category: categoryValue || Category.OTHER
    };
  }
}
