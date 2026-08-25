import { BasePlacementEditor } from './BasePlacementEditor.js';
import { I18n } from '../../core/I18n.js';
import type { BasePlacement } from '../../modules/BasePlacement.js';
import type { CheckingAccountModule } from '../../modules/CheckingAccountModule.js';
import type { FiscalProfile } from '../../fiscality/TaxCalculator.js';

export class CheckingAccountEditor extends BasePlacementEditor {
  override render(placement: BasePlacement | null = null): void {
    super.render(placement);
    const field = document.createElement('div');
    field.innerHTML = `
      <div class="form-group">
        <label>${I18n.t('form.currentValue')}</label>
        <input type="number" step="0.01" name="currentValue" class="form-control" value="${(placement as CheckingAccountModule)?.currentValue || 0}" required />
      </div>
      <div class="form-group">
        <label>${I18n.t('form.cardBalance')}</label>
        <input type="number" step="0.01" name="cardBalance" class="form-control" value="${(placement as CheckingAccountModule)?.cardBalance || 0}" />
      </div>
    `;
    this.container.appendChild(field);
    this._bindSpecificEvents();
  }

  _bindSpecificEvents(): void {
    (['currentValue', 'cardBalance'] as const).forEach(name => {
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
      cardBalance: Number(this.container.querySelector<HTMLInputElement>('input[name="cardBalance"]')?.value) || 0
    };
  }

  override buildTaxExplanation(_placement: BasePlacement, _fiscalProfile: FiscalProfile): string {
    return '';
  }
}
