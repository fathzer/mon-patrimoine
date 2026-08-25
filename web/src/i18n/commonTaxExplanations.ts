import { FISCAL_RATES } from '../fiscality/rates.js';
import { HelpPopover } from '../ui/HelpPopover.js';
import type { FiscalProfile } from '../fiscality/TaxCalculator.js';

HelpPopover.register('help-pfu', (args: unknown) => getPfuExplanation(args as PfuExplanationArgs));
HelpPopover.register('help-gains-latents', () => 'Le gain latent est la différence entre la valeur actuelle d\'un placement et le total des versements effectués.');

export interface PfuExplanationArgs {
  fiscalProfile?: FiscalProfile;
  personalCase?: boolean;
}

export function getPfuExplanation({ fiscalProfile, personalCase = true }: PfuExplanationArgs = {}): string {
  const pfuRate = formatPercentage(FISCAL_RATES.PFU_IR_RATE);
  const csgDeductibleRate = formatPercentage(FISCAL_RATES.PFU_CSG_REDUCTION_RATE);
  const incomeTaxWording = fiscalProfile?.usePfu
    ? 'au Prélèvement Forfaitaire Unique (PFU)'
    : "au barème progressif de l'impôt sur le revenu";

  const personalCaseText = personalCase
    ? "<p>Dans votre cas, l'impôt sur le revenu est calculé " + incomeTaxWording + '.</p>'
    : '';

  return `<p>L'impôt sur les plus values de certains placements est calculé selon le mode de taxation choisi par le contribuable :</p>
<ul>
  <li><b>Prélèvement Forfaitaire Unique (PFU)</b> : l'impôt est calculé au taux forfaitaire de ${pfuRate}.</li>
  <li><b>Barème progressif</b> : les plus values sont intégrées au revenu imposable du foyer fiscal et soumises au barème progressif de l'impôt sur le revenu. Une fraction de la CSG, soit ${csgDeductibleRate}, est alors déductible du revenu imposable.</li>
</ul>
<p>Le choix entre ces deux modes de taxation porte sur l'ensemble des revenus concernés de l'année.</p>
${personalCaseText}`;
}

export function formatPercentage(value: number): string {
  return (value * 100).toLocaleString('fr-FR')+'%';
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
}

export function getTaxDisclaimer(extraContent: string = ''): string {
  return getWarning(`
    <p>
      Cette application ne met pas en œuvre un moteur d'imposition au barème complet. Les calculs fiscaux présentés sont simplifiés et approximatifs.
    </p>
    <p>
      Ils sont calculés indépendamment de vos autres revenus de placement et ne tiennent pas compte de l'ensemble des règles, abattements, seuils globaux ou situations particulières applicables à votre situation. Ils ne peuvent en aucun cas se substituer à un avis fiscal personnalisé.
    </p>
    ${extraContent}
  `);
}

export function getWarning(content: string): string {
  return `<section class="help-section" style="margin-bottom: 0.5rem;">
  <h3 class="help-section-title">⚠️ Avertissement</h3>
  <div class="help-disclaimer-box">
    ${content}
  </div>
</section>`;
}

export function getPfuHelpPopover(fiscalProfile: FiscalProfile | undefined = undefined, label: string = 'PFU', personalCase: boolean = true): string {
  return HelpPopover.getHtml({ contentKey: 'help-pfu', label, contentArgs: { fiscalProfile, personalCase } });
}

export function getLatentGainsHelpPopover(label: string = 'gain latent'): string {
  return HelpPopover.getHtml({ contentKey: 'help-gains-latents', label });
}
