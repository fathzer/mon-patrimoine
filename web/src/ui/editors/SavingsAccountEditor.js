import { BasePlacementEditor } from './BasePlacementEditor.js';
import { I18n } from '../../core/I18n.js';

export class SavingsAccountEditor extends BasePlacementEditor {
  render(placement = null) {
    super.render(placement);
    const field = document.createElement('div');
    const taxExempt = placement?.taxExempt !== false;

    field.innerHTML = `
      <div class="form-group">
        <label>${I18n.t('form.currentValue')}</label>
        <input type="number" step="0.01" name="currentValue" class="form-control" value="${placement?.currentValue || 0}" required />
      </div>
      <div class="form-group">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
          <input type="checkbox" name="taxExempt" id="tax-exempt" ${taxExempt ? 'checked' : ''} />
          <label for="tax-exempt" style="margin: 0;">${I18n.t('form.taxExempt')}</label>
        </div>
        <p class="text-muted" style="font-size: 0.8rem; margin: 0; padding-left: 1.5rem;">${I18n.t('form.taxExemptTooltip')}</p>
      </div>
      <div class="form-group">
        <label>${I18n.t('form.interestAmount')}</label>
        <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
          <input type="number" step="0.01" name="interestAmount" class="form-control" value="${placement?.interestAmount || 0}" />
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
      <div class="form-group" id="promotional-interest-group" style="display: ${taxExempt ? 'none' : 'block'};">
        <label>${I18n.t('form.promotionalInterest')}</label>
        <input type="number" step="0.01" name="promotionalInterest" class="form-control" value="${taxExempt ? 0 : (placement?.promotionalInterest || 0)}" />
      </div>
    `;
    this.container.appendChild(field);
    this._bindSpecificEvents();
  }

  _bindSpecificEvents() {
    ['currentValue', 'interestAmount', 'promotionalInterest'].forEach(name => {
      const input = this.container.querySelector(`input[name="${name}"]`);
      input?.addEventListener('input', () => this._notifyValidityChange());
    });

    const taxExempt = this.container.querySelector('input[name="taxExempt"]');
    taxExempt?.addEventListener('change', () => this._onTaxExemptChange());

    const calculatorBtn = this.container.querySelector('#btn-calculator');
    const closeBtn = this.container.querySelector('#btn-close-calculator');
    const grossRate = this.container.querySelector('input[name="grossRate"]');

    calculatorBtn?.addEventListener('click', () => this._openCalculator());
    closeBtn?.addEventListener('click', () => this._closeCalculator());
    grossRate?.addEventListener('input', () => this._updateInterestFromRate());
  }

  _onTaxExemptChange() {
    const taxExempt = this.container.querySelector('input[name="taxExempt"]');
    const promotionalGroup = this.container.querySelector('#promotional-interest-group');
    const promotionalInput = this.container.querySelector('input[name="promotionalInterest"]');

    if (taxExempt && promotionalGroup && promotionalInput) {
      const isExempt = taxExempt.checked;
      promotionalGroup.style.display = isExempt ? 'none' : 'block';
      promotionalInput.value = isExempt ? 0 : (promotionalInput.value || 0);
    }
    this._notifyValidityChange();
  }

  _openCalculator() {
    this.container.querySelector('#btn-calculator').style.display = 'none';
    this.container.querySelector('#calculator-panel').style.display = 'block';
    this.container.querySelector('input[name="grossRate"]')?.focus();
    this._updateInterestFromRate();
  }

  _closeCalculator() {
    this.container.querySelector('#btn-calculator').style.display = '';
    this.container.querySelector('#calculator-panel').style.display = 'none';
    this._notifyValidityChange();
  }

  _updateInterestFromRate() {
    const grossRateInput = this.container.querySelector('input[name="grossRate"]');
    const currentValueInput = this.container.querySelector('input[name="currentValue"]');
    const interestInput = this.container.querySelector('input[name="interestAmount"]');

    if (!grossRateInput || !currentValueInput || !interestInput) return;

    const rate = Number(grossRateInput.value) || 0;
    const currentValue = Number(currentValueInput.value) || 0;
    const elapsedFortnights = this._getElapsedFortnights(new Date());
    const interest = currentValue * (rate / 100) * (elapsedFortnights / 24);
    interestInput.value = interest.toFixed(2);
    this._notifyValidityChange();
  }

  _getElapsedFortnights(date) {
    const monthIndex = date.getMonth();
    const day = date.getDate();
    return monthIndex * 2 + (day > 15 ? 1 : 0);
  }

  isValid() {
    if (!super.isValid()) return false;
    const currentValue = this.container.querySelector('input[name="currentValue"]');
    return currentValue ? currentValue.checkValidity() : true;
  }

  getData() {
    const taxExempt = this.container.querySelector('input[name="taxExempt"]')?.checked ?? true;
    return {
      ...super.getData(),
      currentValue: Number(this.container.querySelector('input[name="currentValue"]')?.value) || 0,
      interestAmount: Number(this.container.querySelector('input[name="interestAmount"]')?.value) || 0,
      taxExempt,
      promotionalInterest: taxExempt ? 0 : (Number(this.container.querySelector('input[name="promotionalInterest"]')?.value) || 0)
    };
  }
}
