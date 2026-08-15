import { BasePlacementEditor } from './BasePlacementEditor.js';
import { I18n } from '../../core/I18n.js';
import { getRealEstateTaxExplanation, getAcquisitionFeesHelp } from '../../i18n/realEstateTaxExplanation.js';
import { HelpPopover } from '../HelpPopover.js';

export class RealEstateEditor extends BasePlacementEditor {
  constructor(container, store) {
    super(container);
    this.store = store;
  }

  _renderInstitution(placement) {
    return '';
  }

  _renderAfterInstitution(placement) {
    const isPrimary = placement?.primaryResidence === true;
    const displayDetails = isPrimary ? 'none' : 'block';
    const disabled = isPrimary ? 'disabled' : '';
    const required = isPrimary ? '' : 'required';
    const acquisitionDateValue = placement?.acquisitionDate || '';
    const acquisitionPriceValue = placement?.acquisitionPrice || 0;
    const freeAcquisition = placement?.freeAcquisition === true;
    const acquisitionFeesValue = placement?.acquisitionFees || 0;
    const worksValue = placement?.works || 0;

    return `
      <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem;">
        <input type="checkbox" name="primaryResidence" id="primary-residence" ${isPrimary ? 'checked' : ''} />
        <label for="primary-residence" style="margin: 0;">${I18n.t('form.primaryResidence')}</label>
      </div>
      <div id="primary-residence-warning" class="form-group text-muted" style="font-size: 0.8rem; display: none; color: var(--danger);">
        ${I18n.t('form.multiplePrimaryResidenceWarning')}
      </div>
      <div class="form-group">
        <label>${I18n.t('form.currentValue')}</label>
        <input type="number" step="0.01" name="currentValue" class="form-control" value="${placement?.currentValue || 0}" required />
      </div>
      <div id="acquisition-details" style="display: ${displayDetails};">
        <div class="form-group">
          <label>${I18n.t('form.acquisitionDate')}</label>
          <div style="display: flex; align-items: center; gap: 1rem;">
            <input type="date" name="acquisitionDate" class="form-control" value="${acquisitionDateValue}" ${required} ${disabled} style="flex: 1;" />
            <div style="display: flex; align-items: center; gap: 0.5rem; white-space: nowrap;">
              <input type="checkbox" name="freeAcquisition" id="free-acquisition" ${freeAcquisition ? 'checked' : ''} ${disabled} />
              <label for="free-acquisition" style="margin: 0;">${I18n.t('form.freeAcquisition')}</label>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label>${I18n.t('form.acquisitionPrice')} ${getAcquisitionFeesHelp('?')}</label>
          <input type="number" step="0.01" name="acquisitionPrice" class="form-control" value="${acquisitionPriceValue}" ${required} ${disabled} />
        </div>
        <div class="form-group">
          <label>${I18n.t('form.acquisitionFees')}</label>
          <input type="number" step="0.01" name="acquisitionFees" class="form-control" value="${acquisitionFeesValue}" ${disabled} />
        </div>
        <div class="form-group">
          <label>${I18n.t('form.works')}</label>
          <input type="number" step="0.01" name="works" class="form-control" value="${worksValue}" ${disabled} />
        </div>
      </div>
    `;
  }

  _bindEvents() {
    const primaryResidence = this.container.querySelector('input[name="primaryResidence"]');
    primaryResidence?.addEventListener('change', () => this._onPrimaryResidenceChange());

    ['currentValue', 'acquisitionDate', 'acquisitionPrice', 'acquisitionFees', 'works'].forEach(name => {
      const input = this.container.querySelector(`input[name="${name}"]`);
      input?.addEventListener('input', () => this._notifyValidityChange());
    });
  }

  _onPrimaryResidenceChange() {
    const primaryResidence = this.container.querySelector('input[name="primaryResidence"]');
    const isPrimary = primaryResidence?.checked ?? false;

    const details = this.container.querySelector('#acquisition-details');
    if (details) details.style.display = isPrimary ? 'none' : 'block';

    this._configureField('acquisitionDate', isPrimary, { reset: '', required: true });
    this._configureField('acquisitionPrice', isPrimary, { reset: 0, required: true });
    this._configureField('acquisitionFees', isPrimary, { reset: 0 });
    this._configureField('works', isPrimary, { reset: 0 });
    this._configureCheckbox('freeAcquisition', isPrimary);

    this._updatePrimaryResidenceWarning();
    this._notifyValidityChange();
  }

  _configureField(name, isPrimary, options) {
    const input = this.container.querySelector(`input[name="${name}"]`);
    if (!input) return;

    input.disabled = isPrimary;
    if (options.required) input.required = !isPrimary;
    if (isPrimary && 'reset' in options) input.value = options.reset;
  }

  _configureCheckbox(name, isPrimary) {
    const input = this.container.querySelector(`input[name="${name}"]`);
    if (!input) return;

    input.disabled = isPrimary;
    if (isPrimary) input.checked = false;
  }

  _updatePrimaryResidenceWarning() {
    const warning = this.container.querySelector('#primary-residence-warning');
    const primaryResidence = this.container.querySelector('input[name="primaryResidence"]');
    const isPrimary = primaryResidence?.checked ?? false;

    if (!warning) return;
    warning.style.display = isPrimary && this._hasOtherPrimaryResidence() ? 'block' : 'none';
  }

  _hasOtherPrimaryResidence() {
    const placements = this.store?.state?.placements || [];
    const currentId = this._currentPlacementId;
    return placements.some(p => p.type === 'real_estate' && p.primaryResidence === true && p.id !== currentId);
  }

  render(placement = null) {
    this._currentPlacementId = placement?.id;
    super.render(placement);
    this._updatePrimaryResidenceWarning();
  }

  isValid() {
    if (!super.isValid()) return false;
    const currentValue = this.container.querySelector('input[name="currentValue"]');
    const acquisitionDate = this.container.querySelector('input[name="acquisitionDate"]');
    const acquisitionPrice = this.container.querySelector('input[name="acquisitionPrice"]');
    const currentValueValid = currentValue ? currentValue.checkValidity() : true;
    const dateValid = acquisitionDate ? acquisitionDate.checkValidity() : true;
    const priceValid = acquisitionPrice ? acquisitionPrice.checkValidity() : true;
    return currentValueValid && dateValid && priceValid;
  }

  getData() {
    const primaryResidence = this.container.querySelector('input[name="primaryResidence"]')?.checked ?? false;
    const acquisitionPrice = primaryResidence ? 0 : (Number(this.container.querySelector('input[name="acquisitionPrice"]')?.value) || 0);
    const acquisitionDate = primaryResidence ? '' : (this.container.querySelector('input[name="acquisitionDate"]')?.value || '');

    return {
      ...super.getData(),
      primaryResidence,
      currentValue: Number(this.container.querySelector('input[name="currentValue"]')?.value) || 0,
      acquisitionDate,
      acquisitionPrice,
      freeAcquisition: primaryResidence ? false : (this.container.querySelector('input[name="freeAcquisition"]')?.checked ?? false),
      acquisitionFees: primaryResidence ? 0 : (Number(this.container.querySelector('input[name="acquisitionFees"]')?.value) || 0),
      works: primaryResidence ? 0 : (Number(this.container.querySelector('input[name="works"]')?.value) || 0)
    };
  }

  buildTaxExplanation(placement, fiscalProfile) {
    return getRealEstateTaxExplanation(placement);
  }
}
