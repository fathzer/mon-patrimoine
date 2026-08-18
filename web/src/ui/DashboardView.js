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
    this._breakdownView = new AssetBreakdownView(null, { onToggle: () => this._toggleSummary() });
    this._summary = null;
    this._summaryExpanded = true;
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
        <h1>${I18n.t('app.title')}</h1>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <button id="btn-import" class="btn-secondary" title="${I18n.t('actions.import')}" style="padding: 0.5rem 0.8rem; font-size: 1rem;">
            📥
          </button>
          <button id="btn-export" class="btn-secondary" title="${I18n.t('actions.export')}" style="padding: 0.5rem 0.8rem; font-size: 1rem;">
            📤
          </button>
          <button id="btn-settings" class="btn-secondary" title="Réglages du profil fiscal" style="padding: 0.5rem 0.8rem; font-size: 1rem;">
            ⚙️
          </button>
          <button id="btn-help" class="btn-secondary" title="Aide et informations" style="padding: 0.5rem 0.8rem; font-size: 1rem;">
            ❓
          </button>
          <button id="btn-logout" class="btn-secondary">${I18n.t('auth.logoutBtn')}</button>
        </div>
      </header>

      <input type="file" id="input-import" accept=".json,application/json" style="display: none;" />

      <main class="main-content">
        <section id="summary-banner" class="summary-banner"></section>
        <div id="assets-container"></div>
      </main>

      <div id="modal-root"></div>
    `;

    this._renderSummaryBanner(summary);

    const modalRoot = this.container.querySelector('#modal-root');
    this._assetTableView.setContainer(this.container.querySelector('#assets-container'));
    this._assetTableView.render(summary, modalRoot);

    this._bindEvents();
  }

  _renderSummaryBanner(summary) {
    const banner = this.container.querySelector('#summary-banner');
    if (!banner) return;

    if (this._summaryExpanded) {
      banner.style.display = '';
      banner.style.justifyContent = '';
      banner.style.alignItems = '';
      banner.style.gap = '';
      banner.innerHTML = `
        <div class="totals-group">
          <div class="total-item">
            <div class="label">${I18n.t('summary.totalGross')}</div>
            <div class="value">${this.formatCurrency(summary.totalGross)}</div>
          </div>
          <div class="total-item">
            <div class="label">${I18n.t('summary.totalNet')}</div>
            <div class="value net">${this.formatCurrency(summary.finalNetValue)}</div>
          </div>
        </div>
        <div class="breakdown-group" id="breakdown-container"></div>
      `;
      this._breakdownView.setContainer(banner.querySelector('#breakdown-container'));
      this._breakdownView.render(summary);
    } else {
      banner.style.display = 'flex';
      banner.style.justifyContent = 'space-between';
      banner.style.alignItems = 'center';
      banner.style.gap = '0';
      banner.innerHTML = `
        <div class="totals-group" style="flex-direction: row; gap: 2rem; border-right: none; padding-right: 0;">
          <div class="total-item" style="margin-bottom: 0;">
            <div class="label">${I18n.t('summary.totalGross')}</div>
            <div class="value">${this.formatCurrency(summary.totalGross)}</div>
          </div>
          <div class="total-item" style="margin-bottom: 0;">
            <div class="label">${I18n.t('summary.totalNet')}</div>
            <div class="value net">${this.formatCurrency(summary.finalNetValue)}</div>
          </div>
        </div>
        <button id="btn-toggle-summary" class="filter-btn" type="button" title="Déplier">▶</button>
      `;
    }

    banner.querySelector('#btn-toggle-summary')?.addEventListener('click', () => this._toggleSummary());
  }

  _toggleSummary() {
    this._summaryExpanded = !this._summaryExpanded;
    this._renderSummaryBanner(this._summary);
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
