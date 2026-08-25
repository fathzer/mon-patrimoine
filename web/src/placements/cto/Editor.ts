import { BasePlacementEditor } from '../kit/v1/index.js';
import { getCtoTaxExplanation } from './TaxExplanation.js';
import type { BasePlacement, FiscalProfile } from '../kit/v1/index.js';
import type { CtoModule } from './module.js';

const labels = {
  currentCtoValue: 'Valeur totale actuelle, y compris le solde espèces (€)',
  acquisitionValue: 'Valeur d\'acquisition (€)',
  cashBalance: 'Solde espèces (€)'
};

export class CtoEditor extends BasePlacementEditor {
  override _renderAfterInstitution(placement: BasePlacement | null): string {
    const p = placement as CtoModule | null;
    return `
      <div class="form-group">
        <label>${labels.currentCtoValue}</label>
        <input type="number" step="0.01" name="currentValue" class="form-control" value="${p?.currentValue || 0}" required />
      </div>
      <div class="form-group">
        <label>${labels.acquisitionValue}</label>
        <input type="number" step="0.01" name="acquisitionValue" class="form-control" value="${p?.acquisitionValue || 0}" />
      </div>
      <div class="form-group">
        <label>${labels.cashBalance}</label>
        <input type="number" step="0.01" name="cashBalance" class="form-control" value="${p?.cashBalance || 0}" />
      </div>
    `;
  }

  override _bindEvents(): void {
    super._bindEvents();
    (['currentValue', 'acquisitionValue', 'cashBalance'] as const).forEach(name => {
      const input = this.container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      input?.addEventListener('input', () => this._notifyValidityChange());
    });
  }

  override isValid(): boolean {
    if (!super.isValid()) return false;
    const currentValue = this.container.querySelector<HTMLInputElement>('input[name="currentValue"]');
    return currentValue ? currentValue.checkValidity() : true;
  }

  override getData(): Record<string, unknown> {
    return {
      ...super.getData(),
      currentValue: Number(this.container.querySelector<HTMLInputElement>('input[name="currentValue"]')?.value) || 0,
      acquisitionValue: Number(this.container.querySelector<HTMLInputElement>('input[name="acquisitionValue"]')?.value) || 0,
      cashBalance: Number(this.container.querySelector<HTMLInputElement>('input[name="cashBalance"]')?.value) || 0
    };
  }

  override buildTaxExplanation(placement: BasePlacement, fiscalProfile: FiscalProfile): string {
    return getCtoTaxExplanation(placement as CtoModule, fiscalProfile);
  }
}
