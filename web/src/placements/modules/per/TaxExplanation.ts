import {
  getLatentGainsHelpPopover,
  getPfuHelpPopover,
  formatPercentage,
  formatCurrency,
  getWarning,
  getTaxSection,
  HelpPopover
} from '../../kit/v1/index.js';
import type { FiscalProfile } from '../../kit/v1/index.js';
import type { PerModule, PerCompartmentKey, CompartmentValues } from './module.js';

const HISTORICAL_RATE_HELP = 'La règle dite du « taux historique » s\'applique à la fraction de plus-value générée avant le 1er janvier 2018, et pour la plus-value produite dans les 5 ans suivant un versement effectué entre 2013 et 2017.';

const COMPARTMENT_LABELS: Record<PerCompartmentKey, string> = {
  deducted: 'Versements volontaires déduits',
  non_deducted: 'Versements volontaires non déduits',
  employee_savings: 'Épargne salariale'
};

export function getPerTaxExplanation(placement: PerModule, fiscalProfile: FiscalProfile | undefined): string {
  const socialRate = formatPercentage(placement.getSocialChargesRate());
  const compartments = placement.getComputedCompartments();
  const pfuPopover = getPfuHelpPopover(fiscalProfile, 'PFU', true);

  // --- Social charges section ---
  const socialChargesNote = placement.knowsNetValue
    ? '<p>Dans le cas de votre PER, les prélèvements sociaux ont été calculés à partir de la valeur nette avant impôts que vous avez indiquée.</p>'
    : '';

  const approximationWarning = placement.knowsNetValue
    ? ''
    : getWarning("<p>Dans le cas de ce placement, le montant des prélèvements sociaux est estimé sur la base du taux courant et peut être supérieur au montant réel.</p>");

  const socialChargesContent = `
    <p>Les ${getLatentGainsHelpPopover('plus-values')} sont soumises aux prélèvements sociaux.</p>
    <p>Ces prélèvements suivent, dans certains cas, la règle du « taux historique » ${HelpPopover.getHtml({ content: HISTORICAL_RATE_HELP, label: '?', icon: true })} : la plus-value est taxée selon les taux qui étaient en vigueur au moment où elle a été générée, plutôt qu'au taux actuel.</p>
    <p>En dehors de ces cas, le taux courant s'applique (${socialRate}).</p>
    ${socialChargesNote}
    ${approximationWarning}`;

  // --- Income tax section ---
  const compartmentRows = (Object.keys(COMPARTMENT_LABELS) as PerCompartmentKey[]).map(key => {
    const c: CompartmentValues = compartments[key];
    return renderCompartmentRow(key, c, pfuPopover);
  }).join('\n');

  const compartmentDetails = renderCompartmentDetails(compartments, pfuPopover);

  const incomeTaxContent = `
    <p>Le PER comporte plusieurs compartiments, chacun avec ses propres règles d'imposition :</p>
    <table style="width: 100%; border-collapse: collapse; margin-top: 0.5rem;">
      <thead>
        <tr>
          <th style="text-align: left; padding: 0.25rem;">Compartiment</th>
          <th style="text-align: left; padding: 0.25rem;">Capital</th>
          <th style="text-align: left; padding: 0.25rem;">Plus-values</th>
        </tr>
      </thead>
      <tbody>
        ${compartmentRows}
      </tbody>
    </table>
    <h3 style="margin-top: 1rem;">Détail par compartiment</h3>
    ${compartmentDetails}`;

  return `
<div class="tax-explanation">
  <h2>Plan d'Épargne Retraite (PER / PERECO)</h2>
  ${getTaxSection('Prélèvements sociaux', socialChargesContent)}
  ${getTaxSection('Imposition à l\'impôt sur le revenu', incomeTaxContent)}
</div>`;
}

function renderCompartmentRow(key: PerCompartmentKey, _c: CompartmentValues, pfuPopover: string): string {
  const label = COMPARTMENT_LABELS[key];
  let capitalText: string;
  let gainText: string;

  switch (key) {
    case 'deducted':
      capitalText = 'Imposé au barème';
      gainText = `${pfuPopover} (ou barème sur option)`;
      break;
    case 'non_deducted':
      capitalText = 'Exonéré (déjà fiscalisé à l\'entrée)';
      gainText = `${pfuPopover} (ou barème sur option)`;
      break;
    case 'employee_savings':
      capitalText = 'Exonéré';
      gainText = 'Exonérées';
      break;
  }

  return `
    <tr>
      <td style="padding: 0.25rem;">${label}</td>
      <td style="padding: 0.25rem;">${capitalText}</td>
      <td style="padding: 0.25rem;">${gainText}</td>
    </tr>`;
}

function renderCompartmentDetails(
  compartments: Record<PerCompartmentKey, CompartmentValues>,
  pfuPopover: string
): string {
  // Count compartments with missing gain and non-zero contributions:
  // when only one such compartment exists, the allocated gain is exact
  // (it is simply the residual), not an estimation.
  const missingGainCount = (Object.keys(COMPARTMENT_LABELS) as PerCompartmentKey[])
    .filter(key => !compartments[key].gainEntered && compartments[key].contributions > 0)
    .length;

  const sections = (Object.keys(COMPARTMENT_LABELS) as PerCompartmentKey[])
    .filter(key => compartments[key].contributions > 0)
    .map(key => {
      const c = compartments[key];
      const label = COMPARTMENT_LABELS[key];
      let gainSource: string;
      if (c.gainEntered) {
        gainSource = '(plus-value renseignée)';
      } else if (missingGainCount > 1) {
        gainSource = '(plus-value estimée par répartition proportionnelle)';
      } else {
        gainSource = '';
      }

      let capitalTax: string;
      let gainTax: string;
      switch (key) {
        case 'deducted':
          capitalTax = 'Le capital versé est intégré au revenu imposable et taxé au barème progressif de l\'impôt sur le revenu.';
          gainTax = `Les plus-values sont soumises à l'impôt sur le revenu au ${pfuPopover}.`;
          break;
        case 'non_deducted':
          capitalTax = 'Le capital versé a déjà été fiscalisé à l\'entrée (non déduit du revenu imposable). Il est donc exonéré d\'impôt sur le revenu à la sortie.';
          gainTax = `Les plus-values sont soumises à l'impôt sur le revenu au ${pfuPopover}.`;
          break;
        case 'employee_savings':
          capitalTax = 'Le capital issu de l\'épargne salariale (intéressement, participation, abondement, CET) est exonéré d\'impôt sur le revenu à la sortie.';
          gainTax = 'Les plus-values sont exonérées d\'impôt sur le revenu.';
          break;
      }

      return `
        <h4>${label}</h4>
        <p><b>Versements :</b> ${formatCurrency(c.contributions)}</p>
        <p><b>Plus-value :</b> ${formatCurrency(c.gain)}${gainSource ? ` <em>${gainSource}</em>` : ''}</p>
        <p>${capitalTax}</p>
        <p>${gainTax}</p>`;
    }).join('\n');

  return sections || '<p>Aucun versement n\'a été saisi dans les compartiments éligibles.</p>';
}
