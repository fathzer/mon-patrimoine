import { getPfuExplanation, getTaxDisclaimer, getWarning, getLatentGainsHelpPopover, formatPercentage, formatCurrency } from './commonTaxExplanations.js';

export class StockGrantTaxExplanation {
  static get(placement, fiscalProfile) {
    const latentGain = placement?.getLatentGain?.() ?? 0;
    const socialRate = placement?.getSocialChargesRate?.() ?? 0;
    const socialCharges = placement?.getSocialCharges?.() ?? 0;

    return `
<div class="tax-explanation">
  <h3>Actions gratuites</h3>
  <p>Le ${getLatentGainsHelpPopover()} retenu correspond à la valorisation totale des actions au cours actuel, soit ${formatCurrency(latentGain)}.</p>
  <p>Les prélèvements sociaux sont appliqués sur ce montant au taux de ${formatPercentage(socialRate)}, soit ${formatCurrency(socialCharges)}.</p>
  ${getPfuExplanation({ fiscalProfile })}

  ${fiscalProfile?.usePfu ? '' : getTaxDisclaimer()}
  ${getWarning('<p>Les cours d\'acquisition et dates d\'attribution sont collectés mais ne sont pas encore pris en compte dans ce calcul simplifié et sous-estimé.</p>')}
</div>
`;
  }
}
