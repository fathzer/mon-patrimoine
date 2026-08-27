import { BasePlacementEditor, I18n, ToggleSwitch, HelpPopover } from '../../kit/v1/index.js';
import type { BasePlacement } from '../../kit/v1/index.js';
import type { PeeModule } from './module.js';

const labels = {
  totalDeposits: 'Total des versements (€)',
  netValue: 'Valeur nette de prélèvements sociaux (€)',
  knowsNetValue: 'Je connais la valeur nette',
  knowsNetValueHelp: 'Le calcul exact des prélèvements sociaux nécessite de connaître, pour certains versements, leur valorisation exacte à chaque changement de taux de prélèvements et l\'historique des arbitrages effectués. Si l\'établissement fournit la valeur nette de votre PEE, choisissez cette option, sinon, un calcul approché, toujours supérieur ou égal au montant réel, sera effectué sur la base du taux actuellement en vigueur.'
};

export class PeeEditor extends BasePlacementEditor {
  protected override renderAfterInstitution(placement: BasePlacement | null): string {
    const p = placement as PeeModule | null;
    const knowsNetValue = p?.knowsNetValue === true;
    const depositsDisplay = knowsNetValue ? 'none' : 'block';
    const netValueDisplay = knowsNetValue ? 'block' : 'none';

    return `
      <div class="form-group">
        <label>${I18n.t('form.currentValue')}</label>
        <input type="number" step="0.01" name="currentValue" class="form-control" value="${p?.currentValue || 0}" required />
      </div>
      <div class="form-group">
        <div style="display: flex; align-items: center; gap: var(--space-sm);">
          ${ToggleSwitch.create({
            name: 'knowsNetValue',
            label: labels.knowsNetValue,
            checked: knowsNetValue
          })}
          ${HelpPopover.getHtml({ content: labels.knowsNetValueHelp, label: '?', icon: true })}
        </div>
      </div>
      <div class="form-group" id="total-deposits-group" style="display: ${depositsDisplay};">
        <label>${labels.totalDeposits}</label>
        <input type="number" step="0.01" name="totalDeposits" class="form-control" value="${p?.totalDeposits || 0}" />
      </div>
      <div class="form-group" id="net-value-group" style="display: ${netValueDisplay};">
        <label>${labels.netValue}</label>
        <input type="number" step="0.01" name="netValue" class="form-control" value="${p?.netValue || 0}" />
      </div>
    `;
  }

  protected override bindPlacementEvents(): void {
    this.onKnowsNetValueChange();

    const knowsNetValueCheckbox = this.container.querySelector<HTMLInputElement>('input[name="knowsNetValue"]');
    knowsNetValueCheckbox?.addEventListener('change', () => {
      this.onKnowsNetValueChange();
      this.notifyValidityChange();
    });

    (['currentValue', 'totalDeposits', 'netValue'] as const).forEach(name => {
      const input = this.container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      input?.addEventListener('input', () => this.notifyValidityChange());
    });
  }

  private onKnowsNetValueChange(): void {
    const checkbox = this.container.querySelector<HTMLInputElement>('input[name="knowsNetValue"]');
    const knowsNetValue = checkbox?.checked ?? false;

    const depositsGroup = this.container.querySelector<HTMLElement>('#total-deposits-group');
    const netValueGroup = this.container.querySelector<HTMLElement>('#net-value-group');

    if (depositsGroup) depositsGroup.style.display = knowsNetValue ? 'none' : 'block';
    if (netValueGroup) netValueGroup.style.display = knowsNetValue ? 'block' : 'none';
  }

  protected override isPlacementValid(): boolean {
    const currentValue = this.container.querySelector<HTMLInputElement>('input[name="currentValue"]');
    return currentValue ? currentValue.checkValidity() : true;
  }

  protected override collectData(): Record<string, unknown> {
    const knowsNetValue = this.container.querySelector<HTMLInputElement>('input[name="knowsNetValue"]')?.checked ?? false;
    return {
      currentValue: Number(this.container.querySelector<HTMLInputElement>('input[name="currentValue"]')?.value) || 0,
      totalDeposits: knowsNetValue ? 0 : (Number(this.container.querySelector<HTMLInputElement>('input[name="totalDeposits"]')?.value) || 0),
      netValue: knowsNetValue ? (Number(this.container.querySelector<HTMLInputElement>('input[name="netValue"]')?.value) || 0) : 0,
      knowsNetValue
    };
  }
}
