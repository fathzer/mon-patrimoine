import { FISCAL_RATES } from '../fiscality/rates.js';
import { CSG_2018_THRESHOLD } from '../modules/HomeSavingsModule.js';
import { formatPercentage, getPfuHelpPopover, getTaxDisclaimer } from './commonTaxExplanations.js';

const OLD_RATE = formatPercentage(FISCAL_RATES.OLD_CSG_CRDS);
const NEW_RATE = formatPercentage(FISCAL_RATES.CSG_CRDS);
const TRIGGER_AGE = 12;

let csg2018Date;
const getCsg2018Date = () => {
  if (csg2018Date === undefined) {
    csg2018Date = CSG_2018_THRESHOLD
      .toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      .replace(/^1 /, '1<sup>er</sup> ');
  }
  return csg2018Date;
};

function _getIncomeTaxSection(placement, fiscalProfile, now) {
  const taxDisclaimer = fiscalProfile?.usePfu ? '' : getTaxDisclaimer();
  if (placement.isPfuEligible(now)) {
    return `
      <p>Les intérêts sont soumis à l'impôt sur le revenu au ${getPfuHelpPopover(fiscalProfile)}.</p>
      ${taxDisclaimer}
    `;
  }
  return `<p>Les intérêts sont exonérés d'impôt sur le revenu.</p>`;
}

function _getPelTaxExplanation(placement, fiscalProfile, now) {
  const moreThanTwelve = placement.isOlderThanTwelveYears(now);
  const socialRate = formatPercentage(placement.getSocialChargesRate(now));
  const incomeTaxSection = _getIncomeTaxSection(placement, fiscalProfile, now);

  return `
<div class="tax-explanation">
  <h2>Plan d'Épargne Logement (PEL)</h2>

  <p>La base de taxation de ce placement est constituée des intérêts bruts de l'année.</p>

  <h3>Prélèvements sociaux</h3>
  <p>Le taux applicable dépend de la date d'ouverture et de l'ancienneté du contrat :</p>
  <ul>
    <li>PEL ouvert à compter du ${getCsg2018Date()} : taux de ${NEW_RATE}.</li>
    <li>PEL ouvert avant le ${getCsg2018Date()} : taux de ${OLD_RATE} tant que le contrat n'a pas atteint ${TRIGGER_AGE} ans, puis taux de ${NEW_RATE} au-delà de ${TRIGGER_AGE} ans.</li>
  </ul>

  <h3>Imposition à l'impôt sur le revenu</h3>
  <p>Les intérêts de l'année sont soumis à l'impôt sur le revenu au ${getPfuHelpPopover(fiscalProfile)} pour les PEL ouverts à compter du ${getCsg2018Date()}, ainsi que pour les PEL ouverts avant cette date ayant dépassé ${TRIGGER_AGE} ans. Avant ${TRIGGER_AGE} ans, les intérêts sont exonérés d'impôt sur le revenu.</p>

  <h3>Cas de ce placement</h3>
  <p>Ce PEL est ouvert depuis ${moreThanTwelve ? 'plus de' : 'moins de'} ${TRIGGER_AGE} ans.</p>
  <p>Le taux de prélèvements sociaux retenu est de ${socialRate}.</p>
  ${incomeTaxSection}
</div>
`;
}

function _getCelTaxExplanation(placement, fiscalProfile, now) {
  const before2018 = placement.isOpenedBefore2018();
  const socialRate = formatPercentage(placement.getSocialChargesRate(now));
  const incomeTaxSection = _getIncomeTaxSection(placement, fiscalProfile, now);

  return `
<div class="tax-explanation">
  <h2>Compte d'Épargne Logement (CEL)</h2>

  <p>La base de taxation de ce placement est constituée des intérêts bruts de l'année.</br>
  Le taux des prélèvements sociaux et l'imposition dépendent de la date d'ouverture du contrat :</p>
  <ul>
    <li>Les CEL ouvert avec le ${getCsg2018Date()} sont exonérés d'impôt sur le revenu. Le taux des prélèvements sociaux est de ${OLD_RATE}</li>
    <li>Les CEL ouverts à compter du ${getCsg2018Date()} sont imposables au ${getPfuHelpPopover(fiscalProfile)}. Le taux des prélèvements sociaux est de ${NEW_RATE}.</li>
  </ul>

  <p>Ce CEL est ouvert ${before2018 ? 'avant' : 'après'} le ${getCsg2018Date()}. Le taux de prélèvements sociaux retenu est de ${socialRate}.</p>
  ${incomeTaxSection}
</div>
`;
}

export function getHomeSavingsTaxExplanation(placement, fiscalProfile) {
  const now = new Date();
  return placement.homeSavingsType === 'cel'
    ? _getCelTaxExplanation(placement, fiscalProfile, now)
    : _getPelTaxExplanation(placement, fiscalProfile, now);
}
