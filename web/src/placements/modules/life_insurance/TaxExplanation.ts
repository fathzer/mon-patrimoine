import { getTaxDisclaimer, getWarning, getLatentGainsHelpPopover, getPfuHelpPopover, formatPercentage, HelpPopover, getTaxSection } from '../../kit/v1/index.js';
import type { FiscalProfile } from '../../kit/v1/index.js';
import { PFU_AFTER_8Y_PRE_2017, PFU_AFTER_8Y_POST_2017_HIGH, UC_SOCIAL_RATE, ALLOWANCE_SINGLE, ALLOWANCE_COUPLE, PREMIUM_THRESHOLD } from './module.js';
import type { GainTaxTranche, GainTrancheScope, LifeInsuranceModule } from './module.js';

const REFORM_DATE = '27/09/2017';

export function getLifeInsuranceTaxExplanation(placement: LifeInsuranceModule, fiscalProfile: FiscalProfile | undefined): string {
  const socialRate = formatPercentage(UC_SOCIAL_RATE);
  const pfuLow = formatPercentage(PFU_AFTER_8Y_PRE_2017);
  const pfuHigh = formatPercentage(PFU_AFTER_8Y_POST_2017_HIGH);
  const ucHelp = 'Les unités de compte (UC) sont des supports d\'investissement qui sont adossés à des actifs financiers : actions, obligations, immobilier (SCPI), etc... Leurs valeurs fluctuent selon les marchés. Le capital n\'est donc pas garanti, contrairement au fonds en euros';

  return `
<div class="tax-explanation">
  <h2>Assurance-vie</h2>
  ${getTaxSection('Prélèvements sociaux', `
    <p>Les prélèvements sociaux bénéficient d'un taux de ${socialRate} appliqué sur le ${getLatentGainsHelpPopover()}.</p>
    <ul>
      <li>Les prélèvements sociaux sur les supports en ${HelpPopover.getHtml({title: 'Unité de Compte', content: ucHelp, 'label': 'UC'})} sont effectués au moment de la liquidation.</li>
      <li>Pour les fonds en euros, les prélèvements sont effectués chaque année par l'assureur. Au moment de la liquidation, seuls sont dus les prélèvements sur les gains de l'année en cours.</li>
    </ul>
    ${getWarning("<p>Le gain latent est réparti entre unités de compte et fonds en euros au prorata de leurs valeurs actuelles, ce qui est une grossière approximation.</p><p>Le reliquat des gains des fonds en euros pour l'année en cours est négligé dans le calcul.</p>")}`)}
  ${getTaxSection('Imposition à l\'impôt sur le revenu', `
    <p>Le ${getLatentGainsHelpPopover()} est soumis à l'impôt sur le revenu au ${getPfuHelpPopover(fiscalProfile)}.</p>
    <p>Les contrats de plus de 8 ans bénéficient :
      <ul>
        <li>d'un abattement annuel de ${ALLOWANCE_SINGLE.toLocaleString('fr-FR')} € pour une personne seule et ${ALLOWANCE_COUPLE.toLocaleString('fr-FR')} € pour un couple. Ce montant est déduit de la base imposable.</li>
        <li>d'un taux de PFU réduit à ${pfuLow} pour tous les versements effectués avant le ${REFORM_DATE}. Les versements ultérieurs bénéficient de ce taux réduit dans la limite de ${PREMIUM_THRESHOLD.toLocaleString('fr-FR')} €.
        <br>Au-delà de ce plafond, le taux normal de PFU (${pfuHigh}) s'applique.</li>
      </ul>
    </p>

    <p><i>Attention : Le plafond de ${PREMIUM_THRESHOLD.toLocaleString('fr-FR')} €, ainsi que l'abattement portent sur l'ensemble des contrats. Le calcul repose ici sur les primes du seul contrat saisi.</i></p>

    <p>Dans votre cas, ${getPersonalCaseWording(placement, fiscalProfile)}</p>
    ${getTaxDisclaimer()}`)}
</div>
`;
}

/**
 * Describes how the premiums of this contract are split across the 27/09/2017
 * reform boundary. The taxable gain is split pro-rata of pre/post-2017
 * premiums, so the wording must reflect the actual proportion rather than a
 * majority.
 */
function getPremiumsWording(placement: LifeInsuranceModule): string {
  const post2017Premiums = Math.max(0, placement.totalPremiums - placement.pre2017Premiums);
  if (!placement.isPre2017Contract()) {
    return `la totalité des versements est postérieure au ${REFORM_DATE}`;
  }
  if (placement.pre2017Premiums <= 0) {
    return `aucun versement antérieur au ${REFORM_DATE} n'est renseigné : la totalité des versements est donc considérée comme postérieure à cette date`;
  }
  if (post2017Premiums <= 0) {
    return `la totalité des versements est antérieure au ${REFORM_DATE}`;
  }
  const preShare = placement.pre2017Premiums / placement.totalPremiums;
  return `${formatPercentage(preShare)} des versements (soit ${placement.pre2017Premiums.toLocaleString('fr-FR')} €) sont antérieurs au ${REFORM_DATE} et ${formatPercentage(1 - preShare)} (soit ${post2017Premiums.toLocaleString('fr-FR')} €) postérieurs à cette date`;
}

