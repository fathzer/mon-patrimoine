import { SavingsAccountBaseEditor } from './SavingsAccountBaseEditor.js';
import { getSavingsAccountTaxExplanation } from '../../i18n/savingsAccountTaxExplanation.js';
import { I18n } from '../../core/I18n.js';
import type { BasePlacement } from '../../modules/BasePlacement.js';
import type { FiscalProfile } from '../../fiscality/TaxCalculator.js';
import type { SavingsAccountModule } from '../../modules/SavingsAccountModule.js';

export class SavingsAccountEditor extends SavingsAccountBaseEditor {
  override _renderTaxExempt(placement: BasePlacement | null): string {
    const taxExempt = (placement as SavingsAccountModule)?.taxExempt !== false;
    return `
      <div class="form-group">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
          <input type="checkbox" name="taxExempt" id="tax-exempt" ${taxExempt ? 'checked' : ''} />
          <label for="tax-exempt" style="margin: 0;">${I18n.t('form.taxExempt')}</label>
        </div>
        <p class="text-muted" style="font-size: 0.8rem; margin: 0; padding-left: 1.5rem;">${I18n.t('form.taxExemptTooltip')}</p>
      </div>
    `;
  }

  override _renderPromotionalInterest(placement: BasePlacement | null): string {
    const taxExempt = (placement as SavingsAccountModule)?.taxExempt !== false;
    const value = taxExempt ? 0 : ((placement as SavingsAccountModule)?.promotionalInterest || 0);
    return `
      <div class="form-group" id="promotional-interest-group" style="display: ${taxExempt ? 'none' : 'block'};">
        <label>${I18n.t('form.promotionalInterest')}</label>
        <input type="number" step="0.01" name="promotionalInterest" class="form-control" value="${value}" />
      </div>
    `;
  }

  override _onTaxExemptChange(): void {
    const taxExempt = this.container.querySelector<HTMLInputElement>('input[name="taxExempt"]');
    const promotionalGroup = this.container.querySelector<HTMLElement>('#promotional-interest-group');
    const promotionalInput = this.container.querySelector<HTMLInputElement>('input[name="promotionalInterest"]');

    if (taxExempt && promotionalGroup && promotionalInput) {
      const isExempt = taxExempt.checked;
      promotionalGroup.style.display = isExempt ? 'none' : 'block';
      promotionalInput.value = isExempt ? '0' : (promotionalInput.value || '0');
    }
    this._notifyValidityChange();
  }

  override isValid(): boolean {
    if (!super.isValid()) return false;
    const currentValue = this.container.querySelector<HTMLInputElement>('input[name="currentValue"]');
    return currentValue ? currentValue.checkValidity() : true;
  }

  override getData(): Record<string, unknown> {
    const taxExempt = this.container.querySelector<HTMLInputElement>('input[name="taxExempt"]')?.checked ?? true;
    return {
      ...super.getData(),
      interestAmount: Number(this.container.querySelector<HTMLInputElement>('input[name="interestAmount"]')?.value) || 0,
      taxExempt,
      promotionalInterest: taxExempt ? 0 : (Number(this.container.querySelector<HTMLInputElement>('input[name="promotionalInterest"]')?.value) || 0)
    };
  }

  override buildTaxExplanation(placement: BasePlacement, fiscalProfile: FiscalProfile): string {
    return getSavingsAccountTaxExplanation(placement as SavingsAccountModule, fiscalProfile);
  }
}
