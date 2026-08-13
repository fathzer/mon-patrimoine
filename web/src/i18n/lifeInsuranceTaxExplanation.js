import { FISCAL_RATES } from '../fiscality/rates.js';
import { getTaxDisclaimer, getWarning } from './commonTaxExplanations.js';

const UC_SOCIAL_RATE = FISCAL_RATES.OLD_CSG_CRDS * 100;
const PFU_BEFORE_8Y = FISCAL_RATES.PFU_IR_RATE * 100;
const PFU_AFTER_8Y_LOW = 7.5;
const PFU_AFTER_8Y_HIGH = 12.8;
const CSG_DEDUCIBLE_RATE = FISCAL_RATES.PFU_CSG_REDUCTION_RATE * 100;
const ALLOWANCE_SINGLE = 4600;
const ALLOWANCE_COUPLE = 9200;
const PREMIUM_THRESHOLD = 150000;
const REFORM_DATE = '27/09/2017';

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

function isPre2017Contract(placement) {
  return placement?.openingDate && placement.openingDate < '2017-09-27';
}

export function getLifeInsuranceTaxExplanation(placement, fiscalProfile) {
  const years = getContractYears(placement);
  const pre2017 = isPre2017Contract(placement);
  const socialRate = UC_SOCIAL_RATE.toFixed(1);
  const pfuBefore8 = PFU_BEFORE_8Y.toFixed(1);
  const pfuLow = PFU_AFTER_8Y_LOW.toFixed(1);
  const pfuHigh = PFU_AFTER_8Y_HIGH.toFixed(1);
  const csgDeductible = CSG_DEDUCIBLE_RATE.toFixed(1);
  const allowance = fiscalProfile?.maritalStatus === 'single' ? ALLOWANCE_SINGLE : ALLOWANCE_COUPLE;
  const incomeTaxWording = fiscalProfile?.usePfu
    ? 'au Prélèvement Forfaitaire Unique (PFU)'
    : "au barème progressif de l'impôt sur le revenu";

  return `
<div class="tax-explanation">
<h1>TO BE REVISED</h1>
  <h2>Assurance-vie</h2>
  <p>Le gain latent est la différence entre la valeur actuelle du contrat et le total des primes versées.</p>

  <h2>Prélèvements sociaux</h2>
  <p>Les prélèvements sociaux appliqués lors de la liquidation ne concernent que la part les gains issus des unités de compte (UC), au taux de ${socialRate}%.</p>
  <p>Les prélèvements sociaux sur les gains des fonds en euros sont appliqués chaque année par l'assureur. Ils sont donc majoritairement prélevés avant la liquidation et sont négligés dans le calcul.</p>
  ${getWarning("Ce gain latent est réparti au prorata de leur valeur actuelle entre unités de compte et fonds en euros, c'est qui est une grossière approximation.<br>Le reliquat des gains des fonds en euros pour l'année en cours est négligé dans le calcul.")}

  <h2>Imposition à l'impôt sur le revenu</h2>
  <p>L'imposition à l'impôt sur le revenu s'applique elle aussi sur le gain latent et dépend de l'ancienneté du contrat (plus ou moins de 8 ans) et, après 8 ans, de la date des versements (avant ou après le ${REFORM_DATE}).</p>

  <h3>Avant 8 ans</h3>
  <ul>
    <li><b>Prélèvement forfaitaire unique (PFU)</b> : taux de ${pfuBefore8}% sur le gain, qu'il provienne de fonds en euros ou d'UC ;</li>
    <li><b>Barème progressif</b> : le gain est intégré au revenu imposable. Seule la part UC ouvre droit à la CSG déductible (${csgDeductible}% de la part UC).</li>
  </ul>

  <h3>Après 8 ans</h3>
  <p>Les gains imposables à l'IR bénéficient d'un abattement annuel de ${ALLOWANCE_SINGLE.toLocaleString('fr-FR')} € pour une personne seule et ${ALLOWANCE_COUPLE.toLocaleString('fr-FR')} € pour un couple. Ce montant est déduit de la base imposable.</p>

  <h4>Versements antérieurs au ${REFORM_DATE}</h4>
  <ul>
    <li><b>PFU</b> : taux de ${pfuLow}% ;</li>
    <li><b>Barème progressif</b> : la part imposable est soumise au barème de l'IR, avec déduction de ${csgDeductible}% de la part UC.</li>
  </ul>

  <h4>Versements postérieurs au ${REFORM_DATE}</h4>
  <ul>
    <li><b>PFU</b> : taux de ${pfuLow}% sur la part des gains correspondant aux primes versées jusqu'à ${PREMIUM_THRESHOLD.toLocaleString('fr-FR')} € après le ${REFORM_DATE}, puis ${pfuHigh}% au-delà ;</li>
    <li><b>Barème progressif</b> : idem, avec déduction de ${csgDeductible}% de la part UC.</li>
  </ul>

  <p>Dans votre cas, le contrat est ouvert depuis ${years} an${years > 1 ? 's' : ''}, et les versements sont considérés comme majoritairement ${pre2017 ? 'antérieurs' : 'postérieurs'} au ${REFORM_DATE}. L'impôt sur le revenu est calculé ${incomeTaxWording}, en appliquant un abattement de ${allowance.toLocaleString('fr-FR')} € après 8 ans si la base est suffisante.</p>
  <p><i>Attention : ce seuil de ${PREMIUM_THRESHOLD.toLocaleString('fr-FR')} € porte sur le total des primes versées après le ${REFORM_DATE} tous contrats confondus. Le calcul repose ici sur les primes du seul contrat saisi.</i></p>

  ${getTaxDisclaimer()}
</div>
`;
}
