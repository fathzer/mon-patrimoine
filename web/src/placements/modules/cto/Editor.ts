import { BasePlacementEditor, amountInputAttrs } from '../../kit/v1/index.js';
import type { BasePlacement } from '../../kit/v1/index.js';
import type { CtoModule } from './module.js';

const labels = {
  currentCtoValue: 'Valeur totale actuelle, y compris le solde espèces (€)',
  acquisitionValue: 'Valeur d\'acquisition (€)',
  cashBalance: 'Solde espèces (€)'
};

export class CtoEditor extends BasePlacementEditor {
  protected override renderAfterInstitution(placement: BasePlacement | null): string {
    const p = placement as CtoModule | null;
    return `
      <div class="form-group">
        <label>${labels.currentCtoValue}</label>
        <input ${amountInputAttrs()} name="currentValue" class="form-control" value="${p?.currentValue || 0}" required />
      </div>
      <div class="form-group">
        <label>${labels.acquisitionValue}</label>
        <input ${amountInputAttrs()} name="acquisitionValue" class="form-control" value="${p?.acquisitionValue || 0}" />
      </div>
      <div class="form-group">
        <label>${labels.cashBalance}</label>
        <input ${amountInputAttrs()} name="cashBalance" class="form-control" value="${p?.cashBalance || 0}" />
      </div>
    `;
  }

  protected override bindPlacementEvents(): void {
    (['currentValue', 'acquisitionValue', 'cashBalance'] as const).forEach(name => {
      const input = this.container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      input?.addEventListener('input', () => this.notifyValidityChange());
    });
  }

  protected override isPlacementValid(): boolean {
    const currentValue = this.container.querySelector<HTMLInputElement>('input[name="currentValue"]');
    return currentValue ? currentValue.checkValidity() : true;
  }

  protected override collectData(): Record<string, unknown> {
    return {
      currentValue: this.readAmount('currentValue') || 0,
      acquisitionValue: this.readAmount('acquisitionValue') || 0,
      cashBalance: this.readAmount('cashBalance') || 0
    };
  }
}
