import { BasePlacementEditor } from './BasePlacementEditor.js';
import { I18n } from '../../core/I18n.js';
import { getSavingsAccountTaxExplanation } from '../../i18n/savingsAccountTaxExplanation.js';

export class SavingsAccountBaseEditor extends BasePlacementEditor {
  _renderAfterInstitution(placement) {
    return `
      ${this._renderOpeningDate(placement)}
      ${this._renderCurrentValue(placement)}
      ${this._renderInterest(placement)}
      ${this._renderTaxExempt(placement)}
      ${this._renderPromotionalInterest(placement)}
    `;
  }

  _renderOpeningDate(placement) {
    return '';
  }

  _renderCurrentValue(placement) {
    return `
      <div class="form-group">
        <label>${I18n.t('form.currentValue')}</label>
        <input type="number" step="0.01" name="currentValue" class="form-control" value="${placement?.currentValue || 0}" required />
      </div>
    `;
  }

  _renderInterest(placement) {
    return `
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
    `;
  }

  _renderTaxExempt(placement) {
    return '';
  }

  _renderPromotionalInterest(placement) {
    return '';
  }

  _bindEvents() {
    super._bindEvents();
    ['currentValue', 'interestAmount', 'promotionalInterest', 'grossRate', 'openingDate'].forEach(name => {
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
    return {
      ...super.getData(),
      currentValue: Number(this.container.querySelector('input[name="currentValue"]')?.value) || 0,
      interestAmount: Number(this.container.querySelector('input[name="interestAmount"]')?.value) || 0
    };
  }

  buildTaxExplanation(placement, fiscalProfile) {
    return getSavingsAccountTaxExplanation(placement, fiscalProfile);
  }
}
