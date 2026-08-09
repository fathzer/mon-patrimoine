import { I18n } from '../core/I18n.js';
import { FISCAL_RATES } from '../fiscality/rates.js';

export class SettingsModalView {
  constructor(container, store) {
    this.container = container;
    this.store = store;
  }

  static calculateTmiFromRfr(rfr, parts) {
    if (!rfr || !parts || parts <= 0) return 0;
    const incomePerPart = rfr / parts;

    for (const bracket of FISCAL_RATES.INCOME_TAX_BRACKETS) {
      if (incomePerPart <= bracket.limit) {
        return bracket.rate;
      }
    }
    return FISCAL_RATES.INCOME_TAX_BRACKETS.at(-1).rate;
  }

  static calculateDefaultParts(status, children) {
    const base = status === 'married' ? 2 : 1;
    let childParts = 0;
    if (children <= 2) {
      childParts = children * 0.5;
    } else if (children > 2) {
      childParts = 1 + (children - 2) * 1;
    }
    return base + childParts;
  }

  show() {
    const profile = this.store.getTaxProfile();

    const computedTmi = profile.mode === 'rfr'
      ? SettingsModalView.calculateTmiFromRfr(profile.rfr, profile.fiscalParts)
      : profile.customTmi;

    const tmiOptions = FISCAL_RATES.INCOME_TAX_BRACKETS
      .map(bracket => {
        const ratePercent = Math.round(bracket.rate * 100);
        const label = bracket.rate === 0
          ? `${ratePercent} % (${I18n.t('settings.nonTaxable')})`
          : `${ratePercent} %`;
        return `<option value="${bracket.rate}" ${profile.customTmi === bracket.rate ? 'selected' : ''}>${label}</option>`;
      }).join('');

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
                    <option value="single" ${profile.maritalStatus === 'single' ? 'selected' : ''}>${I18n.t('settings.maritalStatusSingle')}</option>
                    <option value="married" ${profile.maritalStatus === 'married' ? 'selected' : ''}>${I18n.t('settings.maritalStatusMarried')}</option>
                  </select>
                </div>

                <div>
                  <label for="children-input" style="display: block; font-weight: bold; margin-bottom: 0.3rem;">
                    ${I18n.t('settings.childrenCount')}
                  </label>
                  <input type="number" id="children-input" name="childrenCount" min="0" max="20" value="${profile.childrenCount}" class="form-control" style="width: 100%; padding: 0.5rem; border-radius: 4px; border: 1px solid var(--card-border);" />
                </div>
              </div>

              <div style="margin-bottom: 1.2rem;">
                <label for="parts-input" style="display: block; font-weight: bold; margin-bottom: 0.3rem;">
                  ${I18n.t('settings.fiscalParts')}
                </label>
                <input type="number" id="parts-input" name="fiscalParts" step="0.5" min="1" max="15" value="${profile.fiscalParts}" class="form-control" style="width: 100%; padding: 0.5rem; border-radius: 4px; border: 1px solid var(--card-border);" />
                <small style="color: var(--text-muted); display: block; margin-top: 0.25rem;">
                  ${I18n.t('settings.fiscalPartsHint')}
                </small>
              </div>
            </section>

            <!-- SECTION 2 : TMI -->
            <section class="help-section">
              <h3 class="help-section-title">
                📊 ${I18n.t('settings.tmiSection')}
              </h3>

              <div style="margin-bottom: 1rem;">
                <label style="font-weight: bold; display: block; margin-bottom: 0.5rem;">${I18n.t('settings.inputMode')}</label>
                <div style="display: flex; gap: 1.5rem;">
                  <label style="cursor: pointer; display: flex; align-items: center; gap: 0.4rem;">
                    <input type="radio" name="mode" value="direct" ${profile.mode === 'direct' ? 'checked' : ''} />
                    ${I18n.t('settings.directInput')}
                  </label>
                  <label style="cursor: pointer; display: flex; align-items: center; gap: 0.4rem;">
                    <input type="radio" name="mode" value="rfr" ${profile.mode === 'rfr' ? 'checked' : ''} />
                    ${I18n.t('settings.rfrInput')}
                  </label>
                </div>
              </div>

              <!-- Bloc Direct -->
              <div id="block-direct" style="display: ${profile.mode === 'direct' ? 'block' : 'none'}; margin-bottom: 1.2rem;">
                <label for="tmi-select" style="display: block; font-weight: bold; margin-bottom: 0.3rem;">
                  ${I18n.t('settings.enterTmi')}
                </label>
                <select id="tmi-select" name="customTmi" class="form-control" style="width: 100%; padding: 0.5rem; border-radius: 4px; border: 1px solid var(--card-border);">
                  ${tmiOptions}
                </select>
              </div>

              <!-- Bloc RFR -->
              <div id="block-rfr" style="display: ${profile.mode === 'rfr' ? 'block' : 'none'}; margin-bottom: 1.2rem;">
                <label for="rfr-input" style="display: block; font-weight: bold; margin-bottom: 0.3rem;">
                  ${I18n.t('settings.rfrLabel')}
                </label>
                <input type="number" id="rfr-input" name="rfr" step="100" min="0" value="${profile.rfr}" class="form-control" style="width: 100%; padding: 0.5rem; border-radius: 4px; border: 1px solid var(--card-border);" />

                <div id="rfr-result" style="margin-top: 0.75rem; padding: 0.75rem; background: rgba(37, 99, 235, 0.1); border: 1px solid var(--accent-blue); border-radius: 6px; font-size: 0.9rem;">
                  ${I18n.t('settings.calculatedTmi')} <strong id="calculated-tmi-display">${Math.round(computedTmi * 100)} %</strong>
                </div>
              </div>
            </section>

            <!-- SECTION 3 : PFU -->
            <section class="help-section">
              <h3 class="help-section-title">
                💰 ${I18n.t('settings.pfuSection')}
              </h3>

              <div style="margin-bottom: 1rem;">
                <label style="font-weight: bold; display: block; margin-bottom: 0.5rem;">${I18n.t('settings.pfuMode')}</label>
                <div style="display: flex; gap: 1.5rem;">
                  <label style="cursor: pointer; display: flex; align-items: center; gap: 0.4rem;">
                    <input type="radio" name="usePfu" value="true" ${profile.usePfu === true ? 'checked' : ''} />
                    ${I18n.t('settings.pfuEnabled')} (${(FISCAL_RATES.PFU_IR_RATE * 100).toFixed(1)}% IR + ${(FISCAL_RATES.CSG_CRDS * 100).toFixed(1)}% PS)
                  </label>
                  <label style="cursor: pointer; display: flex; align-items: center; gap: 0.4rem;">
                    <input type="radio" name="usePfu" value="false" ${profile.usePfu === false ? 'checked' : ''} />
                    ${I18n.t('settings.pfuDisabled')}
                  </label>
                </div>
                <small style="color: var(--text-muted); display: block; margin-top: 0.5rem;">
                  ${I18n.t('settings.pfuHint')} (${(FISCAL_RATES.PFU_CSG_REDUCTION_RATE * 100).toFixed(1)}%).
                </small>
              </div>
            </section>

            <div class="modal-actions help-modal-footer">
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

  _bindEvents() {
    const form = this.container.querySelector('#form-settings');
    const cancelBtn = this.container.querySelector('#btn-cancel-settings');
    const overlay = this.container.querySelector('.modal-overlay');

    const statusSelect = form.querySelector('#status-select');
    const childrenInput = form.querySelector('#children-input');
    const partsInput = form.querySelector('#parts-input');
    const modeRadios = form.querySelectorAll('input[name="mode"]');
    const blockDirect = form.querySelector('#block-direct');
    const blockRfr = form.querySelector('#block-rfr');
    const rfrInput = form.querySelector('#rfr-input');
    const calculatedTmiDisplay = form.querySelector('#calculated-tmi-display');

    const close = () => {
      this.container.innerHTML = '';
    };

    cancelBtn?.addEventListener('click', close);
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    const updateParts = () => {
      const status = statusSelect.value;
      const children = Number.parseInt(childrenInput.value || 0, 10);
      partsInput.value = SettingsModalView.calculateDefaultParts(status, children);
      updateRfrCalculation();
    };

    statusSelect?.addEventListener('change', updateParts);
    childrenInput?.addEventListener('input', updateParts);

    modeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.value === 'direct') {
          blockDirect.style.display = 'block';
          blockRfr.style.display = 'none';
        } else {
          blockDirect.style.display = 'none';
          blockRfr.style.display = 'block';
          updateRfrCalculation();
        }
      });
    });

    const updateRfrCalculation = () => {
      const rfr = Number.parseFloat(rfrInput.value || 0);
      const parts = Number.parseFloat(partsInput.value || 1);
      const tmi = SettingsModalView.calculateTmiFromRfr(rfr, parts);
      if (calculatedTmiDisplay) {
        calculatedTmiDisplay.textContent = `${Math.round(tmi * 100)} %`;
      }
    };

    rfrInput?.addEventListener('input', updateRfrCalculation);
    partsInput?.addEventListener('input', updateRfrCalculation);

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const selectedMode = formData.get('mode');
      
      const maritalStatus = formData.get('maritalStatus');
      const childrenCount = Number.parseInt(formData.get('childrenCount') || 0, 10);
      const fiscalParts = Number.parseFloat(formData.get('fiscalParts') || 1);
      const rfr = Number.parseFloat(formData.get('rfr') || 0);
      const customTmi = Number.parseFloat(formData.get('customTmi') || 0.30);

      const effectiveTmi = selectedMode === 'rfr' 
        ? SettingsModalView.calculateTmiFromRfr(rfr, fiscalParts)
        : customTmi;

      const usePfuValue = formData.get('usePfu');
      const usePfu = usePfuValue ? usePfuValue === 'true' : profile.usePfu;
      const profileData = {
        maritalStatus,
        childrenCount,
        fiscalParts,
        mode: selectedMode,
        rfr,
        customTmi,
        tmi: effectiveTmi,
        usePfu
      };

      this.store.updateTaxProfile(profileData);
      close();
    });
  }
}