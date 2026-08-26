import { BasePlacementEditor, I18n } from '../../kit/v1/index.js';
import { getRealEstateTaxExplanation, getAcquisitionFeesHelp } from './TaxExplanation.js';
import type { BasePlacement, FiscalProfile, AppStore } from '../../kit/v1/index.js';
import type { RealEstateModule } from './module.js';

const labels = {
  primaryResidence: 'Résidence principale',
  multiplePrimaryResidenceWarning: 'Attention : une autre résidence principale est déjà déclarée.',
  freeAcquisition: 'Acquisition à titre gratuit',
  acquisitionFees: 'Frais d\'acquisition (sur justificatifs)',
  works: 'Travaux éligibles (sur justificatifs)'
};

interface ConfigureFieldOptions {
  reset?: string | number;
  required?: boolean;
}

export class RealEstateEditor extends BasePlacementEditor {
  store: AppStore | undefined;
  _currentPlacementId: string | undefined;

  constructor(container: HTMLElement, store?: AppStore) {
    super(container);
    this.store = store;
  }

  override _renderInstitution(_placement: BasePlacement | null): string {
    return '';
  }

  override _renderAfterInstitution(placement: BasePlacement | null): string {
    const p = placement as RealEstateModule | null;
    const isPrimary = p?.primaryResidence === true;
    const displayDetails = isPrimary ? 'none' : 'block';
    const disabled = isPrimary ? 'disabled' : '';
    const required = isPrimary ? '' : 'required';
    const acquisitionDateValue = p?.acquisitionDate || '';
    const acquisitionPriceValue = p?.acquisitionPrice || 0;
    const freeAcquisition = p?.freeAcquisition === true;
    const acquisitionFeesValue = p?.acquisitionFees || 0;
    const worksValue = p?.works || 0;

    return `
      <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem;">
        <input type="checkbox" name="primaryResidence" id="primary-residence" ${isPrimary ? 'checked' : ''} />
        <label for="primary-residence" style="margin: 0;">${labels.primaryResidence}</label>
      </div>
      <div id="primary-residence-warning" class="form-group text-muted" style="font-size: 0.8rem; display: none; color: var(--danger);">
        ${labels.multiplePrimaryResidenceWarning}
      </div>
      <div class="form-group">
        <label>${I18n.t('form.currentValue')}</label>
        <input type="number" step="0.01" name="currentValue" class="form-control" value="${p?.currentValue || 0}" required />
      </div>
      <div id="acquisition-details" style="display: ${displayDetails};">
        <div class="form-group">
          <label>${I18n.t('form.acquisitionDate')}</label>
          <div style="display: flex; align-items: center; gap: 1rem;">
            <input type="date" name="acquisitionDate" class="form-control" value="${acquisitionDateValue}" ${required} ${disabled} style="flex: 1;" />
            <div style="display: flex; align-items: center; gap: 0.5rem; white-space: nowrap;">
              <input type="checkbox" name="freeAcquisition" id="free-acquisition" ${freeAcquisition ? 'checked' : ''} ${disabled} />
              <label for="free-acquisition" style="margin: 0;">${labels.freeAcquisition}</label>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label>${I18n.t('form.acquisitionPrice')} ${getAcquisitionFeesHelp('?')}</label>
          <input type="number" step="0.01" name="acquisitionPrice" class="form-control" value="${acquisitionPriceValue}" ${required} ${disabled} />
        </div>
        <div class="form-group">
          <label>${labels.acquisitionFees}</label>
          <input type="number" step="0.01" name="acquisitionFees" class="form-control" value="${acquisitionFeesValue}" ${disabled} />
        </div>
        <div class="form-group">
          <label>${labels.works}</label>
          <input type="number" step="0.01" name="works" class="form-control" value="${worksValue}" ${disabled} />
        </div>
      </div>
    `;
  }

  override _bindEvents(): void {
    const primaryResidence = this.container.querySelector<HTMLInputElement>('input[name="primaryResidence"]');
    primaryResidence?.addEventListener('change', () => this._onPrimaryResidenceChange());

    (['currentValue', 'acquisitionDate', 'acquisitionPrice', 'acquisitionFees', 'works'] as const).forEach(name => {
      const input = this.container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      input?.addEventListener('input', () => this._notifyValidityChange());
    });
  }

