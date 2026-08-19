import { I18n } from '../core/I18n.js';
import { HelpModalView } from './HelpModalView.js';
import { SettingsModalView } from './SettingsModalView.js';
import { AssetBreakdownView } from './AssetBreakdownView.js';
import { AssetTableView } from './AssetTableView.js';

export class DashboardView {
  constructor(container, store) {
    this.container = container;
    this.store = store;
    this._assetTableView = new AssetTableView(store);
    this._breakdownView = new AssetBreakdownView(null, { onClose: () => this._hideBreakdown() });
    this._summary = null;
    this._breakdownVisible = true;
  }

  showLoading(isLoading) {
    if (isLoading) {
      this.container.innerHTML = `<div class="main-content"><h2>${I18n.t('app.loading')}</h2></div>`;
    }
  }

  render(summary) {
    if (!summary) return;

    if (!summary.isAuthenticated) {
      this._renderAuthScreen();
      return;
    }

    this._summary = summary;
    this.container.innerHTML = `
      <header class="top-bar">
        <h1>
          <img src="favicon.svg" alt="" class="top-bar-logo">
          <span class="top-bar-title">${I18n.t('app.title')}</span>
        </h1>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <button id="btn-show-breakdown" class="btn-secondary" title="${I18n.t('summary.breakdownTitle')}" style="padding: 0.5rem 0.8rem; display: ${this._breakdownVisible ? 'none' : 'inline-flex'}; align-items: center; justify-content: center;">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="var(--accent)" stroke-width="2" fill="none"/>
              <path d="M12 12 L12 3 A9 9 0 0 1 21 12 Z" fill="var(--accent)"/>
            </svg>
          </button>
          <button id="btn-import" class="btn-secondary" title="${I18n.t('actions.import')}" style="padding: 0.5rem 0.8rem; font-size: 1rem;">
            📥
          </button>
          <button id="btn-export" class="btn-secondary" title="${I18n.t('actions.export')}" style="padding: 0.5rem 0.8rem; font-size: 1rem;">
            📤
          </button>
          <button id="btn-settings" class="btn-secondary" title="Réglages du profil fiscal" style="padding: 0.5rem 0.8rem; font-size: 1rem;">
            ⚙️
          </button>
          <button id="btn-help" class="btn-secondary" title="Aide et informations" style="padding: 0.5rem 0.8rem; display: flex; align-items: center; justify-content: center;">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="var(--accent)" stroke-width="2" fill="none"/>
              <text x="12" y="12" text-anchor="middle" dominant-baseline="central" fill="var(--accent)" font-size="13" font-family="Inter, sans-serif">?</text>
            </svg>
          </button>
          <button id="btn-logout" class="btn-secondary" title="${I18n.t('auth.logoutBtn')}" style="padding: 0.5rem; display: flex; align-items: center; justify-content: center;">
            <span class="logout-icon" aria-hidden="true"></span>
          </button>
        </div>
      </header>

      <input type="file" id="input-import" accept=".json,application/json" style="display: none;" />

      <main class="main-content">
        <section id="summary-totals" class="summary-totals"></section>
        <section id="summary-breakdown" class="summary-breakdown"></section>
        <div id="assets-container"></div>
      </main>

      <div id="modal-root"></div>
    `;

    this._renderSummary();

    const modalRoot = this.container.querySelector('#modal-root');
    this._assetTableView.setContainer(this.container.querySelector('#assets-container'));
    this._assetTableView.render(summary, modalRoot);

    this._bindEvents();
  }

  _renderSummary() {
    const totals = this.container.querySelector('#summary-totals');
    const breakdown = this.container.querySelector('#summary-breakdown');
    if (!totals || !breakdown) return;

    totals.innerHTML = `
      <div class="totals-group">
        <div class="total-item">
          <div class="label">${I18n.t('summary.totalGross')}</div>
          <div class="value">${this.formatCurrency(this._summary.totalGross)}</div>
        </div>
        <div class="total-item">
          <div class="label">${I18n.t('summary.totalNet')}</div>
          <div class="value net">${this.formatCurrency(this._summary.finalNetValue)}</div>
        </div>
      </div>
    `;

    if (this._breakdownVisible) {
      breakdown.style.display = 'block';
      breakdown.innerHTML = '<div id="breakdown-container"></div>';
      this._breakdownView.setContainer(breakdown.querySelector('#breakdown-container'));
      this._breakdownView.render(this._summary);
    } else {
      breakdown.style.display = 'none';
      breakdown.innerHTML = '';
    }
  }

  _hideBreakdown() {
    this._breakdownVisible = false;
    this._renderSummary();
    this._updateBreakdownToggle();
  }

  _showBreakdown() {
    this._breakdownVisible = true;
    this._renderSummary();
    this._updateBreakdownToggle();
  }

  _updateBreakdownToggle() {
    const btn = this.container.querySelector('#btn-show-breakdown');
    if (btn) {
      btn.style.display = this._breakdownVisible ? 'none' : 'inline-flex';
    }
  }

  _renderAuthScreen() {
    this.container.innerHTML = `
      <div class="auth-lock-screen">
        <div class="auth-card">
          <h2>${I18n.t('auth.welcomeTitle')}</h2>
          <p class="text-muted" style="margin-bottom: 2rem;">${I18n.t('auth.loginSubtitle')}</p>
          <button id="btn-login" class="btn-primary" style="width:100%; padding: 0.8rem;">
            ${I18n.t('auth.loginBtn')}
          </button>
        </div>
      </div>
    `;

    this.container.querySelector('#btn-login')?.addEventListener('click', () => this.store.login());
  }

  _bindEvents() {
    this.container.querySelector('#btn-logout')?.addEventListener('click', () => this.store.logout());

    this.container.querySelector('#btn-show-breakdown')?.addEventListener('click', () => this._showBreakdown());

    this.container.querySelector('#btn-export')?.addEventListener('click', () => this._exportData());

    this.container.querySelector('#btn-import')?.addEventListener('click', () => {
      this.container.querySelector('#input-import')?.click();
    });

    this.container.querySelector('#input-import')?.addEventListener('change', (e) => {
      this._importFile(e.target.files[0]);
      e.target.value = '';
    });

    this.container.querySelector('#btn-settings')?.addEventListener('click', () => {
      const modalRoot = this.container.querySelector('#modal-root');
      const settingsModal = new SettingsModalView(modalRoot, this.store);
      settingsModal.show();
    });

    this.container.querySelector('#btn-help')?.addEventListener('click', () => {
      const modalRoot = this.container.querySelector('#modal-root');
      const helpModal = new HelpModalView(modalRoot);
      helpModal.show();
    });
  }

  _exportData() {
    const payload = this.store.getExportPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'patrimoine_data.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  _importFile(file) {
    if (!file) return;
    file.text()
      .then(rawData => {
        try {
          this.store.importData(JSON.parse(rawData));
        } catch (error) {
          console.error('Import failed:', error);
          window.alert(I18n.t('alerts.importError'));
        }
      })
      .catch((error) => {
        console.error('Import failed:', error);
        window.alert(I18n.t('alerts.importError'));
      });
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
  }
}
