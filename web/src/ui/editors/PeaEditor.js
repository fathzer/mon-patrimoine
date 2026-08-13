import { BasePlacementEditor } from './BasePlacementEditor.js';
import { I18n } from '../../core/I18n.js';
import { getPeaTaxExplanation } from '../../i18n/peaTaxExplanation.js';

export class PeaEditor extends BasePlacementEditor {
  render(placement = null) {
    super.render(placement);
    const field = document.createElement('div');
    field.innerHTML = `
      <div class="form-group">
        <label>${I18n.t('form.currentValue')}</label>
        <input type="number" step="0.01" name="currentValue" class="form-control" value="${placement?.currentValue || 0}" required />
      </div>
      <div class="form-group">
        <label>${I18n.t('form.totalDeposits')}</label>
        <input type="number" step="0.01" name="totalDeposits" class="form-control" value="${placement?.totalDeposits || 0}" />
      </div>
      <div class="form-group">
        <label>${I18n.t('form.openingDate')}</label>
        <input type="date" name="openingDate" class="form-control" value="${placement?.openingDate || ''}" required />
      </div>
    `;
    this.container.appendChild(field);
    this._bindSpecificEvents();
  }

  _bindSpecificEvents() {
    ['currentValue', 'totalDeposits', 'openingDate'].forEach(name => {
      const input = this.container.querySelector(`input[name="${name}"]`);
      input?.addEventListener('input', () => this._notifyValidityChange());
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
    return {
      ...super.getData(),
      currentValue: Number(this.container.querySelector('input[name="currentValue"]')?.value) || 0,
      totalDeposits: Number(this.container.querySelector('input[name="totalDeposits"]')?.value) || 0,
      openingDate: this.container.querySelector('input[name="openingDate"]')?.value || ''
    };
  }

  buildTaxExplanation(placement, fiscalProfile) {
    return getPeaTaxExplanation(placement, fiscalProfile);
  }
}
