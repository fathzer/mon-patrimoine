import { getFiscalRates, getVotedScheduleYear } from '../fiscality/rates.js';
import { HelpPopover } from '../ui/HelpPopover.js';
import type { FiscalProfile } from '../fiscality/TaxCalculator.js';

HelpPopover.register('help-pfu', (args: unknown) => getPfuExplanation(args as PfuExplanationArgs));
HelpPopover.register('help-gains-latents', () => 'Le gain latent est la différence entre la valeur actuelle d\'un placement et le total des versements effectués.');

export interface PfuExplanationArgs {
  fiscalProfile?: FiscalProfile;
  personalCase?: boolean;
  /** Income year whose rates apply — defaults to the current year. */
  year?: number;
}

export function getPfuExplanation({ fiscalProfile, personalCase = true, year }: PfuExplanationArgs = {}): string {
  const rates = getFiscalRates(year);
  const pfuRate = formatPercentage(rates.PFU_IR_RATE);
  const csgDeductibleRate = formatPercentage(rates.PFU_CSG_REDUCTION_RATE);
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

/**
 * Warning displayed when the requested income year's schedule is not voted
 * yet: the computation silently falls back to the latest voted year (see
 * getFiscalRates). Empty string when the schedule is voted.
 */
export function getUnvotedScheduleWarning(incomeYear: number): string {
  const votedYear = getVotedScheduleYear(incomeYear);
  return votedYear === incomeYear ? '' : getWarning(
    `<p>Le barème de l'impôt sur le revenu ${incomeYear} n'est pas encore disponible : les tranches, plafonds et taux de ${votedYear} sont utilisés à la place.</p>`
  );
}

/**
 * Warning displayed in the tax explanation modal when the asset list is being
 * shown in current (inflation-adjusted) euros: the explanation itself always
 * uses the original nominal amounts. `baseMonth` is the latest published
 * month of the selected INSEE series.
 */
export function getInflationDisplayWarning(baseMonth: string): string {
  return getWarning(
    `<p>Les montants affichés dans la liste des actifs sont actuellement exprimés en euros constants (base ${baseMonth}). Cette explication fiscale conserve les montants d'origine en euros de l'époque.</p>`
  );
}

export function getWarning(content: string): string {
  return `<fieldset class="form-section warning-section"><legend>⚠️ Avertissement</legend>${content}</fieldset>`;
}

export function getPfuHelpPopover(fiscalProfile: FiscalProfile | undefined = undefined, label: string = 'PFU', personalCase: boolean = true, icon: boolean = false, incomeYear?: number): string {
  return HelpPopover.getHtml({ contentKey: 'help-pfu', label, contentArgs: { fiscalProfile, personalCase, year: incomeYear }, icon });
}

export function getLatentGainsHelpPopover(label: string = 'gain latent'): string {
  return HelpPopover.getHtml({ contentKey: 'help-gains-latents', label });
}

/**
 * Wraps content in a framed section with the title displayed in the top border
 * (fieldset/legend style). Used to group "Prélèvements sociaux" and
 * "Imposition à l'impôt sur le revenu" sections in tax explanations.
 *
 * The CSS class `form-section` is part of the Placement Kit v1 and is defined
 * in `components/forms.css`.
 */
export function getTaxSection(title: string, content: string): string {
  return `<fieldset class="form-section"><legend>${title}</legend>${content}</fieldset>`;
}
