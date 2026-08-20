import { I18n } from '../core/I18n.js';
import { UiState } from '../core/UiState.js';
import { getWelcomeHtml } from '../i18n/welcome.js';
import { TopBarView } from './TopBarView.js';
import { SettingsModalView } from './SettingsModalView.js';
import { AssetBreakdownView } from './AssetBreakdownView.js';
import { AssetTableView } from './AssetTableView.js';
import { HelpModalView } from './HelpModalView.js';

export class DashboardView {
  constructor(container, store) {
    this.container = container;
    this.store = store;
    this._assetTableView = new AssetTableView(store);
    this._breakdownView = new AssetBreakdownView(null, { onClose: () => this._hideBreakdown() });
    this._summary = null;
    this._breakdownVisible = UiState.load().breakdownVisible;
    this._layoutInitialized = false;
    this._topBarContainer = null;
    this._pageContent = null;
    this._modalRoot = null;
    this._topBarView = new TopBarView(store, {
      onShowBreakdown: () => this._showBreakdown(),
      onExport: () => this._exportData(),
      onImportClick: () => this._triggerImport(),
      onSettings: () => this._openSettings()
    });
  }

  _initLayout() {
    this.container.innerHTML = `
      <header id="top-bar" class="top-bar"></header>
      <main id="page-content" class="main-content"></main>
      <div id="modal-root"></div>
    `;
    this._topBarContainer = this.container.querySelector('#top-bar');
    this._pageContent = this.container.querySelector('#page-content');
    this._modalRoot = this.container.querySelector('#modal-root');
    this._topBarView.setContainer(this._topBarContainer);
    this._topBarView.setModalRoot(this._modalRoot);
    this._layoutInitialized = true;
  }

  showLoading(isLoading) {
    if (!this._layoutInitialized) this._initLayout();
    if (isLoading) {
      this._topBarView.render(false);
      this._pageContent.innerHTML = `<h2>${I18n.t('app.loading')}</h2>`;
    } else {
      this._pageContent.innerHTML = '';
    }
  }

  render(summary) {
    if (!summary) return;
    if (!this._layoutInitialized) this._initLayout();

    this._topBarView.render(summary.isAuthenticated, this._breakdownVisible);

    if (!summary.isAuthenticated) {
      this._renderAuthScreen();
      return;
    }

    this._summary = summary;
    this._pageContent.innerHTML = `
      <input type="file" id="input-import" accept=".json,application/json" style="display: none;" />

      <section id="summary-totals" class="summary-totals"></section>
      <section id="summary-breakdown" class="summary-breakdown"></section>
      <div id="assets-container"></div>
    `;

    this._renderSummary();

    const modalRoot = this._modalRoot;
    this._assetTableView.setContainer(this._pageContent.querySelector('#assets-container'));
    this._assetTableView.render(summary, modalRoot);

    this._bindAuthenticatedEvents();
  }

  _renderSummary() {
    const totals = this._pageContent.querySelector('#summary-totals');
    const breakdown = this._pageContent.querySelector('#summary-breakdown');
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
    UiState.save({ breakdownVisible: false });
    this._renderSummary();
    this._topBarView.render(true, this._breakdownVisible);
  }

  _showBreakdown() {
    this._breakdownVisible = true;
    UiState.save({ breakdownVisible: true });
    this._renderSummary();
    this._topBarView.render(true, this._breakdownVisible);
  }

  _renderAuthScreen() {
    this._pageContent.innerHTML = getWelcomeHtml();

    this._pageContent.querySelector('#btn-login')?.addEventListener('click', () => this.store.login());
    this._pageContent.querySelector('#btn-auth-help')?.addEventListener('click', () => {
      const helpModal = new HelpModalView(this._pageContent.querySelector('#auth-modal-root'));
      helpModal.show();
    });
  }

  _bindAuthenticatedEvents() {
    this._pageContent.querySelector('#input-import')?.addEventListener('change', (e) => {
      this._importFile(e.target.files[0]);
      e.target.value = '';
    });
  }

  _openSettings() {
    const settingsModal = new SettingsModalView(this._modalRoot, this.store);
    settingsModal.show();
  }

  _triggerImport() {
    this._pageContent.querySelector('#input-import')?.click();
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
