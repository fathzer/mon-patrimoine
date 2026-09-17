import { getLatentGainsHelpPopover, formatPercentage, getWarning, HelpPopover, getTaxSection } from '../../kit/v1/index.js';
import type { FiscalProfile } from '../../kit/v1/index.js';
import type { PeeModule } from './module.js';

const HISTORICAL_RATE_HELP = 'La règle dite du « taux historique » s\'applique à la fraction de plus-value générée avant le 1er janvier 2018, et pour la plus-value produite dans les 5 ans suivant un versement effectué entre 2013 et 2017.';

export function getPeeTaxExplanation(placement: PeeModule, _fiscalProfile: FiscalProfile | undefined): string {
  const socialRate = formatPercentage(placement.getSocialChargesRate());

  const socialChargesSection = placement.knowsNetValue
    ? `<p>Dans le cas de votre PEE, les prélèvements sociaux ont été calculés à partir de la valeur nette que vous avez indiquée.</p>`
    : '';

  const approximationWarning = placement.knowsNetValue
    ? ''
    : getWarning("<p>Dans le cas de ce placement, le montant est estimé sur la base du taux courant et peut être supérieur au montant réel.</p>");

  return `
<div class="tax-explanation">
  <h2>Plan d'Épargne Entreprise (PEE)</h2>
  ${getTaxSection('Prélèvements sociaux', `
    <p>Le ${getLatentGainsHelpPopover()} est soumis aux prélèvements sociaux.
    <p>Ces prélèvements suivent, dans certains cas, la règle du « taux historique » ${HelpPopover.getHtml({ content: HISTORICAL_RATE_HELP, label: '?', icon: true })} : la plus-value est taxée selon les taux qui étaient en vigueur au moment où elle a été générée, plutôt qu'au taux actuel.</p>
    <p>En dehors de ces cas, le taux courant s'applique (${socialRate}).</p>
    ${socialChargesSection}
    ${approximationWarning}`)}
  ${getTaxSection('Imposition à l\'impôt sur le revenu', `<p>Le capital versé et la plus-value sont exonérés d'impôt sur le revenu.</p>`)}
</div>`;
}
