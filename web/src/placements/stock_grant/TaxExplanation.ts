import { getPfuHelpPopover, getWarning, formatPercentage, SOCIAL_CONTRIBUTION_RATES } from '../kit/v1/index.js';
import type { FiscalProfile } from '../kit/v1/index.js';
import {
  SPECIAL_SOCIAL_RATE,
  EMPLOYER_CONTRIBUTION_RATE,
  FLAT_TAX_RATE_BEFORE_2012,
  DETENTION_ABATTEMENT_2Y,
  DETENTION_ABATTEMENT_8Y,
  UNIFORM_ABATTEMENT_FROM_2018,
  StockGrantModule
} from './module.js';

export class StockGrantTaxExplanation {
  static get(placement: StockGrantModule, fiscalProfile: FiscalProfile | undefined): string {
    const standardRate = formatPercentage(SOCIAL_CONTRIBUTION_RATES.CSG_CRDS);
    const specialRate = formatPercentage(SPECIAL_SOCIAL_RATE);
    const employerContributionRate = formatPercentage(EMPLOYER_CONTRIBUTION_RATE);
    const flatTaxRate = formatPercentage(FLAT_TAX_RATE_BEFORE_2012);
    const abattement2y = formatPercentage(DETENTION_ABATTEMENT_2Y);
    const abattement8y = formatPercentage(DETENTION_ABATTEMENT_8Y);
    const uniformAbattement = formatPercentage(UNIFORM_ABATTEMENT_FROM_2018);
    const threshold = StockGrantModule.THRESHOLD.toLocaleString('fr-FR');

    return `
<div class="tax-explanation">
  <h2>Actions gratuites</h2>

  <h3>Principe</h3>
  <p>Lors de la cession des titres, la taxation s'effectue simultanément sur deux éléments : le gain d'acquisition et la plus-value de cession.</p>
  <ul>
    <li>Le <b>gain d'acquisition</b> est l'avantage consenti par l'entreprise. Il correspond à la valeur des titres au jour de l'attribution définitive.</br>
    <li>La <b>plus-value de cession</b> est la différence entre le prix de cession et le gain d'acquisition.</li>
  </ul>
  <p><i>A Noter : Le gain d'acquisition est plafonné à la valeur actuelle : si une action attribuée à 100 € vaut aujourd'hui 50 €, la valeur d'acquisition retenue est 50 € et la plus-value est nulle.</i></p>

  <h3>Prélèvements sociaux</h3>
  <p>Les plus-values de cession sont soumises à un taux de prélèvements de ${standardRate}.</p>
  <p>Le taux des prélèvements sociaux sur le gain d'acquisition dépend de la date d'attribution :</p>
  <ul>
    <li>Avant le 28/09/2012 : ${standardRate}.</li>
    <li>Du 28/09/2012 au 07/08/2015 : ${specialRate}.</li>
    <li>Du 08/08/2015 au 30/12/2016 : ${standardRate}.</li>
    <li>À partir du 31/12/2016 : ${standardRate} sur la fraction ≤ ${threshold} €, ${specialRate} au-dessus.</li>
  </ul>
  <p>Une <b>contribution salariale de ${employerContributionRate}</b> s'ajoute dans les cas suivants :</p>
  <ul>
    <li>Décision de l'AGE entre le 16/10/2007 et le 07/08/2015 : ${employerContributionRate} sur l'ensemble du gain d'acquisition.</li>
    <li>Décision de l'AGE à partir du 31/12/2016 : ${employerContributionRate} sur la fraction du gain supérieure à ${threshold} €.</li>
  </ul>
  ${getWarning('<p>La date d\'attribution est utilisée comme approximation de la date de décision de l\'AGE pour la contribution salariale de ' + employerContributionRate + '.')}

  <h3>Impôt sur le revenu</h3>
  <p>Les plus-value de cessions sont soumis à l'impôt sur le revenu au ${getPfuHelpPopover(fiscalProfile)}.</p>
  <p>Le régime d'imposition des gains d'acquisition dépend de la date d'attribution :</p>
  <ul>
    <li><b>Avant le 28/09/2012</b> : taux forfaitaire de ${flatTaxRate} (ou option pour le barème, selon les règles des traitements et salaires).</li>
    <li><b>Du 28/09/2012 au 07/08/2015</b> : barème progressif de l'impôt sur le revenu (traitements et salaires, sans abattement pour durée de détention).</li>
    <li><b>Du 08/08/2015 au 30/12/2016</b> : barème progressif avec abattement pour durée de détention (${abattement2y} au-delà de 2 ans, ${abattement8y} au-delà de 8 ans, à compter de la date d'acquisition définitive).</li>
    <li><b>Du 31/12/2016 au 31/12/2017</b> : gain ≤ ${threshold} € — barème progressif avec les mêmes abattements ; fraction > ${threshold} € — barème progressif sans abattement.</li>
    <li><b>À partir du 01/01/2018</b> : gain ≤ ${threshold} € — barème progressif avec abattement unique de ${uniformAbattement} (sans condition de durée) ; fraction > ${threshold} € — barème progressif sans abattement.</li>
  </ul>
  <p>Le seuil de ${threshold} € est réparti proportionnellement entre les attributions éligibles (à partir du 31/12/2016).</p>

  ${getWarning('<p>Il existe une possibilité d\'abattement fixe de 500 000 € pour les dirigeants de PME partant à la retraite. Cette possibilité n\'est pas disponible dans l\'application.</p>')}
</div>
`;
  }
}
