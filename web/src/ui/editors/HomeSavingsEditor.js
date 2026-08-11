import { SavingsAccountBaseEditor } from './SavingsAccountBaseEditor.js';
import { I18n } from '../../core/I18n.js';

export class HomeSavingsEditor extends SavingsAccountBaseEditor {
  _renderBeforeInstitution(placement) {
    const homeSavingsType = placement?.homeSavingsType || 'pel';
    return `
      <div class="form-group">
        <label>${I18n.t('form.homeSavingsType')}</label>
        <div style="display: flex; gap: 1rem;">
          <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer;">
            <input type="radio" name="homeSavingsType" value="pel" ${homeSavingsType === 'pel' ? 'checked' : ''} />
            ${I18n.t('form.pel')}
          </label>
          <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer;">
            <input type="radio" name="homeSavingsType" value="cel" ${homeSavingsType === 'cel' ? 'checked' : ''} />
            ${I18n.t('form.cel')}
          </label>
        </div>
      </div>
    `;
  }

  _renderOpeningDate(placement) {
    return `
      <div class="form-group">
        <label>${I18n.t('form.openingDate')}</label>
        <input type="date" name="openingDate" class="form-control" value="${placement?.openingDate || ''}" required />
      </div>
    `;
  }

  _renderTaxExempt(placement) {
    return '';
  }

  _bindEvents() {
    super._bindEvents();
    const homeSavingsType = this.container.querySelectorAll('input[name="homeSavingsType"]');
    homeSavingsType.forEach(radio => {
      radio.addEventListener('change', () => this._notifyValidityChange());
    });
  }

  isValid() {
    if (!super.isValid()) return false;
    const currentValue = this.container.querySelector('input[name="currentValue"]');
    const openingDate = this.container.querySelector('input[name="openingDate"]');
    const currentValueValid = currentValue ? currentValue.checkValidity() : true;
    const openingDateValid = openingDate ? openingDate.checkValidity() : true;
    return currentValueValid && openingDateValid;
  }

  getData() {
    const homeSavingsTypeInput = this.container.querySelector('input[name="homeSavingsType"]:checked');
    return {
      ...super.getData(),
      homeSavingsType: homeSavingsTypeInput ? homeSavingsTypeInput.value : 'pel',
      openingDate: this.container.querySelector('input[name="openingDate"]')?.value || '',
      interestAmount: Number(this.container.querySelector('input[name="interestAmount"]')?.value) || 0,
      taxExempt: false,
      promotionalInterest: 0
    };
  }
}
