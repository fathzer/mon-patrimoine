import { getPfuExplanation, getTaxDisclaimer, getWarning, formatPercentage, formatCurrency } from './commonTaxExplanations.js';

export class StockGrantTaxExplanation {
  static get(placement, fiscalProfile) {
    const totalValue = placement?.getLatentGain?.() ?? 0;
    const acquisitionGain = placement?.getAcquisitionGain?.() ?? 0;
    const capitalGain = placement?.getCapitalGain?.() ?? 0;
    const socialCharges = placement?.getSocialCharges?.() ?? 0;
    const socialRate = placement?.getSocialChargesRate?.() ?? 0;

    return `
<div class="tax-explanation">
  <h3>Actions gratuites</h3>
  <p>La valeur totale actuelle du portefeuille est de ${formatCurrency(totalValue)}.</p>
  <p>Le gain est scindé en deux parties :</p>
  <ul>
    <li><b>Gain d'acquisition</b> : valeur des actions au moment de l'attribution, retenue pour l'imposition, soit ${formatCurrency(acquisitionGain)} ;</li>
    <li><b>Plus-value de cession</b> : différence entre le cours actuel et la valeur d'acquisition retenue, soit ${formatCurrency(capitalGain)}.</li>
  </ul>
  <p>La valeur d'acquisition retenue est plafonnée au cours actuel : si une action attribuée à 100 € vaut aujourd'hui 50 €, la valeur d'acquisition utilisée est 50 € et la plus-value est nulle.</p>
  <p>Les prélèvements sociaux sont appliqués sur la valeur totale actuelle au taux de ${formatPercentage(socialRate)}, soit ${formatCurrency(socialCharges)}.</p>
  ${getPfuExplanation({ fiscalProfile })}

  ${fiscalProfile?.usePfu ? '' : getTaxDisclaimer()}
  ${getWarning('<p>Ce calcul est simplifié. Il ne modélise pas les taux variables de prélèvements sociaux selon la période d\'attribution, le seuil de 300 000 € ni les options d\'abattement pour durée de détention.</p>')}
</div>
`;
  }
}
