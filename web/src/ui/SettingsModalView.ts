import { I18n } from '../core/I18n.js';
import { TaxCalculator } from '../fiscality/TaxCalculator.js';
import { getTaxRulesHelpPopover } from '../i18n/TaxExplanation.js';
import { getPfuHelpPopover } from '../i18n/commonTaxExplanations.js';
import { HelpPopover } from '../ui/HelpPopover.js';
import type { AppStore, TaxProfileInput } from '../core/AppStore.js';

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

    const netIncomeHelp='Votre revenu net est constitué de votre revenu imposable diminué des charges déductibles. Par exemple, vos salaires diminués du forfait de 10% de frais professionnels.';

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
                  </select>
                </div>

                <div>
                  <label for="single-parent-input" style="display: block; font-weight: bold; margin-bottom: 0.3rem; ${singleParentDisabled ? 'color: var(--text-muted);' : ''}">
                    ${I18n.t('settings.singleParent')}
                  </label>
                  <label style="display: flex; align-items: center; gap: 0.4rem; cursor: ${singleParentDisabled ? 'not-allowed' : 'pointer'}; opacity: ${singleParentDisabled ? '0.6' : '1'};">
                    <input type="checkbox" id="single-parent-input" name="isSingleParent" value="on" ${singleParentChecked ? 'checked' : ''} ${singleParentDisabled ? 'disabled' : ''} />
                    ${I18n.t('settings.singleParent')}
                  </label>
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
                  </div>
                  <div>
                    <label for="alternate-children-input" style="display: block; font-size: 0.85rem; margin-bottom: 0.2rem;">
                      ${I18n.t('settings.alternateChildrenCount')}
                    </label>
                    <input type="number" id="alternate-children-input" name="alternateChildrenCount" min="0" max="20" value="${profile.household.alternateChildrenCount}" class="form-control" style="width: 100%; padding: 0.5rem; border-radius: 4px; border: 1px solid var(--card-border);" />
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
                    ${HelpPopover.getHtml({ content: netIncomeHelp, label: '?' })}
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
                <div style="display: flex; gap: 1.5rem;">
                  <label style="cursor: pointer; display: flex; align-items: center; gap: 0.4rem;">
                    <input type="radio" name="usePfu" value="true" ${profile.usePfu === true ? 'checked' : ''} />
                    ${getPfuHelpPopover(profile, I18n.t('settings.pfuEnabled'), false)}
                  </label>
                  <label style="cursor: pointer; display: flex; align-items: center; gap: 0.4rem;">
                    <input type="radio" name="usePfu" value="false" ${profile.usePfu === false ? 'checked' : ''} />
                    ${I18n.t('settings.pfuDisabled')}
                  </label>
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
    const singleParentInput = form.querySelector('#single-parent-input') as HTMLInputElement;
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
      singleParentInput.disabled = !isActive;
      singleParentInput.parentElement!.style.cursor = isActive ? 'pointer' : 'not-allowed';
      singleParentInput.parentElement!.style.opacity = isActive ? '1' : '0.6';
      if (!isActive) {
        singleParentInput.checked = false;
      }
    };

    const updateFiscalSummary = (): void => {
      const taxableIncome = Number.parseFloat(taxableIncomeInput.value || '0');
      const summary = TaxCalculator.computeFiscalMetrics({
        household: {
          maritalStatus: statusSelect.value as 'single' | 'married',
          childrenCount: Number.parseInt(childrenInput.value || '0', 10),
          alternateChildrenCount: Number.parseInt(alternateChildrenInput.value || '0', 10),
          isSingleParent: singleParentInput.checked
        },
        taxableIncome
      });

      const parentsParts = statusSelect.value === 'married' ? 2 : 1;
      const extraParts = summary.parts - parentsParts;
      const taxResult = TaxCalculator.computeFinalTax(taxableIncome, statusSelect.value as 'single' | 'married', extraParts, summary.halfPartReductionCeiling);

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
      updateFiscalSummary();
    });
    childrenInput?.addEventListener('input', () => {
      updateSingleParent();
      updateFiscalSummary();
    });
    alternateChildrenInput?.addEventListener('input', () => {
      updateSingleParent();
      updateFiscalSummary();
    });
    singleParentInput?.addEventListener('change', updateFiscalSummary);
    taxableIncomeInput?.addEventListener('input', updateFiscalSummary);

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const taxableIncome = Number.parseFloat(formData.get('taxableIncome') as string || '0');
      const maritalStatus = formData.get('maritalStatus') as 'single' | 'married';
      const childrenCount = Number.parseInt(formData.get('childrenCount') as string || '0', 10);
      const alternateChildrenCount = Number.parseInt(formData.get('alternateChildrenCount') as string || '0', 10);
      const totalChildren = childrenCount + alternateChildrenCount;
      const isSingleParent = maritalStatus === 'single' && totalChildren > 0 ? formData.get('isSingleParent') === 'on' : false;
      const usePfuValue = formData.get('usePfu');
      const usePfu = usePfuValue ? usePfuValue === 'true' : this.store.getTaxProfile().usePfu;

      const profileData: TaxProfileInput = {
        household: { maritalStatus, childrenCount, alternateChildrenCount, isSingleParent },
        taxableIncome,
        usePfu
      };

      this.store.updateTaxProfile(profileData);
      close();
    });
  }
}
