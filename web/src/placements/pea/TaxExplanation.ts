import { getTaxDisclaimer, getLatentGainsHelpPopover, getPfuHelpPopover, formatPercentage, getWarning } from '../../i18n/commonTaxExplanations.js';
import type { PeaModule } from './module.js';
import type { FiscalProfile } from '../../fiscality/TaxCalculator.js';

export function getPeaTaxExplanation(placement: PeaModule, fiscalProfile: FiscalProfile | undefined): string {
  const years = placement.getHoldingYears(new Date());
  const exemptFromIncomeTax = placement.isExemptFromIncomeTax(new Date());
  const socialRate = formatPercentage(placement.getSocialChargesRate());
  const pre2018Warning = placement.isPre2018()
    ? getWarning("<p>Pour les PEA ouverts avant 2018, comme celui-ci, les prélèvements sociaux peuvent dépendre de la date d'acquisition des gains et de taux historiques. Le montant calculé ici peut donc différer du montant réellement dû.</p>")
    : '';

  let incomeTaxSection: string;
  if (exemptFromIncomeTax) {
    incomeTaxSection = `Ce PEA est ouvert depuis ${years} an${years > 1 ? 's' : ''}. Les gains sont exonérés d'impôt sur le revenu.`;
  } else {
    const taxDisclaimer = fiscalProfile?.usePfu ? '' : getTaxDisclaimer();
    incomeTaxSection = `
      <p>Ce PEA est ouvert depuis ${years} an${years > 1 ? 's' : ''}. L'impôt sur le revenu est dû sur les gains.</p>
      ${taxDisclaimer}
    `;
  }

  return `
<div class="tax-explanation">
  <h2>Plan d'Épargne en Actions (PEA)</h2>

  <h3>Prélèvements sociaux</h3>
  <p>Le ${getLatentGainsHelpPopover()} est soumis aux prélèvements sociaux au taux de ${socialRate}.</p>
  ${pre2018Warning}

  <h3>Imposition à l'impôt sur le revenu</h3>
  <p>L'imposition d'un PEA dépend de l'ancienneté du contrat :</p>
  <ul>
    <li><b>Avant 5 ans</b> : les gains sont soumis à l'impôt sur le revenu au ${getPfuHelpPopover(fiscalProfile)}.</li>
    <li><b>Après 5 ans</b> : les gains sont exonérés d'impôt sur le revenu.</li>
  </ul>
  ${incomeTaxSection}
  </div>`;
}
