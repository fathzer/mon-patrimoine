import { getTaxDisclaimer, getPfuHelpPopover, formatPercentage } from '../../kit/v1/index.js';
import type { FiscalProfile } from '../../kit/v1/index.js';
import type { SavingsAccountModule } from './module.js';

export function getSavingsAccountTaxExplanation(placement: SavingsAccountModule, fiscalProfile: FiscalProfile | undefined): string {
  const socialRate = formatPercentage(placement.getSocialChargesRate());
  const taxExempt = placement.taxExempt !== false;
  const taxDisclaimer = fiscalProfile?.usePfu ? '' : getTaxDisclaimer();

  if (taxExempt) {
    return `
<div class="tax-explanation">
  <h2>Livret d'épargne</h2>
  <p>Ce placement est exonéré de prélèvements sociaux et d'impôt sur le revenu.</p>
</div>
`;
  }

  return `
<div class="tax-explanation">
  <h2>Livret d'épargne</h2>
  <p>Ce placement est soumis à l'impôt sur le revenu et aux prélèvements sociaux sur la base des intérêts bruts de l'année.</p>
  <h3>Prélèvements sociaux</h3>
  <p>Les intérêts sont soumis aux prélèvements sociaux au taux de ${socialRate}.</p>

  <h3>Imposition à l'impôt sur le revenu</h3>
  <p>Les intérêts sont soumis à l'impôt sur le revenu au ${getPfuHelpPopover()}.</p>
  ${taxDisclaimer}
</div>
`;
}
