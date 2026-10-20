import { BasePlacementEditor, I18n, amountInputAttrs } from '../../kit/v1/index.js';
import type { BasePlacement } from '../../kit/v1/index.js';
import type { CheckingAccountModule } from './module.js';

const labels = {
  cardBalance: 'En cours carte (€)'
};

export class CheckingAccountEditor extends BasePlacementEditor {
  protected override renderAfterInstitution(placement: BasePlacement | null): string {
    const p = placement as CheckingAccountModule | null;
    return `
      <div class="form-group">
        <label>${I18n.t('form.currentValue')}</label>
        <input ${amountInputAttrs()} name="currentValue" class="form-control" value="${p?.currentValue || 0}" required />
      </div>
      <div class="form-group">
        <label>${labels.cardBalance}</label>
        <input ${amountInputAttrs()} name="cardBalance" class="form-control" value="${p?.cardBalance || 0}" />
      </div>
    `;
  }

  protected override bindPlacementEvents(): void {
    (['currentValue', 'cardBalance'] as const).forEach(name => {
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
      cardBalance: this.readAmount('cardBalance') || 0
    };
  }
}
