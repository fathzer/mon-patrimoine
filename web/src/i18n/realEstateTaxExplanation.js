import { FISCAL_RATES } from '../fiscality/rates.js';

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
  const socialRate = (FISCAL_RATES.CSG_CRDS * 100).toFixed(1);
  const socialChargesReduction = (placement.getReductionRate(years) * 100).toFixed(1);
  const incomeTaxReduction = (placement.getIncomeTaxReduction(years) * 100).toFixed(1);

  return `
<div class="tax-explanation">
  <h2>Immobilier</h2>
  <p>La base de taxation est la différence entre la valeur actuelle du bien et son prix d'acquisition.</p>
  <p>Cette base est réduite par les abattements pour durée de détention.</p>

  <h3>Prélèvements sociaux</h3>
  <p>Les prélèvements sociaux sont dus au taux de ${socialRate}%.</p>
  <p>L'abattement pour durée de détention réduit la base taxable de :</p>
  <ul>
    <li>1,65% par an de la 6<sup>ème</sup> à la 21<sup>ème</sup> année</li>
    <li>1,6% la 22<sup>ème</sup> année</li>
    <li>9% par an de la 23<sup>ème</sup> à la 30<sup>ème</sup> année</li>
  </ul>

  <h3>Impôt sur le revenu</h3>
  <p>L'impôt sur le revenu est calculé au taux forfaitaire de 19% sur la plus-value, après abattement de la base taxable de 6% par année de détention au-delà de 5 ans.</p>

  <h3>Dans le cas de ce bien :</h3>
  <p>Ce bien est détenu depuis ${years} an${years > 1 ? 's' : ''}. Les abattements s'élèvent à ${socialChargesReduction}% pour les prélèvements sociaux et à ${incomeTaxReduction}% pour l'impôt sur le revenu.</p>
</div>
`;
}