function formatEuro(value: number): string {
  return `${Math.round(value).toLocaleString('fr-FR')} €`;
}

function getTrancheScopeWording(scope: GainTrancheScope): string {
  switch (scope) {
    case 'all': return 'la totalité de la base';
    case 'pre2017': return `la part correspondant aux versements antérieurs au ${REFORM_DATE}`;
    case 'post2017': return `la part correspondant aux versements postérieurs dans la limite du plafond de ${PREMIUM_THRESHOLD.toLocaleString('fr-FR')} € de versements`;
    case 'post2017OverCeiling': return 'la part correspondant aux versements postérieurs au-delà du plafond';
  }
}

function getTrancheRateWording(tranche: GainTaxTranche): string {
  return tranche.scope === 'post2017OverCeiling'
    ? `au taux normal du PFU (${formatPercentage(tranche.rate)})`
    : `au taux réduit de ${formatPercentage(tranche.rate)}`;
}

/**
 * Describes the rate applied to each tranche of the taxable gain: a single
 * sentence when every tranche shares the same rate, one clause per tranche
 * otherwise.
 */
function getTranchesWording(tranches: GainTaxTranche[]): string {
  if (tranches.every(t => t.rate === tranches[0].rate)) {
    return ` La totalité de cette base est imposée ${getTrancheRateWording(tranches[0])}.`;
  }
  const clauses = tranches.map((tranche, index) => {
    const rateWording = index > 0 && tranche.rate === tranches[index - 1].rate
      ? 'au même taux'
      : getTrancheRateWording(tranche);
    const scopeWording = getTrancheScopeWording(tranche.scope);
    const capitalized = index === 0 ? scopeWording.charAt(0).toUpperCase() + scopeWording.slice(1) : scopeWording;
    return `${capitalized} (soit ${formatEuro(tranche.base)}) est imposée ${rateWording}`;
  });
  return ` ${clauses.join(' ; ')}.`;
}

/**
 * Builds the "Dans votre cas" sentence describing the income tax actually
 * applied to this contract, straight from the breakdown computed by the
 * module: no tax without latent gain, the standard PFU rate (or the
 * progressive scale) before 8 years, and the allowance plus reduced/standard
 * PFU rates afterwards.
 */
function getPersonalCaseWording(placement: LifeInsuranceModule, fiscalProfile: FiscalProfile | undefined): string {
  const years = placement.getContractYears(new Date());
  const yearsWording = `le contrat est ouvert depuis ${years} an${years > 1 ? 's' : ''}`;
  const breakdown = placement.getIncomeTaxBreakdown(fiscalProfile);
  if (breakdown.latentGain <= 0) {
    return `${yearsWording} et ne dégage aucun gain latent : aucun impôt sur le revenu n'est dû.`;
  }
  const gainWording = `Le gain latent de ${formatEuro(breakdown.latentGain)}`;

  if (years < 8) {
    return breakdown.tranches.length === 0
      ? `${yearsWording}. ${gainWording} est imposé au barème progressif de l'impôt sur le revenu : l'abattement ne s'applique pas avant 8 ans.`
      : `${yearsWording}. ${gainWording} est imposé au Prélèvement Forfaitaire Unique (PFU), au taux standard de ${formatPercentage(breakdown.tranches[0].rate)} : ni l'abattement ni le taux réduit ne s'appliquent avant 8 ans.`;
  }

  const intro = `${yearsWording}, et ${getPremiumsWording(placement)}`;
  if (breakdown.taxableGain <= 0) {
    return `${intro}. ${gainWording} est entièrement couvert par l'abattement de ${formatEuro(breakdown.allowance)} : aucun impôt sur le revenu n'est dû.`;
  }
  const baseWording = ` après un abattement de ${formatEuro(breakdown.allowance)}, soit ${formatEuro(breakdown.taxableGain)} de base imposable`;
  if (breakdown.tranches.length === 0) {
    return `${intro}. Cette distinction n'a d'incidence qu'en cas d'imposition au PFU. ${gainWording} est imposé au barème progressif de l'impôt sur le revenu${baseWording}.`;
  }
  return `${intro}. ${gainWording} est imposé au Prélèvement Forfaitaire Unique (PFU)${baseWording}.${getTranchesWording(breakdown.tranches)}`;
}
