import { getPfuExplanation, getTaxDisclaimer, getLatentGainsHelpPopover, getUnvotedScheduleWarning, formatPercentage } from '../../kit/v1/index.js';
import type { FiscalProfile } from '../../kit/v1/index.js';
import type { CtoModule } from './module.js';

export function getCtoTaxExplanation(placement: CtoModule, fiscalProfile: FiscalProfile | undefined, now: Date = new Date()): string {
  const socialRate = formatPercentage(placement.getSocialChargesRate(now));

  return `
<div class="tax-explanation">
  <h3>Compte-titres ordinaire (CTO)</h3>
  <p>La base taxable est le ${getLatentGainsHelpPopover()} du portefeuille, c'est-à-dire la différence entre la valeur actuelle du compte et la valeur d'acquisition des titres, déduction faite du solde en espèces.</p>
  <p>Les prélèvements sociaux (CSG/CRDS) sont appliqués sur ce gain au taux global de ${socialRate}.</p>
  ${getPfuExplanation({ fiscalProfile, year: now.getFullYear() })}
  ${getUnvotedScheduleWarning(now.getFullYear())}

  ${fiscalProfile?.usePfu ? '' : getTaxDisclaimer()}
</div>
`;
}
