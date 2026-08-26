import { BasePlacementEditor, I18n } from '../../kit/v1/index.js';
import type { BasePlacement } from '../../kit/v1/index.js';
import type { PeaModule } from './module.js';

const labels = {
  totalDeposits: 'Total des versements (€)'
};

export class PeaEditor extends BasePlacementEditor {
  protected override renderAfterInstitution(placement: BasePlacement | null): string {
    const p = placement as PeaModule | null;
    return `
      <div class="form-group">
        <label>${I18n.t('form.currentValue')}</label>
        <input type="number" step="0.01" name="currentValue" class="form-control" value="${p?.currentValue || 0}" required />
      </div>
      <div class="form-group">
        <label>${labels.totalDeposits}</label>
        <input type="number" step="0.01" name="totalDeposits" class="form-control" value="${p?.totalDeposits || 0}" />
      </div>
      <div class="form-group">
        <label>${I18n.t('form.openingDate')}</label>
        <input type="date" name="openingDate" class="form-control" value="${p?.openingDate || ''}" required />
      </div>
    `;
  }

  protected override bindPlacementEvents(): void {
    (['currentValue', 'totalDeposits', 'openingDate'] as const).forEach(name => {
      const input = this.container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      input?.addEventListener('input', () => this.notifyValidityChange());
    });
  }

  protected override isPlacementValid(): boolean {
    const currentValue = this.container.querySelector<HTMLInputElement>('input[name="currentValue"]');
    const openingDate = this.container.querySelector<HTMLInputElement>('input[name="openingDate"]');
    const currentValueValid = currentValue ? currentValue.checkValidity() : true;
    const openingDateValid = openingDate ? openingDate.checkValidity() : true;
    return currentValueValid && openingDateValid;
  }

  protected override collectData(): Record<string, unknown> {
    return {
      currentValue: Number(this.container.querySelector<HTMLInputElement>('input[name="currentValue"]')?.value) || 0,
      totalDeposits: Number(this.container.querySelector<HTMLInputElement>('input[name="totalDeposits"]')?.value) || 0,
      openingDate: this.container.querySelector<HTMLInputElement>('input[name="openingDate"]')?.value || ''
    };
  }
}
