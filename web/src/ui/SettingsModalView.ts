import { I18n } from '../core/I18n.js';
import { TaxCalculator } from '../fiscality/TaxCalculator.js';
import { getTaxRulesHelpPopover } from '../i18n/TaxExplanation.js';
import { getPfuHelpPopover } from '../i18n/commonTaxExplanations.js';
import { HelpPopover } from '../ui/HelpPopover.js';
import { ToggleSwitch } from '../ui/ToggleSwitch.js';
import type { AppStore, TaxProfileInput } from '../core/AppStore.js';
import type { HouseholdData, MaritalStatus } from '../fiscality/Household.js';

type CaseLetter = 'P' | 'F' | 'W' | 'S' | 'G';

// Invalidity/veteran cases available per marital status, following the
// official 2042 notice: the declarant ticks P (invalidity) always, W
// (veteran over 74) when not in a couple, S (couple veteran) when married,
// and G (war-widow pension) when widowed. The spouse ticks F (invalidity,
// including a spouse who died during the income year for a widowed person).
const DECLARANT_CASE_OPTIONS: Record<MaritalStatus, CaseLetter[]> = {
  single: ['P', 'W'],
  married: ['P', 'S'],
  widowed: ['P', 'W', 'G']
};

const SPOUSE_CASE_OPTIONS: Record<MaritalStatus, CaseLetter[]> = {
  single: [],
  married: ['F'],
  widowed: ['F']
};

function caseLabel(letter: string): string {
  return letter === '' ? I18n.t('settings.caseNone') : I18n.t(`settings.case${letter}`);
}

function caseOptionsHtml(values: CaseLetter[], selected: string): string {
  const options = [`<option value="" ${selected === '' ? 'selected' : ''}>${caseLabel('')}</option>`];
  for (const letter of values) {
    options.push(`<option value="${letter}" ${letter === selected ? 'selected' : ''}>${caseLabel(letter)}</option>`);
  }
  return options.join('');
}

/**
 * Returns the letter of the first active case among the given ones.
 */
function householdCase(household: HouseholdData, letters: CaseLetter[]): string {
  return letters.find((letter) => household[`case${letter}`] === true) ?? '';
}

export class SettingsModalView {
  container: HTMLElement;
  store: AppStore;

  constructor(container: HTMLElement, store: AppStore) {
    this.container = container;
    this.store = store;
  }

