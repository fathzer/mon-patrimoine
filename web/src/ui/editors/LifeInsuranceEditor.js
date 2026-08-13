import { BasePlacementEditor } from './BasePlacementEditor.js';
import { I18n } from '../../core/I18n.js';
import { getLifeInsuranceTaxExplanation } from '../../i18n/lifeInsuranceTaxExplanation.js';

const REFORM_DATE = '2017-09-27';

export class LifeInsuranceEditor extends BasePlacementEditor {
  _renderAfterInstitution(placement) {
    const openingDate = placement?.openingDate || new Date().toISOString().split('T')[0];
    const showPre2017 = this._isPre2017(openingDate);

    return `
      <div class="form-group">
        <label>${I18n.t('form.openingDate')}</label>
        <input type="date" name="openingDate" class="form-control" value="${openingDate}" required />
      </div>
      <div class="form-group">
        <label>${I18n.t('form.totalPremiums')}</label>
        <input type="number" step="0.01" name="totalPremiums" class="form-control" value="${placement?.totalPremiums || 0}" required />
      </div>
      <div class="form-group" id="pre-2017-group" style="display: ${showPre2017 ? 'block' : 'none'};">
        <label>${I18n.t('form.pre2017Premiums')}</label>
        <input type="number" step="0.01" name="pre2017Premiums" class="form-control" value="${placement?.pre2017Premiums || 0}" />
      </div>
      <div class="form-group">
        <label>${I18n.t('form.currentValue')}</label>
        <input type="number" step="0.01" name="currentValue" class="form-control" value="${placement?.currentValue || 0}" required />
      </div>
      <div class="form-group">
        <label>${I18n.t('form.euroFundsValue')}</label>
        <input type="number" step="0.01" name="euroFundsValue" class="form-control" value="${placement?.euroFundsValue || 0}" required />
      </div>
      <div class="form-group" style="font-size: 0.8rem; color: var(--danger);">
        ${I18n.t('form.lifeInsuranceWarning')}
      </div>
    `;
  }

  _isPre2017(dateString) {
    return dateString && dateString < REFORM_DATE;
  }

  _bindEvents() {
    super._bindEvents();
    const openingDate = this.container.querySelector('input[name="openingDate"]');
    openingDate?.addEventListener('input', () => this._onOpeningDateChange());
    ['openingDate', 'totalPremiums', 'pre2017Premiums', 'currentValue', 'euroFundsValue'].forEach(name => {
      const input = this.container.querySelector(`input[name="${name}"]`);
      input?.addEventListener('input', () => this._notifyValidityChange());
    });
  }

  _onOpeningDateChange() {
    const openingDate = this.container.querySelector('input[name="openingDate"]')?.value || '';
    const group = this.container.querySelector('#pre-2017-group');
    const input = this.container.querySelector('input[name="pre2017Premiums"]');
    if (group && input) {
      const show = this._isPre2017(openingDate);
      group.style.display = show ? 'block' : 'none';
      if (!show) {
        input.value = 0;
      }
    }
    this._notifyValidityChange();
  }

  isValid() {
    if (!super.isValid()) return false;
    const required = ['openingDate', 'totalPremiums', 'currentValue', 'euroFundsValue'];
    return required.every(name => {
      const input = this.container.querySelector(`input[name="${name}"]`);
      return input ? input.checkValidity() : true;
    });
  }

  getData() {
    const openingDate = this.container.querySelector('input[name="openingDate"]')?.value || '';
    const isPre2017 = this._isPre2017(openingDate);
    return {
      ...super.getData(),
      openingDate,
      totalPremiums: Number(this.container.querySelector('input[name="totalPremiums"]')?.value) || 0,
      pre2017Premiums: isPre2017 ? (Number(this.container.querySelector('input[name="pre2017Premiums"]')?.value) || 0) : 0,
      currentValue: Number(this.container.querySelector('input[name="currentValue"]')?.value) || 0,
      euroFundsValue: Number(this.container.querySelector('input[name="euroFundsValue"]')?.value) || 0
    };
  }

  buildTaxExplanation(placement, fiscalProfile) {
    return getLifeInsuranceTaxExplanation(placement, fiscalProfile);
  }
}
