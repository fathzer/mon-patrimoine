import { BasePlacementEditor, ToggleSwitch, HelpPopover } from '../../kit/v1/index.js';
import type { BasePlacement } from '../../kit/v1/index.js';
import type { PerModule, PerCompartmentData } from './module.js';

const labels = {
  grossValue: 'Valeur brute actuelle (€)',
  knowsNetValue: 'Je connais la valeur nette avant impôts',
  netValue: 'Valeur nette avant impôts (€)',
  knowsNetValueHelp: 'Certains établissements fournissent la valeur nette de prélèvements sociaux (avant impôt sur le revenu). Si c\'est le cas, saisissez-la ici pour un calcul exact des prélèvements sociaux. Sinon, un calcul approché sera effectué sur la base du taux actuellement en vigueur.',
  mandatoryWarning: 'Les cotisations obligatoires (retraite) ne sont pas prises en charge par ce module : elles ne permettent aucune sortie en capital (rente uniquement).',
  compartment1Deducted: 'Compartiment 1 — Versements volontaires déduits',
  compartment1NonDeducted: 'Compartiment 1 — Versements volontaires non déduits',
  compartment2: 'Compartiment 2 — Épargne salariale',
  compartment3: 'Compartiment 3 — Cotisations obligatoires',
  compartment2Help: 'Intéressement, participation, abondement, CET (concerne PERECOL/PERCO).',
  contributions: 'Versements (€)',
  gain: 'Plus-value (€)',
  gainOptional: 'optionnelle',
  gainHelp: '<p>L\'imposition des plus-values dépend de l\'origine des versements.</p><p>Si vous êtes en possession du montant des plus-values en fonction de l\'origine des versements, entrez les valeurs ici. Cela permettra un calcul plus précis de l’imposition.</p><p>À défaut, les plus-values non renseignées seront estimées par répartition proportionnelle aux à leurs versements, de sorte que la somme des versements et des plus-values soit égale à la valeur brute.</p>'
};

export class PerEditor extends BasePlacementEditor {
  protected override renderAfterInstitution(placement: BasePlacement | null): string {
    const p = placement as PerModule | null;
    const knowsNetValue = p?.knowsNetValue === true;
    const netValueDisplay = knowsNetValue ? 'block' : 'none';

    return `
      <div class="form-group">
        <label>${labels.grossValue}</label>
        <input type="number" step="0.01" name="grossValue" class="form-control" value="${p?.grossValue || 0}" required />
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
      <div class="form-group" id="net-value-group" style="display: ${netValueDisplay};">
        <label>${labels.netValue}</label>
        <input type="number" step="0.01" name="netValue" class="form-control" value="${p?.netValue || 0}" />
      </div>
      ${this.renderCompartment('deducted', labels.compartment1Deducted, p?.deducted)}
      ${this.renderCompartment('non_deducted', labels.compartment1NonDeducted, p?.nonDeducted)}
      ${this.renderCompartment('employee_savings', labels.compartment2, p?.employeeSavings, labels.compartment2Help)}
      <fieldset class="form-section">
        <legend style="font-weight: 600; padding: 0 0.5rem;">${labels.compartment3}</legend>
        <div class="form-group text-muted" style="font-size: 0.8rem; color: var(--danger);">
          ${labels.mandatoryWarning}
        </div>
      </fieldset>
    `;
  }

  private renderCompartment(
    key: string,
    title: string,
    data: PerCompartmentData | undefined,
    helpContent: string | undefined = undefined
  ): string {
    const contributions = data?.contributions ?? 0;
    const gain = data?.gain;
    const gainValue = gain ?? '';
    const helpPopover = helpContent
      ? ` ${HelpPopover.getHtml({ content: helpContent, label: '?', icon: true })}`
      : '';

    return `
      <fieldset class="form-section">
        <legend style="font-weight: 600; padding: 0 0.5rem;">${title}${helpPopover}</legend>
        <div class="form-group">
          <label>${labels.contributions}</label>
          <input type="number" step="0.01" name="${key}_contributions" class="form-control" value="${contributions}" required />
        </div>
        <div class="form-group">
          <label>${labels.gain} <span style="font-weight: normal; font-size: 0.85rem; color: var(--text-muted, #666);">(${labels.gainOptional})</span> ${HelpPopover.getHtml({ content: labels.gainHelp, label: '?', icon: true })}</label>
          <input type="number" step="0.01" name="${key}_gain" class="form-control" value="${gainValue}" />
        </div>
      </fieldset>
    `;
  }

  protected override bindPlacementEvents(): void {
    this.onKnowsNetValueChange();

    const knowsNetValueCheckbox = this.container.querySelector<HTMLInputElement>('input[name="knowsNetValue"]');
    knowsNetValueCheckbox?.addEventListener('change', () => {
      this.onKnowsNetValueChange();
      this.notifyValidityChange();
    });

    (['grossValue', 'netValue'] as const).forEach(name => {
      const input = this.container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      input?.addEventListener('input', () => this.notifyValidityChange());
    });

    (['deducted', 'non_deducted', 'employee_savings'] as const).forEach(key => {
      const contributionsInput = this.container.querySelector<HTMLInputElement>(`input[name="${key}_contributions"]`);
      const gainInput = this.container.querySelector<HTMLInputElement>(`input[name="${key}_gain"]`);
      contributionsInput?.addEventListener('input', () => this.notifyValidityChange());
      gainInput?.addEventListener('input', () => this.notifyValidityChange());
    });
  }

  private onKnowsNetValueChange(): void {
    const checkbox = this.container.querySelector<HTMLInputElement>('input[name="knowsNetValue"]');
    const knowsNetValue = checkbox?.checked ?? false;
    const netValueGroup = this.container.querySelector<HTMLElement>('#net-value-group');
    if (netValueGroup) netValueGroup.style.display = knowsNetValue ? 'block' : 'none';
  }

  protected override isPlacementValid(): boolean {
    const grossValue = this.container.querySelector<HTMLInputElement>('input[name="grossValue"]');
    return grossValue ? grossValue.checkValidity() : true;
  }

  protected override collectData(): Record<string, unknown> {
    const knowsNetValue = this.container.querySelector<HTMLInputElement>('input[name="knowsNetValue"]')?.checked ?? false;

    return {
      grossValue: Number(this.container.querySelector<HTMLInputElement>('input[name="grossValue"]')?.value) || 0,
      netValue: knowsNetValue ? (Number(this.container.querySelector<HTMLInputElement>('input[name="netValue"]')?.value) || 0) : 0,
      knowsNetValue,
      deducted: this.collectCompartment('deducted'),
      nonDeducted: this.collectCompartment('non_deducted'),
      employeeSavings: this.collectCompartment('employee_savings')
    };
  }

  private collectCompartment(key: string): PerCompartmentData {
    const contributions = Number(this.container.querySelector<HTMLInputElement>(`input[name="${key}_contributions"]`)?.value) || 0;
    const gainRaw = this.container.querySelector<HTMLInputElement>(`input[name="${key}_gain"]`)?.value;
    const gain = gainRaw === '' || gainRaw == null ? undefined : Number(gainRaw) || 0;
    return { contributions, gain };
  }
}
