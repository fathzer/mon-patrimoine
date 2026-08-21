import { getTaxDisclaimer, getWarning, getLatentGainsHelpPopover, getPfuHelpPopover, formatPercentage } from './commonTaxExplanations.js';
import { PFU_AFTER_8Y_PRE_2017, UC_SOCIAL_RATE, ALLOWANCE_SINGLE, ALLOWANCE_COUPLE, PREMIUM_THRESHOLD } from '../modules/LifeInsuranceModule.js';
import { HelpPopover } from '../ui/HelpPopover.js';

const REFORM_DATE = '27/09/2017';

export function getLifeInsuranceTaxExplanation(placement, fiscalProfile) {
  const years = placement.getContractYears(new Date());
  const pre2017 = placement.isPre2017Contract();
  const socialRate = formatPercentage(UC_SOCIAL_RATE);
  const pfuLow = formatPercentage(PFU_AFTER_8Y_PRE_2017);
  const allowance = fiscalProfile?.household?.maritalStatus === 'single' ? ALLOWANCE_SINGLE : ALLOWANCE_COUPLE;
  const incomeTaxWording = fiscalProfile?.usePfu
    ? 'au Prélèvement Forfaitaire Unique (PFU)'
    : "au barème progressif de l'impôt sur le revenu";

  const ucHelp = 'Les unités de compte (UC) sont des supports d\'investissement qui sont adossés à des actifs financiers : actions, obligations, immobilier (SCPI), etc... Leurs valeurs fluctuent selon les marchés. Le capital n\'est donc pas garanti, contrairement au fonds en euros';

  return `
<div class="tax-explanation">
  <h2>Assurance-vie</h2>
  <h3>Prélèvements sociaux</h3>
  <p>Les prélèvements sociaux bénéficient d'un taux de ${socialRate} appliqué sur le ${getLatentGainsHelpPopover()}.</p>
  <ul>
    <li>Les prélèvements sociaux sur les supports en ${HelpPopover.getHtml({title: 'Unité de Compte', content: ucHelp, 'label': 'UC'})} sont effectués au moment de la liquidation.</li>
    <li>Pour les fonds en euros, les prélèvements sont effectués chaque année par l'assureur. Au moment de la liquidation, seuls sont dus les prélèvements sur les gains de l'année en cours.</li>
  </ul>
  ${getWarning("<p>Le gain latent est réparti entre unités de compte et fonds en euros au prorata de leurs valeurs actuelles, ce qui est une grossière approximation.</p><p>Le reliquat des gains des fonds en euros pour l'année en cours est négligé dans le calcul.</p>")}

  <h3>Imposition à l'impôt sur le revenu</h3>
  <p>Le ${getLatentGainsHelpPopover()} est soumis à l'impôt sur le revenu au ${getPfuHelpPopover(fiscalProfile)}.</p>
  <p>Les contrats de plus de 8 ans bénéficient :
    <ul>
      <li>d'un abattement annuel de ${ALLOWANCE_SINGLE.toLocaleString('fr-FR')} € pour une personne seule et ${ALLOWANCE_COUPLE.toLocaleString('fr-FR')} € pour un couple. Ce montant est déduit de la base imposable.</li>
      <li>d'un taux de PFU réduit à ${pfuLow} pour tous les versements effectués avant le ${REFORM_DATE}. Les versements ultérieurs bénéficient de ce taux réduit dans la limite de ${PREMIUM_THRESHOLD.toLocaleString('fr-FR')} €.
      <br>Au delà de ce plafond, le taux normal de PFU de s'applique.</li>
    </ul>
  </p>

  <p><i>Attention : Le plafond de ${PREMIUM_THRESHOLD.toLocaleString('fr-FR')} €, ainsi que l'abattement portent sur l'ensemble des contrats. Le calcul repose ici sur les primes du seul contrat saisi.</i></p>

  <!-- TODO: This text is not accurate, needs to be updated -->
  <p>Dans votre cas, le contrat est ouvert depuis ${years} an${years > 1 ? 's' : ''}, et les versements sont considérés comme majoritairement ${pre2017 ? 'antérieurs' : 'postérieurs'} au ${REFORM_DATE}. L'impôt sur le revenu est calculé ${incomeTaxWording}, en appliquant un abattement de ${allowance.toLocaleString('fr-FR')} € après 8 ans si la base est suffisante.</p>
  ${getTaxDisclaimer()}
</div>
`;
}
