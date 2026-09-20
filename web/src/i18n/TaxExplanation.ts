import { FISCAL_RATES } from '../fiscality/rates.js';
import { TaxCalculator } from '../fiscality/TaxCalculator.js';
import { HelpPopover } from '../ui/HelpPopover.js';
import { formatCurrency } from './commonTaxExplanations.js';

function formatNumber(value: number): string {
  return value.toLocaleString('fr-FR');
}

function formatPercentage(value: number): string {
  return (value * 100).toLocaleString('fr-FR') + ' %';
}

function getTaxExplanation(): string {
  const childPart = FISCAL_RATES.EXTRA_PARTS.CHILD;
  const childCeiling = FISCAL_RATES.EXTRA_PARTS.CEILING.CHILD;
  const singleParentCeiling = FISCAL_RATES.EXTRA_PARTS.CEILING.SINGLE_PARENT;
  const caseLCeiling = FISCAL_RATES.EXTRA_PARTS.CEILING.CASE_L;

  const exampleIncome = 30000;
  const exampleParts = 1.5;
  const exampleRawTax = TaxCalculator.computeRawTax(exampleIncome, exampleParts);
  const exampleIncomePerPart = exampleIncome / exampleParts;

  const plafIncome = 30000;
  const plafExtraParts = 0.5;
  const plafCeiling = childCeiling;
  const plafWithoutExtra = TaxCalculator.computeRawTax(plafIncome, 1);
  const plafWithExtra = TaxCalculator.computeRawTax(plafIncome, 1 + plafExtraParts);
  const plafCapped = Math.max(0, plafWithoutExtra.rawTax - plafCeiling);
  const plafRetained = Math.max(plafWithExtra.rawTax, plafCapped);
  const plafFinal = TaxCalculator.computeFinalTax(plafIncome, 'single', plafExtraParts, plafCeiling);

  return `
<section class="help-section">
  <h3 class="help-section-title">Principe du calcul des parts</h3>
  <p>
    Le nombre de parts d'un foyer fiscal est la somme des parts des parents et des parts supplémentaires issues des enfants et de situations particulières (parent isolé, handicap, etc.).
  </p>
  <ul>
    <li><b>Parents</b> : 2 parts si marié ou pacsé, 1 part sinon. Un veuf avec personnes à charge conserve la part de son conjoint décédé.</li>
    <li><b>Enfants à charge</b> : les deux premiers comptent pour ${childPart} part chacun ; à partir du troisième, chacun compte pour ${2 * childPart} part.</li>
    <li><b>Enfants en garde alternée</b> : comptent pour la moitié d'un enfant à charge exclusive dans le calcul des parts.</li>
    <li><b>Parent isolé</b> : 1 demi-part supplémentaire si au moins un enfant est à la charge exclusive de ce parent (sinon 1 quart de part pour au moins un enfant en garde alternée).</li>
    <li><b>Case L</b> : 1 demi-part supplémentaire pour une personne seule sans enfant à charge qui a élevé seule un enfant pendant au moins cinq ans.</li>
    <li><b>Handicap</b> : la case P (déclarant invalide) accorde 1 demi-part, avec ou sans personne à charge. Pour un couple, la case F (conjoint invalide) s'y ajoute : P + F = 1 part supplémentaire.</li>
    <li><b>Anciens combattants</b> : les cases W (déclarant) et S (conjoint) accordent 1 demi-part uniquement sans personne à charge (célibataire, divorcé ou veuf) ; pour un couple, elles ne se cumulent ni entre elles ni avec les cases d'invalidité. La case G (pension de veuve de guerre) suit les mêmes règles que W. Ces demi-parts ne se cumulent pas avec la case L.</li>
    <li><b>Enfants handicapés</b> : chaque enfant à charge titulaire de la carte d'invalidité accorde 1 demi-part supplémentaire en garde exclusive (1 quart de part en garde alternée), en plus de sa part d'enfant à charge.</li>
  </ul>

  <h3 class="help-section-title">Plafonds de réduction</h3>
  <p>
    Les gains d'impôt apportés par les parts supplémentaires sont limités par des plafonds.
  </p>
  <ul>
    <li>Demi-part enfant : plafond de ${formatNumber(childCeiling)} €.</li>
    <li>Parent isolé : plafond de ${formatNumber(singleParentCeiling)} € pour les deux premières demi-parts supplémentaires (premier enfant + parent isolé), soit ${formatNumber(singleParentCeiling * childPart)} € si un seul enfant en garde alternée ; les demi-parts suivantes restent au taux général.</li>
    <li>Case L : plafond de ${formatNumber(caseLCeiling)} €, qui remplace entièrement le plafond général.</li>
    <li>Veuf avec enfant à charge en résidence habituelle : plafond majoré de ${formatNumber(FISCAL_RATES.EXTRA_PARTS.CEILING.WIDOW_POST_CAP_REDUCTION)} € (réduction complémentaire post-plafonnement).</li>
    <li>Cases P/F/W/S/G : plafond majoré de ${formatNumber(FISCAL_RATES.EXTRA_PARTS.CEILING.DISABILITY_POST_CAP_REDUCTION)} € dès qu'une case est cochée, même si elle n'accorde pas de part (×2 pour un couple marié ou pacsé avec les cases P et F).</li>
    <li>Enfants handicapés : même majoration de ${formatNumber(FISCAL_RATES.EXTRA_PARTS.CEILING.DISABILITY_POST_CAP_REDUCTION)} € par enfant en garde exclusive (moitié en garde alternée), cumulable avec les cases P/F/W/S/G.</li>
  </ul>
  <p>Ces plafonds se cumulent.</p>

  <h3 class="help-section-title">Calcul de l'impôt</h3>
  <p>
    Le calcul part du <b>revenu net imposable</b> et suit les étapes suivantes.
  </p>

  <h4>1. Calcul de l'impôt brut en fonction du revenu et du nombre de parts</h4>
  <p>revenu net imposable ÷ nombre de parts.</p>
  <p><i>Exemple : ${formatNumber(exampleIncome)} € ÷ ${exampleParts} parts (célibataire avec un enfant) = ${formatNumber(exampleIncomePerPart)} € par part.</i></p>

  <h4>2. Calcul de l'imposition en fonction du revenu par part</h4>
  <p>le revenu par part est calculé à partir des tranches du barème progressif.</p>
  <ul>
    ${FISCAL_RATES.INCOME_TAX_BRACKETS.map(bracket => `<li>${bracket.limit === Infinity ? 'Au-delà de ' + formatNumber(FISCAL_RATES.INCOME_TAX_BRACKETS.at(-2)!.limit) + ' €' : 'Jusqu\'à ' + formatNumber(bracket.limit) + ' €'} : ${(bracket.rate * 100).toLocaleString('fr-FR')} %</li>`).join('')}
  </ul>

  <p>On multiplie le résultat par le nombre de parts.</p>

  <p><i>Exemple : avec ${formatNumber(exampleIncome)} € et ${exampleParts} parts, l'impôt brut est de ${formatCurrency(exampleRawTax.rawTax)} (TMI : ${formatPercentage(exampleRawTax.tmi)}).</i></p>

  <h4>3. Plafonnement des demi-parts supplémentaires</h4>
  <p>On compare deux montants :</p>
  <ul>
    <li>l'impôt calculé avec toutes les parts ;</li>
    <li>l'impôt calculé sans les demi-parts supplémentaires, auquel on retranche le plafond total de ces demi-parts.</li>
  </ul>
  <p>L'impôt brut retenu est le plus grand des deux.</p>

  <p><i>Exemple : célibataire gagnant ${formatNumber(plafIncome)} € avec 1 enfant (0,5 part supplémentaire, plafond ${formatNumber(plafCeiling)} €) :
    <ul>
      <li>impôt avec toutes les parts : ${formatCurrency(plafWithExtra.rawTax)}</li>
      <li>impôt sans la demi-part, moins le plafond : ${formatCurrency(plafCapped)}</li>
    </ul>
    L'impôt brut retenu est de ${formatCurrency(plafRetained)}. L'avantage des demi-parts supplémentaires est de ${formatCurrency(plafFinal.extraPartsBenefit)}.</i></p>

  <h4>4. Décote</h4>
  <p>L'impôt brut est diminué de la décote, plafonnée à ${formatNumber(FISCAL_RATES.DECOTE.limit_single)} € pour une personne seule et à ${formatNumber(FISCAL_RATES.DECOTE.limit_couple)} € pour un couple. Son taux est de ${(FISCAL_RATES.DECOTE.rate * 100).toLocaleString('fr-FR')} %.</p>
  <p>
    Décote = max(0, plafond − (taux × impôt brut))
  </p>
  <p>
    <b>Impôt final</b> = impôt brut − décote.
  </p>
  <p><i>Dans notre exemple : la décote calculée est de ${formatCurrency(plafFinal.decote)}, soit un impôt final de ${formatCurrency(plafFinal.finalTax)}.</i></p>
</section>
  `;
}

HelpPopover.register('help-tax-rules', getTaxExplanation);

export function getTaxRulesHelpPopover(label: string = 'Règles fiscales'): string {
  return HelpPopover.getHtml({ contentKey: 'help-tax-rules', label });
}
