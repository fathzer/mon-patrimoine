import { formatPercentage } from './commonTaxExplanations.js';

export function getRealEstateTaxExplanation(placement) {
  if (placement?.primaryResidence) {
    return `
<div class="tax-explanation">
  <h2>Immobilier</h2>
  <p>La résidence principale est exonérée de prélèvements sociaux et d'impôt sur le revenu lors de la vente.</p>
</div>
`;
  }

  const years = placement.getHoldingYears(new Date());
  const socialRate = formatPercentage(placement.getSocialChargesRate());
  const socialChargesReduction = formatPercentage(placement.getReductionRate(years));
  const incomeTaxReduction = formatPercentage(placement.getIncomeTaxReduction(years));
  const irRate = formatPercentage(placement.getIncomeTaxRate());
  const irReductionRate = formatPercentage(placement.getIncomeTaxReductionRate());
  const year6To21Rate = formatPercentage(placement.getYear6To21ReductionRate());
  const year22Rate = formatPercentage(placement.getYear22ReductionRate());
  const year23To30Rate = formatPercentage(placement.getYear23To30ReductionRate());

  return `
<div class="tax-explanation">
  <h2>Immobilier</h2>
  <p>La base de taxation est la différence entre la valeur actuelle du bien et son prix d'acquisition.</p>
  <p>Cette base est réduite par les abattements pour durée de détention.</p>

  <h3>Prélèvements sociaux</h3>
  <p>Les prélèvements sociaux sont dus au taux de ${socialRate}.</p>
  <p>L'abattement pour durée de détention réduit la base taxable de :</p>
  <ul>
    <li>${year6To21Rate} par an de la 6<sup>ème</sup> à la 21<sup>ème</sup> année</li>
    <li>${year22Rate} la 22<sup>ème</sup> année</li>
    <li>${year23To30Rate} par an de la 23<sup>ème</sup> à la 30<sup>ème</sup> année</li>
  </ul>

  <h3>Impôt sur le revenu</h3>
  <p>L'impôt sur le revenu est calculé au taux forfaitaire de ${irRate} sur la plus-value, après abattement de la base taxable de ${irReductionRate} par année de détention au-delà de 5 ans.</p>

  <h3>Dans le cas de ce bien :</h3>
  <p>Ce bien est détenu depuis ${years} an${years > 1 ? 's' : ''}. Les abattements s'élèvent à ${socialChargesReduction} pour les prélèvements sociaux et à ${incomeTaxReduction} pour l'impôt sur le revenu.</p>
</div>
`;
}
