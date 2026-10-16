import { BasePlacementEditor, I18n, ToggleSwitch } from '../../kit/v1/index.js';
import { getAcquisitionFeesHelp } from './TaxExplanation.js';
import type { BasePlacement, AppStore } from '../../kit/v1/index.js';
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
  private readonly store: AppStore | undefined;
  private currentPlacementId: string | undefined;

  constructor(container: HTMLElement, store?: AppStore) {
    super(container);
    this.store = store;
  }

  /** Real estate does not use an institution field. */
  protected override hasInstitution(): boolean {
    return false;
  }

  protected override renderAfterInstitution(placement: BasePlacement | null): string {
    this.currentPlacementId = placement?.id;
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
      <div class="form-group">
        ${ToggleSwitch.create({
          name: 'primaryResidence',
          id: 'primary-residence',
          label: labels.primaryResidence,
          checked: isPrimary
        })}
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
            ${ToggleSwitch.create({
              name: 'freeAcquisition',
              id: 'free-acquisition',
              label: labels.freeAcquisition,
              checked: freeAcquisition
            })}
          </div>
        </div>
        <div class="form-group">
          <label>${I18n.t('form.acquisitionPrice')} ${getAcquisitionFeesHelp('?', true)}</label>
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

  protected override bindPlacementEvents(): void {
    this.updatePrimaryResidenceWarning();

    const primaryResidence = this.container.querySelector<HTMLInputElement>('input[name="primaryResidence"]');
    primaryResidence?.addEventListener('change', () => this.onPrimaryResidenceChange());

    (['currentValue', 'acquisitionDate', 'acquisitionPrice', 'acquisitionFees', 'works'] as const).forEach(name => {
      const input = this.container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      input?.addEventListener('input', () => this.notifyValidityChange());
    });
  }

  private onPrimaryResidenceChange(): void {
    const primaryResidence = this.container.querySelector<HTMLInputElement>('input[name="primaryResidence"]');
    const isPrimary = primaryResidence?.checked ?? false;

    const details = this.container.querySelector<HTMLElement>('#acquisition-details');
    if (details) details.style.display = isPrimary ? 'none' : 'block';

    this.configureField('acquisitionDate', isPrimary, { reset: '', required: true });
    this.configureField('acquisitionPrice', isPrimary, { reset: 0, required: true });
    this.configureField('acquisitionFees', isPrimary, { reset: 0 });
    this.configureField('works', isPrimary, { reset: 0 });

    this.updatePrimaryResidenceWarning();
    this.notifyValidityChange();
  }

  private configureField(name: string, isPrimary: boolean, options: ConfigureFieldOptions): void {
    const input = this.container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
    if (!input) return;

    input.disabled = isPrimary;
    if (options.required) input.required = !isPrimary;
    if (isPrimary && 'reset' in options) input.value = String(options.reset);
  }

  private updatePrimaryResidenceWarning(): void {
    const warning = this.container.querySelector<HTMLElement>('#primary-residence-warning');
    const primaryResidence = this.container.querySelector<HTMLInputElement>('input[name="primaryResidence"]');
    const isPrimary = primaryResidence?.checked ?? false;

    if (!warning) return;
    warning.style.display = isPrimary && this.hasOtherPrimaryResidence() ? 'block' : 'none';
  }

  private hasOtherPrimaryResidence(): boolean {
    const placements = this.store?.state?.placements || [];
    const currentId = this.currentPlacementId;
    return placements.some(p => p.type === 'real_estate' && (p as RealEstateModule).primaryResidence === true && p.id !== currentId);
  }

  protected override isPlacementValid(): boolean {
    const currentValue = this.container.querySelector<HTMLInputElement>('input[name="currentValue"]');
    const acquisitionDate = this.container.querySelector<HTMLInputElement>('input[name="acquisitionDate"]');
    const acquisitionPrice = this.container.querySelector<HTMLInputElement>('input[name="acquisitionPrice"]');
    const currentValueValid = currentValue ? currentValue.checkValidity() : true;
    const dateValid = acquisitionDate ? acquisitionDate.checkValidity() : true;
    const priceValid = acquisitionPrice ? acquisitionPrice.checkValidity() : true;
    return currentValueValid && dateValid && priceValid;
  }

  protected override collectData(): Record<string, unknown> {
    const primaryResidence = this.container.querySelector<HTMLInputElement>('input[name="primaryResidence"]')?.checked ?? false;
    const acquisitionPrice = primaryResidence ? 0 : (Number(this.container.querySelector<HTMLInputElement>('input[name="acquisitionPrice"]')?.value) || 0);
    const acquisitionDate = primaryResidence ? '' : (this.container.querySelector<HTMLInputElement>('input[name="acquisitionDate"]')?.value || '');

    return {
      primaryResidence,
      currentValue: Number(this.container.querySelector<HTMLInputElement>('input[name="currentValue"]')?.value) || 0,
      acquisitionDate,
      acquisitionPrice,
      freeAcquisition: primaryResidence ? false : (this.container.querySelector<HTMLInputElement>('input[name="freeAcquisition"]')?.checked ?? false),
      acquisitionFees: primaryResidence ? 0 : (Number(this.container.querySelector<HTMLInputElement>('input[name="acquisitionFees"]')?.value) || 0),
      works: primaryResidence ? 0 : (Number(this.container.querySelector<HTMLInputElement>('input[name="works"]')?.value) || 0)
    };
  }
}
