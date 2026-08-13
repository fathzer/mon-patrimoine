import { FISCAL_RATES } from '../fiscality/rates.js';

export function getPfuExplanation(fiscalProfile) {
  const pfuRate = (FISCAL_RATES.PFU_IR_RATE * 100).toFixed(1);
  const csgDeductibleRate = (FISCAL_RATES.PFU_CSG_REDUCTION_RATE * 100).toFixed(1);
  const incomeTaxWording = fiscalProfile?.usePfu
    ? `au Prélèvement Forfaitaire Unique (PFU)`
    : `au barème progressif de l'impôt sur le revenu`;

  return `<p>L'impôt sur le revenu est calculé selon le mode de taxation choisi par le contribuable :</p>
<ul>
  <li><b>Prélèvement Forfaitaire Unique (PFU)</b> : l'impôt sur le revenu est calculé au taux forfaitaire de ${pfuRate}% ;</li>
  <li><b>Barème progressif</b> : les revenus sont intégrés au revenu imposable du foyer fiscal et soumis au barème progressif de l'impôt sur le revenu. Une fraction de la CSG, soit ${csgDeductibleRate}%, est alors déductible du revenu imposable</li>
</ul>
<p>Le choix entre ces deux modes de taxation porte sur l'ensemble des revenus concernés de l'année.</p>
<p>Dans votre cas, l'impôt sur le revenu est calculé ${incomeTaxWording}.</p>`;
}

export function getTaxDisclaimer() {
  return getWarning(`
    <p>
      Cette application ne met pas en œuvre un moteur d'imposition au barème complet. Les calculs fiscaux présentés sont simplifiés et approximatifs.
    </p>
    <p>
      Ils ne tiennent pas compte de l'ensemble des règles, abattements, seuils ou situations particulières applicables à votre situation. Ils ne peuvent en aucun cas se substituer à un avis fiscal personnalisé.
    </p>
  `);
}

export function getWarning(content) {
  return `<section class="help-section" style="margin-bottom: 0.5rem;">
  <h3 class="help-section-title">⚠️ Avertissement</h3>
  <div class="help-disclaimer-box">
    ${content}
  </div>
</section>`;
}
