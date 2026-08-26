import { I18n } from '../../kit/v1/index.js';
import { SavingsAccountBaseEditor } from '../savings_account/SavingsAccountBaseEditor.js';
import { getHomeSavingsTaxExplanation } from './TaxExplanation.js';
import type { BasePlacement, FiscalProfile } from '../../kit/v1/index.js';
import type { HomeSavingsModule } from './module.js';

const labels = {
  homeSavingsType: 'Type d\'épargne logement',
  pel: 'PEL',
  cel: 'CEL'
};

export class HomeSavingsEditor extends SavingsAccountBaseEditor {
  protected override renderBeforeInstitution(placement: BasePlacement | null): string {
    const homeSavingsType = (placement as HomeSavingsModule)?.homeSavingsType || 'pel';
    return `
      <div class="form-group">
        <label>${labels.homeSavingsType}</label>
        <div style="display: flex; gap: 1rem;">
          <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer;">
            <input type="radio" name="homeSavingsType" value="pel" ${homeSavingsType === 'pel' ? 'checked' : ''} />
            ${labels.pel}
          </label>
          <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer;">
            <input type="radio" name="homeSavingsType" value="cel" ${homeSavingsType === 'cel' ? 'checked' : ''} />
            ${labels.cel}
          </label>
        </div>
      </div>
    `;
  }

  protected override renderOpeningDate(placement: BasePlacement | null): string {
    return `
      <div class="form-group">
        <label>${I18n.t('form.openingDate')}</label>
        <input type="date" name="openingDate" class="form-control" value="${(placement as HomeSavingsModule)?.openingDate || ''}" required />
      </div>
    `;
  }

  protected override renderTaxExempt(_placement: BasePlacement | null): string {
    return '';
  }

  protected override bindPlacementEvents(): void {
    super.bindPlacementEvents();
    const homeSavingsType = this.container.querySelectorAll<HTMLInputElement>('input[name="homeSavingsType"]');
    homeSavingsType.forEach(radio => {
      radio.addEventListener('change', () => this.notifyValidityChange());
    });
  }

  protected override isPlacementValid(): boolean {
    const currentValue = this.container.querySelector<HTMLInputElement>('input[name="currentValue"]');
    const openingDate = this.container.querySelector<HTMLInputElement>('input[name="openingDate"]');
    const currentValueValid = currentValue ? currentValue.checkValidity() : true;
    const openingDateValid = openingDate ? openingDate.checkValidity() : true;
    return currentValueValid && openingDateValid;
  }

  protected override collectData(): Record<string, unknown> {
    const homeSavingsTypeInput = this.container.querySelector<HTMLInputElement>('input[name="homeSavingsType"]:checked');
    return {
      ...super.collectData(),
      homeSavingsType: homeSavingsTypeInput ? homeSavingsTypeInput.value : 'pel',
      openingDate: this.container.querySelector<HTMLInputElement>('input[name="openingDate"]')?.value || '',
      interestAmount: Number(this.container.querySelector<HTMLInputElement>('input[name="interestAmount"]')?.value) || 0,
      taxExempt: false,
      promotionalInterest: 0
    };
  }

  override buildTaxExplanation(placement: BasePlacement, fiscalProfile: FiscalProfile): string {
    return getHomeSavingsTaxExplanation(placement as HomeSavingsModule, fiscalProfile);
  }
}
