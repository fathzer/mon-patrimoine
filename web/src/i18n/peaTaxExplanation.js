import { getTaxDisclaimer, getLatentGainsHelpPopover, getPfuHelpPopover } from './commonTaxExplanations.js';

export function getPeaTaxExplanation(placement, fiscalProfile) {
  const years = placement.getHoldingYears(new Date());
  const exemptFromIncomeTax = placement.isExemptFromIncomeTax(new Date());
  const socialRate = (placement.getSocialChargesRate() * 100).toFixed(2);

  let incomeTaxSection;
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
  <p>Le ${getLatentGainsHelpPopover()} est soumis aux prélèvements sociaux au taux de ${socialRate}%.</p>

  <h3>Imposition à l'impôt sur le revenu</h3>
  <p>L'imposition d'un PEA dépend de l'ancienneté du contrat :</p>
  <ul>
    <li><b>Avant 5 ans</b> : les gains sont soumis à l'impôt sur le revenu au ${getPfuHelpPopover(fiscalProfile)}.</li>
    <li><b>Après 5 ans</b> : les gains sont exonérés d'impôt sur le revenu.</li>
  </ul>
  ${incomeTaxSection}
  </div>`;
}
