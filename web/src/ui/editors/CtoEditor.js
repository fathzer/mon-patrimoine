import { BasePlacementEditor } from './BasePlacementEditor.js';
import { I18n } from '../../core/I18n.js';
import { getCtoTaxExplanation } from '../../i18n/ctoTaxExplanation.js';

export class CtoEditor extends BasePlacementEditor {
  _renderAfterInstitution(placement) {
    return `
      <div class="form-group">
        <label>${I18n.t('form.currentCtoValue')}</label>
        <input type="number" step="0.01" name="currentValue" class="form-control" value="${placement?.currentValue || 0}" required />
      </div>
      <div class="form-group">
        <label>${I18n.t('form.acquisitionValue')}</label>
        <input type="number" step="0.01" name="acquisitionValue" class="form-control" value="${placement?.acquisitionValue || 0}" />
      </div>
      <div class="form-group">
        <label>${I18n.t('form.cashBalance')}</label>
        <input type="number" step="0.01" name="cashBalance" class="form-control" value="${placement?.cashBalance || 0}" />
      </div>
    `;
  }

  _bindEvents() {
    super._bindEvents();
    ['currentValue', 'acquisitionValue', 'cashBalance'].forEach(name => {
      const input = this.container.querySelector(`input[name="${name}"]`);
      input?.addEventListener('input', () => this._notifyValidityChange());
    });
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
      acquisitionValue: Number(this.container.querySelector('input[name="acquisitionValue"]')?.value) || 0,
      cashBalance: Number(this.container.querySelector('input[name="cashBalance"]')?.value) || 0
    };
  }

  buildTaxExplanation(placement, fiscalProfile) {
    return getCtoTaxExplanation(placement, fiscalProfile);
  }
}
