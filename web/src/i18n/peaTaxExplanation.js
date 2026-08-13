import { FISCAL_RATES } from '../fiscality/rates.js';
import { getPfuExplanation, getTaxDisclaimer, getLatentGainsHelpPopover } from './commonTaxExplanations.js';

function getContractYears(placement) {
  if (!placement?.openingDate) return 0;
  const now = new Date();
  const opening = new Date(placement.openingDate);
  let years = now.getFullYear() - opening.getFullYear();
  const monthDiff = now.getMonth() - opening.getMonth();
  const dayDiff = now.getDate() - opening.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    years--;
  }
  return Math.max(0, years);
}

export function getPeaTaxExplanation(placement, fiscalProfile) {
  const years = getContractYears(placement);
  const socialRate = (FISCAL_RATES.CSG_CRDS * 100).toFixed(1);
  const exemptFromIncomeTax = years >= 5;

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
    <li><b>Avant 5 ans</b> : les gains sont soumis à l'impôt sur le revenu, selon le mode de taxation choisi (PFU ou barème progressif).</li>
    <li><b>Après 5 ans</b> : les gains sont exonérés d'impôt sur le revenu.</li>
  </ul>
  ${incomeTaxSection}
  </div>`;
}