  _onPrimaryResidenceChange(): void {
    const primaryResidence = this.container.querySelector<HTMLInputElement>('input[name="primaryResidence"]');
    const isPrimary = primaryResidence?.checked ?? false;

    const details = this.container.querySelector<HTMLElement>('#acquisition-details');
    if (details) details.style.display = isPrimary ? 'none' : 'block';

    this._configureField('acquisitionDate', isPrimary, { reset: '', required: true });
    this._configureField('acquisitionPrice', isPrimary, { reset: 0, required: true });
    this._configureField('acquisitionFees', isPrimary, { reset: 0 });
    this._configureField('works', isPrimary, { reset: 0 });
    this._configureCheckbox('freeAcquisition', isPrimary);

    this._updatePrimaryResidenceWarning();
    this._notifyValidityChange();
  }

  _configureField(name: string, isPrimary: boolean, options: ConfigureFieldOptions): void {
    const input = this.container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
    if (!input) return;

    input.disabled = isPrimary;
    if (options.required) input.required = !isPrimary;
    if (isPrimary && 'reset' in options) input.value = String(options.reset);
  }

  _configureCheckbox(name: string, isPrimary: boolean): void {
    const input = this.container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
    if (!input) return;

    input.disabled = isPrimary;
    if (isPrimary) input.checked = false;
  }

  _updatePrimaryResidenceWarning(): void {
    const warning = this.container.querySelector<HTMLElement>('#primary-residence-warning');
    const primaryResidence = this.container.querySelector<HTMLInputElement>('input[name="primaryResidence"]');
    const isPrimary = primaryResidence?.checked ?? false;

    if (!warning) return;
    warning.style.display = isPrimary && this._hasOtherPrimaryResidence() ? 'block' : 'none';
  }

  _hasOtherPrimaryResidence(): boolean {
    const placements = this.store?.state?.placements || [];
    const currentId = this._currentPlacementId;
    return placements.some(p => p.type === 'real_estate' && (p as RealEstateModule).primaryResidence === true && p.id !== currentId);
  }

  override render(placement: BasePlacement | null = null): void {
    this._currentPlacementId = placement?.id;
    super.render(placement);
    this._updatePrimaryResidenceWarning();
  }

  override isValid(): boolean {
    if (!super.isValid()) return false;
    const currentValue = this.container.querySelector<HTMLInputElement>('input[name="currentValue"]');
    const acquisitionDate = this.container.querySelector<HTMLInputElement>('input[name="acquisitionDate"]');
    const acquisitionPrice = this.container.querySelector<HTMLInputElement>('input[name="acquisitionPrice"]');
    const currentValueValid = currentValue ? currentValue.checkValidity() : true;
    const dateValid = acquisitionDate ? acquisitionDate.checkValidity() : true;
    const priceValid = acquisitionPrice ? acquisitionPrice.checkValidity() : true;
    return currentValueValid && dateValid && priceValid;
  }

  override getData(): Record<string, unknown> {
    const primaryResidence = this.container.querySelector<HTMLInputElement>('input[name="primaryResidence"]')?.checked ?? false;
    const acquisitionPrice = primaryResidence ? 0 : (Number(this.container.querySelector<HTMLInputElement>('input[name="acquisitionPrice"]')?.value) || 0);
    const acquisitionDate = primaryResidence ? '' : (this.container.querySelector<HTMLInputElement>('input[name="acquisitionDate"]')?.value || '');

    return {
      ...super.getData(),
      primaryResidence,
      currentValue: Number(this.container.querySelector<HTMLInputElement>('input[name="currentValue"]')?.value) || 0,
      acquisitionDate,
      acquisitionPrice,
      freeAcquisition: primaryResidence ? false : (this.container.querySelector<HTMLInputElement>('input[name="freeAcquisition"]')?.checked ?? false),
      acquisitionFees: primaryResidence ? 0 : (Number(this.container.querySelector<HTMLInputElement>('input[name="acquisitionFees"]')?.value) || 0),
      works: primaryResidence ? 0 : (Number(this.container.querySelector<HTMLInputElement>('input[name="works"]')?.value) || 0)
    };
  }

  override buildTaxExplanation(placement: BasePlacement, _fiscalProfile: FiscalProfile): string {
    return getRealEstateTaxExplanation(placement as RealEstateModule);
  }
}
