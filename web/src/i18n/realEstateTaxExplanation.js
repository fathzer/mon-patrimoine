import { formatPercentage, formatCurrency } from './commonTaxExplanations.js';
import { ACQUISITION_FEES_FLAT_RATE, WORKS_FLAT_RATE, FIVE_YEARS_LIMIT } from '../modules/RealEstateModule.js';

export function getRealEstateTaxExplanation(placement) {
  if (placement?.primaryResidence) {
    return `
<div class="tax-explanation">
  <h2>Immobilier</h2>
  <p>La résidence principale est exonérée de prélèvements sociaux et d'impôt sur le revenu lors de la vente.</p>
</div>
`;
  }

  const now = new Date();
  const years = placement.getHoldingYears(now);
  const socialRate = formatPercentage(placement.getSocialChargesRate());
  const socialChargesReduction = formatPercentage(placement.getReductionRate(years));
  const incomeTaxReduction = formatPercentage(placement.getIncomeTaxReduction(years));
  const irRate = formatPercentage(placement.getIncomeTaxRate());
  const irReductionRate = formatPercentage(placement.getIncomeTaxReductionRate());
  const year6To21Rate = formatPercentage(placement.getYear6To21ReductionRate());
  const year22Rate = formatPercentage(placement.getYear22ReductionRate());
  const year23To30Rate = formatPercentage(placement.getYear23To30ReductionRate());
  const grossGain = Math.max(0, placement.currentValue - placement.acquisitionPrice);
  const totalDeductions = placement.getTotalDeductions(now);
  const netGain = Math.max(0, grossGain - totalDeductions);
  const defaultAcquisitionFeesRate = formatPercentage(ACQUISITION_FEES_FLAT_RATE);
  const acquisitionFees = placement.getDeductibleAcquisitionFees();
  const works = placement.getDeductibleWorks(now);
  const defaultWorksRate = formatPercentage(WORKS_FLAT_RATE);

  let acquisitionFeesSource;
  if (placement.acquisitionFees > 0) {
    acquisitionFeesSource = 'montant justifié';
  } else {
    acquisitionFeesSource = `forfait de ${defaultAcquisitionFeesRate} du prix d'acquisition`;
  }

  let worksSource;
  if (placement.works > 0) {
    worksSource = 'montant justifié';
  } else if (years >= FIVE_YEARS_LIMIT) {
    worksSource = `forfait de ${defaultWorksRate} du prix d'acquisition`;
  } else {
    worksSource = `forfait de ${defaultWorksRate} non applicable avant ${FIVE_YEARS_LIMIT} ans de détention`;
  }

  const deductionParagraph = `
  <p>La plus-value fait l'objet des déductions de dépenses suivantes :
  <ul>
    <li>Frais d'acquisition : ${formatCurrency(acquisitionFees)} (${acquisitionFeesSource})</li>
    <li>Travaux déductibles : ${formatCurrency(works)} (${worksSource})</li>
  </ul>
  <p>Plus-value après déductions : ${formatCurrency(netGain)}.</p>
`;

  const rateAllowanceParagraph = years > FIVE_YEARS_LIMIT ? `  Les abattements sur les plus values après déductions de dépenses s'élèvent à ${socialChargesReduction} pour les prélèvements sociaux et à ${incomeTaxReduction} pour l'impôt sur le revenu.
  ` : 'Aucun abattement ne s\'applique.';

  return `
<div class="tax-explanation">
  <h2>Immobilier</h2>
  <p>La base de taxation est la différence entre la valeur actuelle du bien et son prix d'acquisition.</p>
  <p>Cette base fait l'objet des déductions de dépenses suivantes :
  <ul>
    <li>Frais d'acquisition : Soit sur justificatifs, soit pour un forfait de ${defaultAcquisitionFeesRate} du prix d'acquisition</li>
    <li>Travaux déductibles : Soit sur justificatifs, soit pour un forfait de ${defaultWorksRate} du prix d'acquisition (ce forfait n'est valable qu'après ${FIVE_YEARS_LIMIT} ans de détention)</li>
  </ul>

  <h3>Prélèvements sociaux</h3>
  <p>Les prélèvements sociaux sont dus au taux de ${socialRate}.</p>
  <p>L'abattement pour durée de détention réduit la base taxable de :</p>
  <ul>
    <li>${year6To21Rate} par an de la 6<sup>ème</sup> à la 21<sup>ème</sup> année</li>
    <li>${year22Rate} la 22<sup>ème</sup> année</li>
    <li>${year23To30Rate} par an de la 23<sup>ème</sup> à la 30<sup>ème</sup> année</li>
  </ul>

  <h3>Impôt sur le revenu</h3>
  <p>L'impôt sur le revenu est calculé au taux forfaitaire de ${irRate} sur la plus-value, après abattement de la base taxable de ${irReductionRate} par année de détention au-delà de ${FIVE_YEARS_LIMIT} ans.</p>

  <h3>Dans le cas de ce bien :</h3>
  ${deductionParagraph}
  <p>Ce bien est détenu depuis ${years} an${years > 1 ? 's' : ''}. ${rateAllowanceParagraph}</p>
</div>
`;
}
