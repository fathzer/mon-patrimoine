import { BasePlacementEditor } from '../../ui/editors/BasePlacementEditor.js';
import { I18n } from '../../core/I18n.js';
import { getLifeInsuranceTaxExplanation } from './TaxExplanation.js';
import type { BasePlacement } from '../../modules/BasePlacement.js';
import type { LifeInsuranceModule } from './module.js';
import type { FiscalProfile } from '../../fiscality/TaxCalculator.js';

const REFORM_DATE = '2017-09-27';

export class LifeInsuranceEditor extends BasePlacementEditor {
  override _renderAfterInstitution(placement: BasePlacement | null): string {
    const p = placement as LifeInsuranceModule | null;
    const openingDate = p?.openingDate || new Date().toISOString().split('T')[0];
    const showPre2017 = this._isPre2017(openingDate);

    return `
      <div class="form-group">
        <label>${I18n.t('form.openingDate')}</label>
        <input type="date" name="openingDate" class="form-control" value="${openingDate}" required />
      </div>
      <div class="form-group">
        <label>${I18n.t('form.totalPremiums')}</label>
        <input type="number" step="0.01" name="totalPremiums" class="form-control" value="${p?.totalPremiums || 0}" required />
      </div>
      <div class="form-group" id="pre-2017-group" style="display: ${showPre2017 ? 'block' : 'none'};">
        <label>${I18n.t('form.pre2017Premiums')}</label>
        <input type="number" step="0.01" name="pre2017Premiums" class="form-control" value="${p?.pre2017Premiums || 0}" />
      </div>
      <div class="form-group">
        <label>${I18n.t('form.currentValue')}</label>
        <input type="number" step="0.01" name="currentValue" class="form-control" value="${p?.currentValue || 0}" required />
      </div>
      <div class="form-group">
        <label>${I18n.t('form.euroFundsValue')}</label>
        <input type="number" step="0.01" name="euroFundsValue" class="form-control" value="${p?.euroFundsValue || 0}" required />
      </div>
      <div class="form-group" style="font-size: 0.8rem; color: var(--danger);">
        ${I18n.t('form.lifeInsuranceWarning')}
      </div>
    `;
  }

  _isPre2017(dateString: string): boolean {
    return !!dateString && dateString < REFORM_DATE;
  }

  override _bindEvents(): void {
    super._bindEvents();
    const openingDate = this.container.querySelector<HTMLInputElement>('input[name="openingDate"]');
    openingDate?.addEventListener('input', () => this._onOpeningDateChange());
    (['openingDate', 'totalPremiums', 'pre2017Premiums', 'currentValue', 'euroFundsValue'] as const).forEach(name => {
      const input = this.container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      input?.addEventListener('input', () => this._notifyValidityChange());
    });
  }

  _onOpeningDateChange(): void {
    const openingDate = this.container.querySelector<HTMLInputElement>('input[name="openingDate"]')?.value || '';
    const group = this.container.querySelector<HTMLElement>('#pre-2017-group');
    const input = this.container.querySelector<HTMLInputElement>('input[name="pre2017Premiums"]');
    if (group && input) {
      const show = this._isPre2017(openingDate);
      group.style.display = show ? 'block' : 'none';
      if (!show) {
        input.value = '0';
      }
    }
    this._notifyValidityChange();
  }

  override isValid(): boolean {
    if (!super.isValid()) return false;
    const required = (['openingDate', 'totalPremiums', 'currentValue', 'euroFundsValue'] as const);
    return required.every(name => {
      const input = this.container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      return input ? input.checkValidity() : true;
    });
  }

  override getData(): Record<string, unknown> {
    const openingDate = this.container.querySelector<HTMLInputElement>('input[name="openingDate"]')?.value || '';
    const isPre2017 = this._isPre2017(openingDate);
    return {
      ...super.getData(),
      openingDate,
      totalPremiums: Number(this.container.querySelector<HTMLInputElement>('input[name="totalPremiums"]')?.value) || 0,
      pre2017Premiums: isPre2017 ? (Number(this.container.querySelector<HTMLInputElement>('input[name="pre2017Premiums"]')?.value) || 0) : 0,
      currentValue: Number(this.container.querySelector<HTMLInputElement>('input[name="currentValue"]')?.value) || 0,
      euroFundsValue: Number(this.container.querySelector<HTMLInputElement>('input[name="euroFundsValue"]')?.value) || 0
    };
  }

  override buildTaxExplanation(placement: BasePlacement, fiscalProfile: FiscalProfile): string {
    return getLifeInsuranceTaxExplanation(placement as LifeInsuranceModule, fiscalProfile);
  }
}
