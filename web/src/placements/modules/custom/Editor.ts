import { BasePlacementEditor, Category, CategoryValues, I18n, amountInputAttrs } from '../../kit/v1/index.js';
import type { BasePlacement } from '../../kit/v1/index.js';
import type { CustomModule } from './module.js';

const labels = {
  institution: 'Établissement (facultatif)',
  category: 'Catégorie',
  description: 'Description (facultatif)',
  grossValue: 'Valeur brute (€)',
  socialCharges: 'Prélèvements sociaux (€)',
  incomeTax: 'Impôt sur le revenu (€)'
};

const escapeHtml = (s: string): string =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

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
        <label>${labels.description}</label>
        <textarea name="description" class="form-control" rows="2">${escapeHtml(p?.description || '')}</textarea>
      </div>
      <div class="form-group">
        <label>${labels.grossValue}</label>
        <input ${amountInputAttrs()} name="grossValue" class="form-control" value="${p?.grossValue || 0}" required />
      </div>
      <div class="form-group">
        <label>${labels.socialCharges}</label>
        <input ${amountInputAttrs()} name="socialCharges" class="form-control" value="${p?.socialCharges || 0}" />
      </div>
      <div class="form-group">
        <label>${labels.incomeTax}</label>
        <input ${amountInputAttrs()} name="incomeTax" class="form-control" value="${p?.incomeTax || 0}" />
      </div>
    `;
  }

  protected override bindPlacementEvents(): void {
    (['grossValue', 'socialCharges', 'incomeTax', 'category', 'description'] as const).forEach(name => {
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
      grossValue: this.readAmount('grossValue') || 0,
      socialCharges: this.readAmount('socialCharges') || 0,
      incomeTax: this.readAmount('incomeTax') || 0,
      category: categoryValue || Category.OTHER,
      description: this.container.querySelector<HTMLTextAreaElement>('textarea[name="description"]')?.value.trim() || undefined
    };
  }
}
