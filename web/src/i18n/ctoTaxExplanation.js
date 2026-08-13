import { getPfuExplanation, getTaxDisclaimer, getLatentGainsHelpPopover, formatPercentage } from './commonTaxExplanations.js';

export function getCtoTaxExplanation(placement, fiscalProfile) {
  const socialRate = formatPercentage(placement.getSocialChargesRate());

  return `
<div class="tax-explanation">
  <h3>Compte-titres ordinaire (CTO)</h3>
  <p>La base taxable est le ${getLatentGainsHelpPopover()} du portefeuille, c'est-à-dire la différence entre la valeur actuelle du compte et la valeur d'acquisition des titres, déduction faite du solde en espèces.</p>
  <p>Les prélèvements sociaux (CSG/CRDS) sont appliqués sur ce gain au taux global de ${socialRate}.</p>
  ${getPfuExplanation(fiscalProfile)}

  ${fiscalProfile?.usePfu ? '' : getTaxDisclaimer()}
</div>
`;
}
