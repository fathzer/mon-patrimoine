import { getTaxDisclaimer, getLatentGainsHelpPopover, getPfuHelpPopover, formatPercentage, getWarning } from '../../kit/v1/index.js';
import type { FiscalProfile } from '../../kit/v1/index.js';
import type { PeaModule } from './module.js';

export function getPeaTaxExplanation(placement: PeaModule, fiscalProfile: FiscalProfile | undefined): string {
  const years = placement.getHoldingYears(new Date());
  const exemptFromIncomeTax = placement.isExemptFromIncomeTax(new Date());
  const socialRate = formatPercentage(placement.getSocialChargesRate());
  const isPeaPme = placement.peaType === 'pea_pme';
  const planName = isPeaPme ? 'PEA-PME' : 'PEA';
  const planFullName = isPeaPme
    ? 'Plan d\'Épargne en Actions PME (PEA-PME)'
    : 'Plan d\'Épargne en Actions (PEA)';
  const pre2018Warning = placement.isPre2018()
    ? getWarning("<p>Le calcul exact des prélèvements sociaux sur les gains réalisés avant le 01/01/2018 fait l'objet de règles nécessitant l'historique des valorisations annuelles. Dans le cas de ce plan, on considère que tous les gains sont réalisés après 2018. Il est donc possible que les prélèvements soient moins élevés que ceux indiqués.</p>")
    : '';

  let incomeTaxSection: string;
  if (exemptFromIncomeTax) {
    incomeTaxSection = `Ce ${planName} est ouvert depuis ${years} an${years > 1 ? 's' : ''}. Les gains sont exonérés d'impôt sur le revenu.`;
  } else {
    const taxDisclaimer = fiscalProfile?.usePfu ? '' : getTaxDisclaimer();
    incomeTaxSection = `
      <p>Ce ${planName} est ouvert depuis ${years} an${years > 1 ? 's' : ''}. L'impôt sur le revenu est dû sur les gains.</p>
      ${taxDisclaimer}
    `;
  }

  return `
<div class="tax-explanation">
  <h2>${planFullName}</h2>

  <h3>Prélèvements sociaux</h3>
  <p>Le ${getLatentGainsHelpPopover()} est soumis aux prélèvements sociaux au taux de ${socialRate}.</p>
  ${pre2018Warning}

  <h3>Imposition à l'impôt sur le revenu</h3>
  <p>L'imposition d'un ${planName} dépend de l'ancienneté du contrat :</p>
  <ul>
    <li><b>Avant 5 ans</b> : les gains sont soumis à l'impôt sur le revenu au ${getPfuHelpPopover(fiscalProfile)}.</li>
    <li><b>Après 5 ans</b> : les gains sont exonérés d'impôt sur le revenu.</li>
  </ul>
  ${incomeTaxSection}
  </div>`;
}
