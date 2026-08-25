import { BasePlacementEditor } from './BasePlacementEditor.js';
import { I18n } from '../../core/I18n.js';
import type { BasePlacement } from '../../modules/BasePlacement.js';
import type { SavingsAccountModule } from '../../modules/SavingsAccountModule.js';

export abstract class SavingsAccountBaseEditor extends BasePlacementEditor {
  override _renderAfterInstitution(placement: BasePlacement | null): string {
    return `
      ${this._renderOpeningDate(placement)}
      ${this._renderCurrentValue(placement)}
      ${this._renderInterest(placement)}
      ${this._renderTaxExempt(placement)}
      ${this._renderPromotionalInterest(placement)}
    `;
  }

  _renderOpeningDate(_placement: BasePlacement | null): string {
    return '';
  }

  _renderCurrentValue(placement: BasePlacement | null): string {
    return `
      <div class="form-group">
        <label>${I18n.t('form.currentValue')}</label>
        <input type="number" step="0.01" name="currentValue" class="form-control" value="${(placement as SavingsAccountModule)?.currentValue || 0}" required />
      </div>
    `;
  }

  _renderInterest(placement: BasePlacement | null): string {
    return `
      <div class="form-group">
        <label>${I18n.t('form.interestAmount')}</label>
        <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
          <input type="number" step="0.01" name="interestAmount" class="form-control" value="${(placement as SavingsAccountModule)?.interestAmount || 0}" />
          <button type="button" id="btn-calculator" class="btn-secondary" title="${I18n.t('form.calculator')}">🔢</button>
        </div>
        <div id="calculator-panel" style="display: none; padding: 0.75rem; background: rgba(0,0,0,0.05); border-radius: 4px;">
          <p class="text-muted" style="font-size: 0.8rem; margin-bottom: 0.5rem;">${I18n.t('form.interestRateWarning')}</p>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <input type="number" step="0.01" name="grossRate" class="form-control" placeholder="${I18n.t('form.grossRate')}" />
            <button type="button" id="btn-close-calculator" class="btn-secondary" title="${I18n.t('form.closeCalculator')}">✕</button>
          </div>
        </div>
      </div>
    `;
  }

  _renderTaxExempt(_placement: BasePlacement | null): string {
    return '';
  }

  _renderPromotionalInterest(_placement: BasePlacement | null): string {
    return '';
  }

  override _bindEvents(): void {
    super._bindEvents();
    (['currentValue', 'interestAmount', 'promotionalInterest', 'grossRate', 'openingDate'] as const).forEach(name => {
      const input = this.container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      input?.addEventListener('input', () => this._notifyValidityChange());
    });

    const taxExempt = this.container.querySelector<HTMLInputElement>('input[name="taxExempt"]');
    taxExempt?.addEventListener('change', () => this._onTaxExemptChange());

    const calculatorBtn = this.container.querySelector<HTMLElement>('#btn-calculator');
    const closeBtn = this.container.querySelector<HTMLElement>('#btn-close-calculator');
    const grossRate = this.container.querySelector<HTMLInputElement>('input[name="grossRate"]');

    calculatorBtn?.addEventListener('click', () => this._openCalculator());
    closeBtn?.addEventListener('click', () => this._closeCalculator());
    grossRate?.addEventListener('input', () => this._updateInterestFromRate());
  }

  _onTaxExemptChange(): void {
    this._notifyValidityChange();
  }

  _openCalculator(): void {
    this.container.querySelector<HTMLElement>('#btn-calculator')!.style.display = 'none';
    this.container.querySelector<HTMLElement>('#calculator-panel')!.style.display = 'block';
    this.container.querySelector<HTMLInputElement>('input[name="grossRate"]')?.focus();
    this._updateInterestFromRate();
  }

  _closeCalculator(): void {
    this.container.querySelector<HTMLElement>('#btn-calculator')!.style.display = '';
    this.container.querySelector<HTMLElement>('#calculator-panel')!.style.display = 'none';
    this._notifyValidityChange();
  }

  _updateInterestFromRate(): void {
    const grossRateInput = this.container.querySelector<HTMLInputElement>('input[name="grossRate"]');
    const currentValueInput = this.container.querySelector<HTMLInputElement>('input[name="currentValue"]');
    const interestInput = this.container.querySelector<HTMLInputElement>('input[name="interestAmount"]');

    if (!grossRateInput || !currentValueInput || !interestInput) return;

    const rate = Number(grossRateInput.value) || 0;
    const currentValue = Number(currentValueInput.value) || 0;
    const elapsedFortnights = this._getElapsedFortnights(new Date());
    const interest = currentValue * (rate / 100) * (elapsedFortnights / 24);
    interestInput.value = interest.toFixed(2);
    this._notifyValidityChange();
  }

  _getElapsedFortnights(date: Date): number {
    const monthIndex = date.getMonth();
    const day = date.getDate();
    return monthIndex * 2 + (day > 15 ? 1 : 0);
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
      interestAmount: Number(this.container.querySelector<HTMLInputElement>('input[name="interestAmount"]')?.value) || 0
    };
  }
}
