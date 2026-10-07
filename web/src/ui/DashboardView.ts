import { I18n } from '../core/I18n.js';
import { UiState } from '../core/UiState.js';
import { getWelcomeHtml } from '../i18n/welcome.js';
import { TopBarView } from './TopBarView.js';
import { SettingsModalView } from './SettingsModalView.js';
import { ToggleSwitch } from './ToggleSwitch.js';
import { AssetBreakdownView } from './AssetBreakdownView.js';
import { AssetTableView } from './AssetTableView.js';
import { HelpModalView } from './HelpModalView.js';
import type { AppStore, GlobalSummary } from '../core/AppStore.js';

export class DashboardView {
  container: HTMLElement;
  store: AppStore;
  _assetTableView: AssetTableView;
  _breakdownView: AssetBreakdownView;
  _summary: GlobalSummary | null;
  _filterTotals: boolean;
  _breakdownVisible: boolean;
  _layoutInitialized: boolean;
  _topBarContainer: HTMLElement | null;
  _pageContent: HTMLElement | null;
  _modalRoot: HTMLElement | null;
  _topBarView: TopBarView;

  constructor(container: HTMLElement, store: AppStore) {
    this.container = container;
    this.store = store;
    this._assetTableView = new AssetTableView(store, { onFiltersChanged: () => this._renderSummary() });
    this._breakdownView = new AssetBreakdownView(null, { onClose: () => this._hideBreakdown() });
    this._summary = null;
    const ui = UiState.load();
    this._filterTotals = ui.filterTotals;
    this._breakdownVisible = ui.breakdownVisible;
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

  _initLayout(): void {
    this.container.innerHTML = `
      <header id="top-bar" class="top-bar"></header>
      <main id="page-content" class="main-content"></main>
      <div id="modal-root"></div>
    `;
    this._topBarContainer = this.container.querySelector('#top-bar') as HTMLElement | null;
    this._pageContent = this.container.querySelector('#page-content') as HTMLElement | null;
    this._modalRoot = this.container.querySelector('#modal-root') as HTMLElement | null;
    this._topBarView.setContainer(this._topBarContainer!);
    this._topBarView.setModalRoot(this._modalRoot!);
    this._layoutInitialized = true;
  }

  showLoading(isLoading: boolean): void {
    if (!this._layoutInitialized) this._initLayout();
    if (isLoading) {
      this._topBarView.render(false);
      this._pageContent!.innerHTML = `<h2>${I18n.t('app.loading')}</h2>`;
    } else {
      this._pageContent!.innerHTML = '';
    }
  }

  render(summary: GlobalSummary): void {
    if (!summary) return;
    if (!this._layoutInitialized) this._initLayout();

    this._topBarView.render(summary.isAuthenticated, this._breakdownVisible);

    if (!summary.isAuthenticated) {
      this._renderAuthScreen();
      return;
    }

    this._summary = summary;
    this._pageContent!.innerHTML = `
      <input type="file" id="input-import" accept=".json,application/json" style="display: none;" />

      <section id="summary-totals" class="summary-totals"></section>
      <section id="summary-breakdown" class="summary-breakdown"></section>
      <div id="assets-container"></div>
    `;

    this._renderSummary();

    const modalRoot = this._modalRoot!;
    this._assetTableView.setContainer(this._pageContent!.querySelector('#assets-container') as HTMLElement);
    this._assetTableView.render(summary, modalRoot);

    this._bindAuthenticatedEvents();
  }

  _renderSummary(): void {
    const totals = this._pageContent!.querySelector('#summary-totals') as HTMLElement | null;
    const breakdown = this._pageContent!.querySelector('#summary-breakdown') as HTMLElement | null;
    if (!totals || !breakdown) return;

    const displayed = this._getDisplayedTotals();

    totals.innerHTML = `
      <div class="totals-group">
        <div class="total-item">
          <div class="label">${I18n.t('summary.totalGross')}</div>
          <div class="value">${this.formatCurrency(displayed.gross)}</div>
        </div>
        <div class="total-item">
          <div class="label">${I18n.t('summary.totalNet')}</div>
          <div class="value net">${this.formatCurrency(displayed.net)}</div>
        </div>
        ${ToggleSwitch.create({
          name: 'summary-filter-toggle',
          id: 'summary-filter-toggle',
          label: I18n.t('summary.filterTotals'),
          checked: this._filterTotals,
          containerClass: 'summary-filter'
        })}
      </div>
    `;

    const toggle = totals.querySelector('#summary-filter-toggle') as HTMLInputElement | null;
    toggle?.addEventListener('change', () => {
      this._filterTotals = toggle!.checked;
      UiState.save({ filterTotals: this._filterTotals });
      this._renderSummary();
    });

    if (this._breakdownVisible) {
      breakdown.style.display = 'block';
      breakdown.innerHTML = '<div id="breakdown-container"></div>';
      this._breakdownView.setContainer(breakdown.querySelector('#breakdown-container') as HTMLElement);
      this._breakdownView.render(this._summary!);
    } else {
      breakdown.style.display = 'none';
      breakdown.innerHTML = '';
    }
  }

  _hideBreakdown(): void {
    this._breakdownVisible = false;
    UiState.save({ breakdownVisible: false });
    this._renderSummary();
    this._topBarView.render(true, this._breakdownVisible);
  }

  _showBreakdown(): void {
    this._breakdownVisible = true;
    UiState.save({ breakdownVisible: true });
    this._renderSummary();
    this._topBarView.render(true, this._breakdownVisible);
  }

  _renderAuthScreen(): void {
    this._pageContent!.innerHTML = getWelcomeHtml();

    this._pageContent!.querySelector('#btn-login')?.addEventListener('click', () => this.store.login());
    this._pageContent!.querySelector('#btn-auth-help')?.addEventListener('click', () => {
      const helpModal = new HelpModalView(this._pageContent!.querySelector('#auth-modal-root') as HTMLElement);
      helpModal.show();
    });
  }

  _bindAuthenticatedEvents(): void {
    this._pageContent!.querySelector('#input-import')?.addEventListener('change', (e) => {
      const input = e.target as HTMLInputElement;
      this._importFile(input.files![0]);
      input.value = '';
    });
  }

  _openSettings(): void {
    const settingsModal = new SettingsModalView(this._modalRoot!, this.store);
    settingsModal.show();
  }

  _triggerImport(): void {
    (this._pageContent!.querySelector('#input-import') as HTMLElement | null)?.click();
  }

  _exportData(): void {
    const payload = this.store.getExportPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'patrimoine_data.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  _importFile(file: File | null): void {
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

  _getDisplayedTotals(): { gross: number; net: number } {
    if (!this._filterTotals || !this._summary) {
      return { gross: this._summary?.totalGross || 0, net: this._summary?.finalNetValue || 0 };
    }
    const filtered = this._assetTableView.getFilteredEvaluations(this._summary.evaluations);
    let totalGross = 0;
    let totalNet = 0;
    for (const { evaluation } of filtered) {
      totalGross += evaluation.grossValue || 0;
      totalNet += evaluation.netValue ?? ((evaluation.netValueBeforeIR ?? 0) - (evaluation.imposition ?? 0));
    }
    return { gross: totalGross, net: totalNet };
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
  }
}
