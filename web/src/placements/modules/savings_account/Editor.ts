import { SavingsAccountBaseEditor } from './SavingsAccountBaseEditor.js';
import { ToggleSwitch } from '../../kit/v1/index.js';
import type { BasePlacement } from '../../kit/v1/index.js';
import type { SavingsAccountModule } from './module.js';

const labels = {
  taxExempt: 'Exonéré de prélèvement',
  taxExemptTooltip: 'Sont exonérés de prélèvements : Livret A, LDDS, Livret Jeune, Livret d\'Épargne Populaire, Livret Bleu. Attention, les PEL et CEL ne sont pas gérés ici, mais dans la rubrique \'Épargne Logement\'.',
  promotionalInterest: 'Intérêts promotionnels (€)'
};

export class SavingsAccountEditor extends SavingsAccountBaseEditor {
  protected override renderTaxExempt(placement: BasePlacement | null): string {
    const taxExempt = (placement as SavingsAccountModule)?.taxExempt !== false;
    return `
      <div class="form-group">
        ${ToggleSwitch.create({
          name: 'taxExempt',
          id: 'tax-exempt',
          label: labels.taxExempt,
          checked: taxExempt
        })}
        <p class="text-muted" style="font-size: 0.8rem; margin: 0.5rem 0 0 0;">${labels.taxExemptTooltip}</p>
      </div>
    `;
  }

  protected override renderPromotionalInterest(placement: BasePlacement | null): string {
    const taxExempt = (placement as SavingsAccountModule)?.taxExempt !== false;
    const value = taxExempt ? 0 : ((placement as SavingsAccountModule)?.promotionalInterest || 0);
    return `
      <div class="form-group" id="promotional-interest-group" style="display: ${taxExempt ? 'none' : 'block'};">
        <label>${labels.promotionalInterest}</label>
        <input type="number" step="0.01" name="promotionalInterest" class="form-control" value="${value}" />
      </div>
    `;
  }

  protected override onTaxExemptChange(): void {
    const taxExempt = this.container.querySelector<HTMLInputElement>('input[name="taxExempt"]');
    const promotionalGroup = this.container.querySelector<HTMLElement>('#promotional-interest-group');
    const promotionalInput = this.container.querySelector<HTMLInputElement>('input[name="promotionalInterest"]');

    if (taxExempt && promotionalGroup && promotionalInput) {
      const isExempt = taxExempt.checked;
      promotionalGroup.style.display = isExempt ? 'none' : 'block';
      promotionalInput.value = isExempt ? '0' : (promotionalInput.value || '0');
    }
    this.notifyValidityChange();
  }

  protected override collectData(): Record<string, unknown> {
    const taxExempt = this.container.querySelector<HTMLInputElement>('input[name="taxExempt"]')?.checked ?? true;
    return {
      ...super.collectData(),
      interestAmount: Number(this.container.querySelector<HTMLInputElement>('input[name="interestAmount"]')?.value) || 0,
      taxExempt,
      promotionalInterest: taxExempt ? 0 : (Number(this.container.querySelector<HTMLInputElement>('input[name="promotionalInterest"]')?.value) || 0)
    };
  }
}