  show(): void {
    const profile = this.store.getTaxProfile();
    const totalChildren = profile.household.childrenCount + profile.household.alternateChildrenCount;
    const singleParentDisabled = profile.household.maritalStatus !== 'single' || totalChildren === 0;
    const singleParentChecked = singleParentDisabled ? false : (profile.household.isSingleParent ?? false);
    const caseLDisabled = profile.household.maritalStatus === 'married' || totalChildren > 0;
    const caseLChecked = caseLDisabled ? false : (profile.household.caseL ?? false);
    const declarantCase = householdCase(profile.household, DECLARANT_CASE_OPTIONS[profile.household.maritalStatus]);
    const spouseCase = householdCase(profile.household, SPOUSE_CASE_OPTIONS[profile.household.maritalStatus]);

    const netIncomeHelp='Votre revenu net est constitué de votre revenu imposable diminué des charges déductibles. Par exemple, vos salaires diminués du forfait de 10% de frais professionnels.';
    const caseLHelp=`Vous viviez seul au 1er janvier 2025 (ou au 31 décembre 2025 en cas de divorce/séparation/rupture de Pacs en 2025) et vous avez un enfant :
      <ul>
        <li>majeur non rattaché à votre foyer (ou mineur imposé en son nom propre)</li>
        <li>ou décédé après l'âge de 16 ans ou par suite de faits de guerre.</li>
      </ul>
      Vous avez élevé cet enfant pendant au moins cinq années au cours desquelles vous viviez seul.`;
    const disabilityCasesHelp=`
      <ul>
        <li><b>P</b> : vous êtes titulaire d'une pension (militaire, accident du travail) pour invalidité d'au moins 40 %, de la carte d'invalidité ou de la carte mobilité inclusion (CMI) mention « invalidité ».</li>
        <li><b>F</b> : votre conjoint remplit ces conditions, ou votre conjoint décédé en 2025 les remplissait.</li>
        <li><b>W</b> : célibataire, divorcé(e), séparé(e) ou veuf(ve), vous êtes âgé de plus de 74 ans et titulaire de la carte du combattant ou d'une pension militaire d'invalidité ou de victime de guerre ; ou votre conjoint décédé en bénéficiait.</li>
        <li><b>S</b> : marié(e) ou pacsé(e), l'un des deux déclarants âgé de plus de 74 ans remplit ces conditions.</li>
        <li><b>G</b> : vous avez une pension de veuve de guerre.</li>
      </ul>`;

    const fiscalSummary = TaxCalculator.computeFiscalMetrics(profile);
    const parentsParts = profile.household.maritalStatus === 'married' ? 2 : 1;
    const extraParts = fiscalSummary.parts - parentsParts;
    const taxResult = TaxCalculator.computeFinalTax(profile.taxableIncome, profile.household.maritalStatus, extraParts, fiscalSummary.halfPartReductionCeiling);

    this.container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content help-modal-content">

          <h2 class="help-modal-header">
            ⚙️ ${I18n.t('settings.title')}
          </h2>

          <form id="form-settings" class="help-modal-body">

            <!-- SECTION 1 : Situation Familiale & Parts -->
            <section class="help-section">
              <h3 class="help-section-title">
                👨‍👩‍👧‍👦 ${I18n.t('settings.familySection')}
              </h3>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                  <label for="status-select" style="display: block; font-weight: bold; margin-bottom: 0.3rem;">
                    ${I18n.t('settings.maritalStatus')}
                  </label>
                  <select id="status-select" name="maritalStatus" class="form-control" style="width: 100%; padding: 0.5rem; border-radius: 4px; border: 1px solid var(--card-border);">
                    <option value="single" ${profile.household.maritalStatus === 'single' ? 'selected' : ''}>${I18n.t('settings.maritalStatusSingle')}</option>
                    <option value="married" ${profile.household.maritalStatus === 'married' ? 'selected' : ''}>${I18n.t('settings.maritalStatusMarried')}</option>
                    <option value="widowed" ${profile.household.maritalStatus === 'widowed' ? 'selected' : ''}>${I18n.t('settings.maritalStatusWidowed')}</option>
                  </select>

                  <div style="display: flex; align-items: center; gap: 0.3rem; margin-top: 0.6rem;">
                    <label for="declarant-case-input" style="display: block; font-weight: bold; margin-bottom: 0.3rem;">
                      ${I18n.t('settings.declarantCase')}
                    </label>
                    ${HelpPopover.getHtml({ content: disabilityCasesHelp, label: '?', icon: true })}
                  </div>
                  <select id="declarant-case-input" name="declarantCase" class="form-control" style="width: 100%; padding: 0.5rem; border-radius: 4px; border: 1px solid var(--card-border);">
                    ${caseOptionsHtml(DECLARANT_CASE_OPTIONS[profile.household.maritalStatus], declarantCase)}
                  </select>

                  <label id="spouse-case-label" for="spouse-case-input" style="display: block; font-weight: bold; margin: 0.6rem 0 0.3rem;">
                    ${I18n.t('settings.spouseCase')}
                  </label>
                  <select id="spouse-case-input" name="spouseCase" class="form-control" ${profile.household.maritalStatus === 'single' ? 'disabled' : ''} style="width: 100%; padding: 0.5rem; border-radius: 4px; border: 1px solid var(--card-border);">
                    ${caseOptionsHtml(SPOUSE_CASE_OPTIONS[profile.household.maritalStatus], spouseCase)}
                  </select>
                </div>

                <div>
                  ${ToggleSwitch.create({
                    name: 'isSingleParent',
                    id: 'single-parent-input',
                    label: I18n.t('settings.singleParent'),
                    checked: singleParentChecked,
                    disabled: singleParentDisabled
                  })}
                  <div style="display: flex; align-items: center; gap: 0.3rem; margin-top: 0.6rem;">
                    ${ToggleSwitch.create({
                      name: 'caseL',
                      id: 'case-l-input',
                      label: I18n.t('settings.caseL'),
                      checked: caseLChecked,
                      disabled: caseLDisabled
                    })}
                    ${HelpPopover.getHtml({ content: caseLHelp, label: '?', icon: true })}
                  </div>
                </div>
              </div>

              <div style="margin-bottom: 1rem;">
                <p style="font-weight: bold; margin: 0 0 0.3rem;">${I18n.t('settings.children')}</p>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                  <div>
                    <label for="children-input" style="display: block; font-size: 0.85rem; margin-bottom: 0.2rem;">
                      ${I18n.t('settings.childrenCount')}
                    </label>
                    <input type="number" id="children-input" name="childrenCount" min="0" max="20" value="${profile.household.childrenCount}" class="form-control" style="width: 100%; padding: 0.5rem; border-radius: 4px; border: 1px solid var(--card-border);" />
                    <label id="disabled-children-label" for="disabled-children-input" style="display: block; font-size: 0.8rem; margin: 0.4rem 0 0.2rem;">
                      ${I18n.t('settings.disabledChildrenCount')}
                    </label>
                    <input type="number" id="disabled-children-input" name="disabledChildrenCount" min="0" max="${profile.household.childrenCount}" value="${profile.household.disabledChildrenCount ?? 0}" class="form-control" ${profile.household.childrenCount === 0 ? 'disabled' : ''} style="width: 100%; padding: 0.4rem 0.5rem; border-radius: 4px; border: 1px solid var(--card-border);" />
                  </div>
                  <div>
                    <label for="alternate-children-input" style="display: block; font-size: 0.85rem; margin-bottom: 0.2rem;">
                      ${I18n.t('settings.alternateChildrenCount')}
                    </label>
                    <input type="number" id="alternate-children-input" name="alternateChildrenCount" min="0" max="20" value="${profile.household.alternateChildrenCount}" class="form-control" style="width: 100%; padding: 0.5rem; border-radius: 4px; border: 1px solid var(--card-border);" />
                    <label id="disabled-alternate-children-label" for="disabled-alternate-children-input" style="display: block; font-size: 0.8rem; margin: 0.4rem 0 0.2rem;">
                      ${I18n.t('settings.disabledChildrenCount')}
                    </label>
                    <input type="number" id="disabled-alternate-children-input" name="disabledAlternateChildrenCount" min="0" max="${profile.household.alternateChildrenCount}" value="${profile.household.disabledAlternateChildrenCount ?? 0}" class="form-control" ${profile.household.alternateChildrenCount === 0 ? 'disabled' : ''} style="width: 100%; padding: 0.4rem 0.5rem; border-radius: 4px; border: 1px solid var(--card-border);" />
                  </div>
                </div>
              </div>

              <div style="display: flex; gap: 2rem; color: var(--text-muted); font-size: 0.9rem;">
                <span>${I18n.t('settings.parts')} : <span id="parts-display">${fiscalSummary.parts.toLocaleString('fr-FR')}</span></span>
                <span id="reduction-ceiling-wrapper" style="display: ${fiscalSummary.halfPartReductionCeiling > 0 ? 'inline' : 'none'};">
                  ${I18n.t('settings.halfPartReductionCeiling')} : <span id="reduction-ceiling-display">${Math.round(fiscalSummary.halfPartReductionCeiling).toLocaleString('fr-FR')} €</span>
                </span>
              </div>

            </section>

            <!-- SECTION 1.5 : Revenus -->
            <section class="help-section">
              <h3 class="help-section-title">
                💰 ${I18n.t('settings.incomeSection')}
              </h3>

              <div style="margin-bottom: 1.2rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <label for="taxable-income-input" style="font-weight: bold; display: flex; align-items: center; gap: 0.3rem; white-space: nowrap;">
                    ${I18n.t('settings.taxableIncome')}
                    ${HelpPopover.getHtml({ content: netIncomeHelp, label: '?', icon: true })}
                  </label>
                  <input type="number" id="taxable-income-input" name="taxableIncome" step="100" min="0" value="${profile.taxableIncome}" class="form-control" style="flex: 1; padding: 0.5rem; border-radius: 4px; border: 1px solid var(--card-border);" />
                </div>
                <span style="color: var(--text-muted); font-size: 0.9rem; display: block; margin-top: 0.3rem;">
                  ${I18n.t('settings.tmi')} : <span id="tmi-summary-display">${Math.round(fiscalSummary.tmi * 100)} %</span>
                  · ${I18n.t('settings.estimatedTax')} : <span id="final-tax-display">${taxResult.finalTax.toLocaleString('fr-FR')} €</span>
                </span>
              </div>
            </section>

            <!-- SECTION 2 : PFU -->
            <section class="help-section">
              <h3 class="help-section-title">
                💼 ${I18n.t('settings.pfuSection')}
              </h3>

              <div style="margin-bottom: 1rem;">
                <label style="font-weight: bold; display: block; margin-bottom: 0.5rem;">${I18n.t('settings.pfuMode')}</label>
                <div style="display: flex; align-items: center; gap: var(--space-sm);">
                  ${ToggleSwitch.create({
                    name: 'usePfu',
                    labelOff: I18n.t('settings.pfuDisabled'),
                    labelOn: I18n.t('settings.pfuEnabled'),
                    checked: profile.usePfu !== false
                  })}
                  ${getPfuHelpPopover(profile, '?', false, true)}
                </div>
              </div>
            </section>

            <div style="text-align: right; margin-bottom: 1rem;">
              ${getTaxRulesHelpPopover(I18n.t('settings.taxRules'))}
            </div>

            <div class="modal-actions help-modal-footer" style="gap: 0.5rem;">
              <button type="button" id="btn-cancel-settings" class="btn-secondary">
                ${I18n.t('actions.cancel')}
              </button>
              <button type="submit" class="btn-primary">
                ${I18n.t('actions.save')}
              </button>
            </div>
          </form>

        </div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents(): void {
    const form = this.container.querySelector('#form-settings') as HTMLFormElement;
    const cancelBtn = this.container.querySelector('#btn-cancel-settings');
    const overlay = this.container.querySelector('.modal-overlay');

    const close = (): void => {
      this.container.innerHTML = '';
    };

    cancelBtn?.addEventListener('click', close);
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    const statusSelect = form.querySelector('#status-select') as HTMLSelectElement;
    const childrenInput = form.querySelector('#children-input') as HTMLInputElement;
    const alternateChildrenInput = form.querySelector('#alternate-children-input') as HTMLInputElement;
    const disabledChildrenInput = form.querySelector('#disabled-children-input') as HTMLInputElement;
    const disabledChildrenLabel = form.querySelector('#disabled-children-label') as HTMLElement;
    const disabledAlternateChildrenInput = form.querySelector('#disabled-alternate-children-input') as HTMLInputElement;
    const disabledAlternateChildrenLabel = form.querySelector('#disabled-alternate-children-label') as HTMLElement;
    const singleParentInput = form.querySelector('#single-parent-input') as HTMLInputElement;
    const caseLInput = form.querySelector('#case-l-input') as HTMLInputElement;
    const declarantCaseInput = form.querySelector('#declarant-case-input') as HTMLSelectElement;
    const spouseCaseInput = form.querySelector('#spouse-case-input') as HTMLSelectElement;
    const spouseCaseLabel = form.querySelector('#spouse-case-label') as HTMLElement;
    const taxableIncomeInput = form.querySelector('#taxable-income-input') as HTMLInputElement;
    const partsDisplay = form.querySelector('#parts-display');
    const reductionCeilingWrapper = form.querySelector('#reduction-ceiling-wrapper') as HTMLElement | null;
    const reductionCeilingDisplay = form.querySelector('#reduction-ceiling-display');
    const tmiSummaryDisplay = form.querySelector('#tmi-summary-display');
    const finalTaxDisplay = form.querySelector('#final-tax-display');

    const updateSingleParent = (): void => {
      const isSingle = statusSelect.value === 'single';
      const children = Number.parseInt(childrenInput.value || '0', 10);
      const alternateChildren = Number.parseInt(alternateChildrenInput.value || '0', 10);
      const isActive = isSingle && (children + alternateChildren) > 0;
      ToggleSwitch.setEnabled(singleParentInput, isActive);
      if (!isActive) {
        singleParentInput.checked = false;
      }
      const isCaseLActive = statusSelect.value !== 'married' && (children + alternateChildren) === 0;
      ToggleSwitch.setEnabled(caseLInput, isCaseLActive);
      if (!isCaseLActive) {
        caseLInput.checked = false;
      }
    };

    // The invalidity/veteran cases offered depend on the marital status; the
    // spouse select is disabled for a single/divorced taxpayer.
    const updateDisabilityCases = (): void => {
      const status = statusSelect.value as MaritalStatus;
      const declarantValues: string[] = DECLARANT_CASE_OPTIONS[status];
      const spouseValues: string[] = SPOUSE_CASE_OPTIONS[status];
      const declarantSelected = declarantValues.includes(declarantCaseInput.value) ? declarantCaseInput.value : '';
      const spouseSelected = spouseValues.includes(spouseCaseInput.value) ? spouseCaseInput.value : '';
      declarantCaseInput.innerHTML = caseOptionsHtml(DECLARANT_CASE_OPTIONS[status], declarantSelected);
      spouseCaseInput.innerHTML = caseOptionsHtml(SPOUSE_CASE_OPTIONS[status], spouseSelected);
      const spouseDisabled = spouseValues.length === 0;
      spouseCaseInput.disabled = spouseDisabled;
      spouseCaseInput.value = spouseSelected;
      spouseCaseInput.style.opacity = spouseDisabled ? '0.6' : '';
      spouseCaseInput.style.cursor = spouseDisabled ? 'not-allowed' : '';
      if (spouseCaseLabel) {
        spouseCaseLabel.style.opacity = spouseDisabled ? '0.6' : '';
      }
    };

    // The disabled-children count is capped at the children count of its
    // custody type, and the field is disabled when there is no child.
    const updateDisabledChildren = (
      parentInput: HTMLInputElement,
      disabledInput: HTMLInputElement,
      disabledLabel: HTMLElement | null
    ): void => {
      const max = Math.max(0, Number.parseInt(parentInput.value || '0', 10) || 0);
      disabledInput.max = String(max);
      const isDisabled = max === 0;
      disabledInput.disabled = isDisabled;
      disabledInput.style.opacity = isDisabled ? '0.6' : '';
      disabledInput.style.cursor = isDisabled ? 'not-allowed' : '';
      if (disabledLabel) {
        disabledLabel.style.opacity = isDisabled ? '0.6' : '';
      }
      if ((Number.parseInt(disabledInput.value || '0', 10) || 0) > max) {
        disabledInput.value = String(max);
      }
    };

    const updateDisabledChildrenFields = (): void => {
      updateDisabledChildren(childrenInput, disabledChildrenInput, disabledChildrenLabel);
      updateDisabledChildren(alternateChildrenInput, disabledAlternateChildrenInput, disabledAlternateChildrenLabel);
    };

    const updateFiscalSummary = (): void => {
      const taxableIncome = Number.parseFloat(taxableIncomeInput.value || '0');
      const summary = TaxCalculator.computeFiscalMetrics({
        household: {
          maritalStatus: statusSelect.value as MaritalStatus,
          childrenCount: Number.parseInt(childrenInput.value || '0', 10),
          alternateChildrenCount: Number.parseInt(alternateChildrenInput.value || '0', 10),
          disabledChildrenCount: Number.parseInt(disabledChildrenInput.value || '0', 10),
          disabledAlternateChildrenCount: Number.parseInt(disabledAlternateChildrenInput.value || '0', 10),
          isSingleParent: singleParentInput.checked,
          caseL: caseLInput.checked,
          caseP: declarantCaseInput.value === 'P',
          caseW: declarantCaseInput.value === 'W',
          caseG: declarantCaseInput.value === 'G',
          caseS: declarantCaseInput.value === 'S',
          caseF: spouseCaseInput.value === 'F'
        },
        taxableIncome
      });

      const parentsParts = statusSelect.value === 'married' ? 2 : 1;
      const extraParts = summary.parts - parentsParts;
      const taxResult = TaxCalculator.computeFinalTax(taxableIncome, statusSelect.value as MaritalStatus, extraParts, summary.halfPartReductionCeiling);

      if (partsDisplay) {
        partsDisplay.textContent = summary.parts.toLocaleString('fr-FR');
      }
      if (reductionCeilingWrapper) {
        reductionCeilingWrapper.style.display = summary.halfPartReductionCeiling > 0 ? 'inline' : 'none';
      }
      if (reductionCeilingDisplay) {
        reductionCeilingDisplay.textContent = `${Math.round(summary.halfPartReductionCeiling).toLocaleString('fr-FR')} €`;
      }
      if (tmiSummaryDisplay) {
        tmiSummaryDisplay.textContent = `${Math.round(summary.tmi * 100)} %`;
      }
      if (finalTaxDisplay) {
        finalTaxDisplay.textContent = `${taxResult.finalTax.toLocaleString('fr-FR')} €`;
      }
    };

    statusSelect?.addEventListener('change', () => {
      updateSingleParent();
      updateDisabilityCases();
      updateFiscalSummary();
    });
    childrenInput?.addEventListener('input', () => {
      updateSingleParent();
      updateDisabledChildrenFields();
      updateFiscalSummary();
    });
    alternateChildrenInput?.addEventListener('input', () => {
      updateSingleParent();
      updateDisabledChildrenFields();
      updateFiscalSummary();
    });
    disabledChildrenInput?.addEventListener('input', () => {
      updateDisabledChildrenFields();
      updateFiscalSummary();
    });
    disabledAlternateChildrenInput?.addEventListener('input', () => {
      updateDisabledChildrenFields();
      updateFiscalSummary();
    });
    singleParentInput?.addEventListener('change', updateFiscalSummary);
    caseLInput?.addEventListener('change', updateFiscalSummary);
    declarantCaseInput?.addEventListener('change', updateFiscalSummary);
    spouseCaseInput?.addEventListener('change', updateFiscalSummary);
    taxableIncomeInput?.addEventListener('input', updateFiscalSummary);

    // Apply the initial disabled look for the spouse case select
    updateDisabilityCases();
    updateDisabledChildrenFields();

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const taxableIncome = Number.parseFloat(formData.get('taxableIncome') as string || '0');
      const maritalStatus = formData.get('maritalStatus') as MaritalStatus;
      const childrenCount = Number.parseInt(formData.get('childrenCount') as string || '0', 10);
      const alternateChildrenCount = Number.parseInt(formData.get('alternateChildrenCount') as string || '0', 10);
      const disabledChildrenCount = Number.parseInt(formData.get('disabledChildrenCount') as string || '0', 10);
      const disabledAlternateChildrenCount = Number.parseInt(formData.get('disabledAlternateChildrenCount') as string || '0', 10);
      const totalChildren = childrenCount + alternateChildrenCount;
      const isSingleParent = maritalStatus === 'single' && totalChildren > 0 ? formData.get('isSingleParent') === 'on' : false;
      const caseL = maritalStatus !== 'married' && totalChildren === 0 ? formData.get('caseL') === 'on' : false;
      const declarantCaseValues: string[] = DECLARANT_CASE_OPTIONS[maritalStatus];
      const spouseCaseValues: string[] = SPOUSE_CASE_OPTIONS[maritalStatus];
      const declarantCaseValue = formData.get('declarantCase') as string;
      const spouseCaseValue = formData.get('spouseCase') as string;
      const declarantCase = declarantCaseValues.includes(declarantCaseValue) ? declarantCaseValue : '';
      const spouseCase = spouseCaseValues.includes(spouseCaseValue) ? spouseCaseValue : '';
      const usePfu = formData.get('usePfu') === 'on';

      const profileData: TaxProfileInput = {
        household: {
          maritalStatus,
          childrenCount,
          alternateChildrenCount,
          disabledChildrenCount,
          disabledAlternateChildrenCount,
          isSingleParent,
          caseL,
          caseP: declarantCase === 'P',
          caseW: declarantCase === 'W',
          caseG: declarantCase === 'G',
          caseS: declarantCase === 'S',
          caseF: spouseCase === 'F'
        },
        taxableIncome,
        usePfu
      };

      this.store.updateTaxProfile(profileData);
      close();
    });
  }
}
