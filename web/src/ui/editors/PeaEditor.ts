import { BasePlacementEditor } from './BasePlacementEditor.js';
import { I18n } from '../../core/I18n.js';
import { getPeaTaxExplanation } from '../../i18n/peaTaxExplanation.js';
import type { BasePlacement } from '../../modules/BasePlacement.js';
import type { PeaModule } from '../../modules/PeaModule.js';
import type { FiscalProfile } from '../../fiscality/TaxCalculator.js';

export class PeaEditor extends BasePlacementEditor {
  override render(placement: BasePlacement | null = null): void {
    super.render(placement);
    const p = placement as PeaModule | null;
    const field = document.createElement('div');
    field.innerHTML = `
      <div class="form-group">
        <label>${I18n.t('form.currentValue')}</label>
        <input type="number" step="0.01" name="currentValue" class="form-control" value="${p?.currentValue || 0}" required />
      </div>
      <div class="form-group">
        <label>${I18n.t('form.totalDeposits')}</label>
        <input type="number" step="0.01" name="totalDeposits" class="form-control" value="${p?.totalDeposits || 0}" />
      </div>
      <div class="form-group">
        <label>${I18n.t('form.openingDate')}</label>
        <input type="date" name="openingDate" class="form-control" value="${p?.openingDate || ''}" required />
      </div>
    `;
    this.container.appendChild(field);
    this._bindSpecificEvents();
  }

  _bindSpecificEvents(): void {
    (['currentValue', 'totalDeposits', 'openingDate'] as const).forEach(name => {
      const input = this.container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      input?.addEventListener('input', () => this._notifyValidityChange());
    });
  }

  override isValid(): boolean {
    if (!super.isValid()) return false;
    const currentValue = this.container.querySelector<HTMLInputElement>('input[name="currentValue"]');
    const openingDate = this.container.querySelector<HTMLInputElement>('input[name="openingDate"]');
    const currentValueValid = currentValue ? currentValue.checkValidity() : true;
    const openingDateValid = openingDate ? openingDate.checkValidity() : true;
    return currentValueValid && openingDateValid;
  }

  override getData(): Record<string, unknown> {
    return {
      ...super.getData(),
      currentValue: Number(this.container.querySelector<HTMLInputElement>('input[name="currentValue"]')?.value) || 0,
      totalDeposits: Number(this.container.querySelector<HTMLInputElement>('input[name="totalDeposits"]')?.value) || 0,
      openingDate: this.container.querySelector<HTMLInputElement>('input[name="openingDate"]')?.value || ''
    };
  }

  override buildTaxExplanation(placement: BasePlacement, fiscalProfile: FiscalProfile): string {
    return getPeaTaxExplanation(placement as PeaModule, fiscalProfile);
  }
}
