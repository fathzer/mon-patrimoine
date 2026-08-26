import { BasePlacementEditor, I18n } from '../../kit/v1/index.js';
import type { BasePlacement } from '../../kit/v1/index.js';
import type { LifeInsuranceModule } from './module.js';

const labels = {
  totalPremiums: 'Total des primes versées (€)',
  pre2017Premiums: 'Primes versées avant le 27/09/2017 (€)',
  euroFundsValue: 'Valeur actuelle des fonds en euros (€)',
  lifeInsuranceWarning: 'Attention, le calcul des prélèvements sociaux et impôts est approximatif. Celui-ci dépend de l\'historique des versements et arbitrages survenus au cours de la vie de votre assurance-vie'
};

const REFORM_DATE = '2017-09-27';

export class LifeInsuranceEditor extends BasePlacementEditor {
  protected override renderAfterInstitution(placement: BasePlacement | null): string {
    const p = placement as LifeInsuranceModule | null;
    const openingDate = p?.openingDate || new Date().toISOString().split('T')[0];
    const showPre2017 = this.isPre2017(openingDate);

    return `
      <div class="form-group">
        <label>${I18n.t('form.openingDate')}</label>
        <input type="date" name="openingDate" class="form-control" value="${openingDate}" required />
      </div>
      <div class="form-group">
        <label>${labels.totalPremiums}</label>
        <input type="number" step="0.01" name="totalPremiums" class="form-control" value="${p?.totalPremiums || 0}" required />
      </div>
      <div class="form-group" id="pre-2017-group" style="display: ${showPre2017 ? 'block' : 'none'};">
        <label>${labels.pre2017Premiums}</label>
        <input type="number" step="0.01" name="pre2017Premiums" class="form-control" value="${p?.pre2017Premiums || 0}" />
      </div>
      <div class="form-group">
        <label>${I18n.t('form.currentValue')}</label>
        <input type="number" step="0.01" name="currentValue" class="form-control" value="${p?.currentValue || 0}" required />
      </div>
      <div class="form-group">
        <label>${labels.euroFundsValue}</label>
        <input type="number" step="0.01" name="euroFundsValue" class="form-control" value="${p?.euroFundsValue || 0}" required />
      </div>
      <div class="form-group" style="font-size: 0.8rem; color: var(--danger);">
        ${labels.lifeInsuranceWarning}
      </div>
    `;
  }

  private isPre2017(dateString: string): boolean {
    return !!dateString && dateString < REFORM_DATE;
  }

  protected override bindPlacementEvents(): void {
    const openingDate = this.container.querySelector<HTMLInputElement>('input[name="openingDate"]');
    openingDate?.addEventListener('input', () => this.onOpeningDateChange());
    (['openingDate', 'totalPremiums', 'pre2017Premiums', 'currentValue', 'euroFundsValue'] as const).forEach(name => {
      const input = this.container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      input?.addEventListener('input', () => this.notifyValidityChange());
    });
  }

  private onOpeningDateChange(): void {
    const openingDate = this.container.querySelector<HTMLInputElement>('input[name="openingDate"]')?.value || '';
    const group = this.container.querySelector<HTMLElement>('#pre-2017-group');
    const input = this.container.querySelector<HTMLInputElement>('input[name="pre2017Premiums"]');
    if (group && input) {
      const show = this.isPre2017(openingDate);
      group.style.display = show ? 'block' : 'none';
      if (!show) {
        input.value = '0';
      }
    }
    this.notifyValidityChange();
  }

  protected override isPlacementValid(): boolean {
    const required = (['openingDate', 'totalPremiums', 'currentValue', 'euroFundsValue'] as const);
    return required.every(name => {
      const input = this.container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      return input ? input.checkValidity() : true;
    });
  }

  protected override collectData(): Record<string, unknown> {
    const openingDate = this.container.querySelector<HTMLInputElement>('input[name="openingDate"]')?.value || '';
    const isPre2017 = this.isPre2017(openingDate);
    return {
      openingDate,
      totalPremiums: Number(this.container.querySelector<HTMLInputElement>('input[name="totalPremiums"]')?.value) || 0,
      pre2017Premiums: isPre2017 ? (Number(this.container.querySelector<HTMLInputElement>('input[name="pre2017Premiums"]')?.value) || 0) : 0,
      currentValue: Number(this.container.querySelector<HTMLInputElement>('input[name="currentValue"]')?.value) || 0,
      euroFundsValue: Number(this.container.querySelector<HTMLInputElement>('input[name="euroFundsValue"]')?.value) || 0
    };
  }
}
