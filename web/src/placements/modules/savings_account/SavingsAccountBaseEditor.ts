import { BasePlacementEditor } from '../../../ui/BasePlacementEditor.js';
import { I18n } from '../../../core/I18n.js';
import type { BasePlacement } from '../../BasePlacement.js';
import type { SavingsAccountModule } from './module.js';

const labels = {
  interestAmount: 'Montant des intérêts (€)',
  calculator: 'Calculer',
  closeCalculator: 'Fermer',
  interestRateWarning: 'Attention, les taux ou l\'encours peuvent avoir évolué en cours d\'année, le calcul fait l\'hypothèse qu\'ils sont constants depuis le 1er janvier.',
  grossRate: 'Taux brut (%)'
};

/**
 * Shared base editor for savings-account-like placements (savings_account
 * and home_savings). Provides the common form fields (current value, interest,
 * calculator, tax-exempt checkbox, promotional interest) and the interest
 * calculator logic.
 *
 * Subclasses override the protected hooks to customize specific sections.
 */
export abstract class SavingsAccountBaseEditor extends BasePlacementEditor {
  protected override renderAfterInstitution(placement: BasePlacement | null): string {
    return `
      ${this.renderOpeningDate(placement)}
      ${this.renderCurrentValue(placement)}
      ${this.renderInterest(placement)}
      ${this.renderTaxExempt(placement)}
      ${this.renderPromotionalInterest(placement)}
    `;
  }

  /** Hook: renders the opening date field. Default: empty. */
  protected renderOpeningDate(_placement: BasePlacement | null): string {
    return '';
  }

  /** Renders the current value field (shared by all savings account editors). */
  protected renderCurrentValue(placement: BasePlacement | null): string {
    return `
      <div class="form-group">
        <label>${I18n.t('form.currentValue')}</label>
        <input type="number" step="0.01" name="currentValue" class="form-control" value="${(placement as SavingsAccountModule)?.currentValue || 0}" required />
      </div>
    `;
  }

  /** Renders the interest field with the calculator button and panel. */
  protected renderInterest(placement: BasePlacement | null): string {
    return `
      <div class="form-group">
        <label>${labels.interestAmount}</label>
        <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
          <input type="number" step="0.01" name="interestAmount" class="form-control" value="${(placement as SavingsAccountModule)?.interestAmount || 0}" />
          <button type="button" id="btn-calculator" class="btn-secondary" title="${labels.calculator}">🔢</button>
        </div>
        <div id="calculator-panel" style="display: none; padding: 0.75rem; background: rgba(0,0,0,0.05); border-radius: 4px;">
          <p class="text-muted" style="font-size: 0.8rem; margin-bottom: 0.5rem;">${labels.interestRateWarning}</p>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <input type="number" step="0.01" name="grossRate" class="form-control" placeholder="${labels.grossRate}" />
            <button type="button" id="btn-close-calculator" class="btn-secondary" title="${labels.closeCalculator}">✕</button>
          </div>
        </div>
      </div>
    `;
  }

  /** Hook: renders the tax-exempt checkbox. Default: empty. */
  protected renderTaxExempt(_placement: BasePlacement | null): string {
    return '';
  }

  /** Hook: renders the promotional interest field. Default: empty. */
  protected renderPromotionalInterest(_placement: BasePlacement | null): string {
    return '';
  }

  protected override bindPlacementEvents(): void {
    (['currentValue', 'interestAmount', 'promotionalInterest', 'grossRate', 'openingDate'] as const).forEach(name => {
      const input = this.container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      input?.addEventListener('input', () => this.notifyValidityChange());
    });

    const taxExempt = this.container.querySelector<HTMLInputElement>('input[name="taxExempt"]');
    taxExempt?.addEventListener('change', () => this.onTaxExemptChange());

    const calculatorBtn = this.container.querySelector<HTMLElement>('#btn-calculator');
    const closeBtn = this.container.querySelector<HTMLElement>('#btn-close-calculator');
    const grossRate = this.container.querySelector<HTMLInputElement>('input[name="grossRate"]');

    calculatorBtn?.addEventListener('click', () => this.openCalculator());
    closeBtn?.addEventListener('click', () => this.closeCalculator());
    grossRate?.addEventListener('input', () => this.updateInterestFromRate());
  }

  /** Hook: called when the tax-exempt checkbox changes. Default: notify validity. */
  protected onTaxExemptChange(): void {
    this.notifyValidityChange();
  }

  private openCalculator(): void {
    this.container.querySelector<HTMLElement>('#btn-calculator')!.style.display = 'none';
    this.container.querySelector<HTMLElement>('#calculator-panel')!.style.display = 'block';
    this.container.querySelector<HTMLInputElement>('input[name="grossRate"]')?.focus();
    this.updateInterestFromRate();
  }

  private closeCalculator(): void {
    this.container.querySelector<HTMLElement>('#btn-calculator')!.style.display = '';
    this.container.querySelector<HTMLElement>('#calculator-panel')!.style.display = 'none';
    this.notifyValidityChange();
  }

  private updateInterestFromRate(): void {
    const grossRateInput = this.container.querySelector<HTMLInputElement>('input[name="grossRate"]');
    const currentValueInput = this.container.querySelector<HTMLInputElement>('input[name="currentValue"]');
    const interestInput = this.container.querySelector<HTMLInputElement>('input[name="interestAmount"]');

    if (!grossRateInput || !currentValueInput || !interestInput) return;

    const rate = Number(grossRateInput.value) || 0;
    const currentValue = Number(currentValueInput.value) || 0;
    const elapsedFortnights = this.getElapsedFortnights(new Date());
    const interest = currentValue * (rate / 100) * (elapsedFortnights / 24);
    interestInput.value = interest.toFixed(2);
    this.notifyValidityChange();
  }

  private getElapsedFortnights(date: Date): number {
    const monthIndex = date.getMonth();
    const day = date.getDate();
    return monthIndex * 2 + (day > 15 ? 1 : 0);
  }

  protected override isPlacementValid(): boolean {
    const currentValue = this.container.querySelector<HTMLInputElement>('input[name="currentValue"]');
    return currentValue ? currentValue.checkValidity() : true;
  }

  protected override collectData(): Record<string, unknown> {
    return {
      currentValue: Number(this.container.querySelector<HTMLInputElement>('input[name="currentValue"]')?.value) || 0,
      interestAmount: Number(this.container.querySelector<HTMLInputElement>('input[name="interestAmount"]')?.value) || 0
    };
  }
}
