import { I18n } from '../core/I18n.js';
import { UiState } from '../core/UiState.js';
import { todayString, sortedUniqueDates } from '../core/DatedHistory.js';
import { TopBarView } from './TopBarView.js';
import { SettingsModalView } from './SettingsModalView.js';
import { ToggleSwitch } from './ToggleSwitch.js';
import { AssetBreakdownView } from './AssetBreakdownView.js';
import { AssetTableView } from './AssetTableView.js';
import { HistoryPanelView } from './HistoryPanelView.js';
import { collectChartDates, HistoryChartView, type ChartPoint } from './HistoryChartView.js';
import { HistoryVariationsView } from './HistoryVariationsView.js';
import { getWarning } from '../i18n/commonTaxExplanations.js';
import { authFailureExplanation } from '../storage/AuthFailure.js';
import { getInflationDisplayBanner } from './inflationBanner.js';
import { getCachedInflationIndex, loadInflationIndex, NO_INFLATION_UI_STATE, type InflationIndex, type InflationUiState } from '../core/inflation.js';
import type { AppStore, GlobalSummary } from '../core/AppStore.js';

export class DashboardView {
  container: HTMLElement;
  store: AppStore;
  _assetTableView: AssetTableView;
  _breakdownView: AssetBreakdownView;
  _historyPanelView: HistoryPanelView;
  _historyChartView: HistoryChartView;
  _variationsView: HistoryVariationsView;
  _summary: GlobalSummary | null;
  _filterTotals: boolean;
  _breakdownVisible: boolean;
  _historyVisible: boolean;
  _showClosedPlacements: boolean;
  _historyDate: string | null;
  _inflation: InflationUiState;
  _inflationIndex: InflationIndex | null;
  _layoutInitialized: boolean;
  _topBarContainer: HTMLElement | null;
  _pageContent: HTMLElement | null;
  _modalRoot: HTMLElement | null;
  _topBarView: TopBarView;
  /** Set once the mandatory tax-profile onboarding has been opened — render()
   *  fires on every state:changed and must not stack modals. */
  _mandatoryProfileOpen: boolean;
  /** Set when a ?connect OAuth attempt failed — the connecting card then
   *  explains how to retry instead of staying on the "waiting" text. */
  _connectFailed: boolean;

  constructor(container: HTMLElement, store: AppStore) {
    this.container = container;
    this.store = store;
    this._assetTableView = new AssetTableView(store, { onFiltersChanged: () => this._renderSummary() });
    this._breakdownView = new AssetBreakdownView(null, { onClose: () => this._hideBreakdown() });
    this._summary = null;
    const ui = UiState.load();
    this._filterTotals = ui.filterTotals;
    this._breakdownVisible = ui.breakdownVisible;
    this._historyVisible = ui.historyVisible;
    this._showClosedPlacements = ui.showClosedPlacements;
    this._historyDate = null;
    this._inflation = { ...NO_INFLATION_UI_STATE, source: ui.inflationSource };
    this._inflationIndex = this._inflation.source ? getCachedInflationIndex(this._inflation.source) : null;
    this._historyPanelView = new HistoryPanelView(null, {
      onClose: () => this._hideHistory(),
      onDateChange: (date) => this._onHistoryDateChange(date),
      onInflationSourceChange: (source) => this._onInflationSourceChange(source),
      getInflationState: () => this._inflation,
      getAnnotations: () => this.store.state.annotations,
      onAnnotationSave: (date, text) => this.store.setAnnotation(date, text),
      onAnnotationDelete: (date) => this.store.removeAnnotation(date),
      getNavDates: () => this._navigableDates()
    });
    this._historyChartView = new HistoryChartView({ onPickDate: (date) => this._onChartDatePick(date) });
    this._variationsView = new HistoryVariationsView();
    this._layoutInitialized = false;
    this._mandatoryProfileOpen = false;
    this._connectFailed = false;
    this._topBarContainer = null;
    this._pageContent = null;
    this._modalRoot = null;
    this._topBarView = new TopBarView(store, {
      onShowBreakdown: () => this._showBreakdown(),
      onShowHistory: () => this._showHistory(),
      onExport: () => this._exportData(),
      onImportClick: () => this._triggerImport(),
      onSettings: () => this._openSettings()
    });
  }

  _initLayout(): void {
    this.container.innerHTML = `
      <div id="demo-banner" class="demo-banner" hidden>${I18n.t('demo.banner')}</div>
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

    this.container.querySelector<HTMLElement>('#demo-banner')!.hidden =
      !summary.isAuthenticated || !this.store.storageManager.currentProvider.isReadOnly();

    this._topBarView.render(summary.isAuthenticated, this._breakdownVisible, this._historyVisible);

    if (!summary.isAuthenticated) {
      this._renderConnectingCard();
      return;
    }

    this._summary = summary;
    this._pageContent!.innerHTML = `
      <input type="file" id="input-import" accept=".json,application/json" style="display: none;" />

      <section id="summary-history" class="summary-history"></section>
      <section id="summary-totals" class="summary-totals"></section>
      <section id="summary-breakdown" class="summary-breakdown"></section>
      <div id="assets-container"></div>
    `;

    this._renderSummary();

    this._assetTableView.setContainer(this._pageContent!.querySelector('#assets-container') as HTMLElement);
    this._renderAssetTable();

    this._bindAuthenticatedEvents();

    // First-run onboarding: the file carries no tax profile yet — the
    // mandatory settings form blocks the dashboard until it is saved once.
    if (!this.store.state.profileConfigured && !this._mandatoryProfileOpen) {
      this._mandatoryProfileOpen = true;
      new SettingsModalView(this._modalRoot!, this.store).show(undefined, true);
    }
  }

  /** Shown while the OAuth flow launched by ?connect is in flight — the
   *  landing page is the only place with real connect/demo buttons. */
  _renderConnectingCard(): void {
    this._pageContent!.innerHTML = `
      <div class="auth-card">
        <div class="landing-login">
          <p class="text-muted">${I18n.t('auth.waiting')}</p>
        </div>
        ${this._connectFailed ? getWarning(`
          <p><strong>${I18n.t('auth.connectFailed')}</strong></p>
          ${authFailureExplanation(this.store.storageManager.currentProvider.getAuthFailure())}
          <p>${I18n.t('auth.connectRetry')}</p>
        `) : ''}
      </div>
    `;
  }

  /** A ?connect attempt ended unauthenticated (blocked/closed popup or
   *  error): the card switches from "waiting" to the retry instructions. */
  showConnectFailed(): void {
    this._connectFailed = true;
    if (this._pageContent) this._renderConnectingCard();
  }

  _renderAssetTable(): void {
    // Rows of placements recorded at the viewed date get the tint marker.
    this._assetTableView.setViewDate(this._historyDate);
    this._assetTableView.render(
      this._viewSummary(),
      this._modalRoot!,
      this._showClosedPlacements,
      (showClosed) => this._onShowClosedChange(showClosed)
    );
  }

  _renderSummary(): void {
    this._renderTotals();
    this._renderBreakdown();
    this._renderHistoryPanel();
  }

  _renderTotals(): void {
    const totals = this._pageContent!.querySelector('#summary-totals') as HTMLElement | null;
    if (!totals) return;

    const view = this._viewSummary();
    const displayed = this._getDisplayedTotals(view);

    totals.innerHTML = `
      ${(view.priceLevelFactor ?? 1) !== 1 ? `<div class="inflation-banner">${getInflationDisplayBanner(view.priceLevelBaseMonth!)}</div>` : ''}
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
      this._renderTotals();
      this._renderHistoryChart();
    });
  }

  _renderBreakdown(): void {
    const breakdown = this._pageContent!.querySelector('#summary-breakdown') as HTMLElement | null;
    if (!breakdown) return;

    if (this._breakdownVisible) {
      breakdown.style.display = 'block';
      const view = this._viewSummary();
      const inflationBanner = (view.priceLevelFactor ?? 1) !== 1 ? `<div class="inflation-banner">${getInflationDisplayBanner(view.priceLevelBaseMonth!)}</div>` : '';
      breakdown.innerHTML = `${inflationBanner}<div id="breakdown-container"></div>`;
      this._breakdownView.setContainer(breakdown.querySelector('#breakdown-container') as HTMLElement);
      this._breakdownView.render(view);
    } else {
      breakdown.style.display = 'none';
      breakdown.innerHTML = '';
    }
  }

  _renderHistoryPanel(): void {
    const history = this._pageContent!.querySelector('#summary-history') as HTMLElement | null;
    if (!history) return;

    if (this._historyVisible) {
      history.style.display = 'block';
      history.innerHTML = '<div id="history-container"></div>';
      this._historyPanelView.setContainer(history.querySelector('#history-container') as HTMLElement);
      this._historyPanelView.render();
      this._syncInflationSelector();
      this._ensureInflationIndexLoaded();
      this._renderHistoryChart();
    } else {
      history.style.display = 'none';
      history.innerHTML = '';
    }
  }

  /**
   * Recomputes the gross/net series over the full history and renders the
   * SVG chart. Follows the summary's placements (filters apply when "filter
   * totals" is on) and the same per-date display factor when an inflation
   * series is selected.
   */
  _renderHistoryChart(): void {
    const chart = this._pageContent?.querySelector('#history-chart') as HTMLElement | null;
    if (!this._historyVisible || !chart) return;
    const placements = this._filterTotals
      ? this.store.state.placements.filter(p => this._assetTableView.matchesFilters(p))
      : this.store.state.placements;
    // With an inflation index the display factor changes monthly: the
    // chart samples every month-start so the curve steps there instead
    // of accumulating the drift into a jump at the next recorded point.
    const dates = collectChartDates(placements, todayString(), this._inflationIndex != null);
    const nominal: ChartPoint[] = this.store.getValueSeries(dates, placements);
    const index = this._inflationIndex;
    const points = index
      ? nominal.map(p => {
          const f = index.factorFor(p.date);
          return { date: p.date, gross: p.gross * f, net: p.net * f };
        })
      : nominal;
    this._historyChartView.render(chart, points, this._historyDate, this.store.state.annotations);
    const variations = this._pageContent?.querySelector('#history-variations') as HTMLElement | null;
    if (variations) this._variationsView.render(variations, nominal, index);
  }

  /** A click on the chart picks the clicked date into the history date field. */
  _onChartDatePick(date: string): void {
    this._historyPanelView.setDate(date);
    this._onHistoryDateChange(date);
  }

  _hideBreakdown(): void {
    this._breakdownVisible = false;
    UiState.save({ breakdownVisible: false });
    this._renderSummary();
    this._topBarView.render(true, this._breakdownVisible, this._historyVisible);
  }

  _showBreakdown(): void {
    this._breakdownVisible = true;
    UiState.save({ breakdownVisible: true });
    this._renderSummary();
    this._topBarView.render(true, this._breakdownVisible, this._historyVisible);
  }

  _hideHistory(): void {
    this._historyVisible = false;
    // Closing the panel returns to the current view. The closed-placements
    // toggle lives in the asset table and stays untouched.
    this._historyPanelView.reset();
    this._historyDate = null;
    UiState.save({ historyVisible: false });
    this._renderSummary();
    this._topBarView.render(true, this._breakdownVisible, this._historyVisible);
    this._renderAssetTable();
  }

  _showHistory(): void {
    this._historyVisible = true;
    UiState.save({ historyVisible: true });
    this._renderSummary();
    this._topBarView.render(true, this._breakdownVisible, this._historyVisible);
  }

  /**
   * The summary actually displayed: reconstructed at `_historyDate` when the
   * user picked one; the emitted current summary otherwise. The closed
   * toggle only controls the asset table's grayed rows, not the summary.
   * A presentation-only `priceLevelFactor` is attached when an inflation
   * series is selected — it never alters the underlying nominal values.
   */
  _viewSummary(): GlobalSummary {
    const base = this._historyDate == null ? this._summary! : this.store.getSummaryAt(this._historyDate);
    if (!this._inflationIndex) return base;
    const refDate = base.asOfDate ?? todayString();
    return {
      ...base,
      priceLevelFactor: this._inflationIndex.factorFor(refDate),
      priceLevelBaseMonth: this._inflationIndex.latestMonth
    };
  }

  /** Loads the selected inflation series lazily; re-renders once available. */
  _ensureInflationIndexLoaded(): void {
    const source = this._inflation.source;
    if (!source || this._inflationIndex || this._inflation.loading) return;
    this._inflation = { ...this._inflation, loading: true };
    this._syncInflationSelector();
    loadInflationIndex(source)
      .then(idx => {
        this._inflationIndex = idx;
        this._inflation = {
          ...this._inflation,
          loading: false,
          error: !idx,
          baseMonth: idx?.latestMonth ?? null
        };
        this._syncInflationSelector();
        this._renderSummary();
        this._renderAssetTable();
      })
      .catch(() => {
        this._inflationIndex = null;
        this._inflation = { ...this._inflation, loading: false, error: true };
        this._syncInflationSelector();
      });
  }

  /** Reflects the current inflation loading state into the panel selector. */
  _syncInflationSelector(): void {
    this._historyPanelView.refreshInflation();
  }

  _onInflationSourceChange(source: string | null): void {
    UiState.save({ inflationSource: source });
    this._inflationIndex = source ? getCachedInflationIndex(source) : null;
    this._inflation = {
      source,
      baseMonth: this._inflationIndex?.latestMonth ?? null,
      loading: false,
      error: false
    };
    this._syncInflationSelector();
    this._renderSummary();
    this._renderAssetTable();
    this._ensureInflationIndexLoaded();
  }

  /**
   * Dates the history ◀/▶ arrows cycle through: every recorded point of the
   * placements matching the active category/institution filters (asOf,
   * history entries and closure dates), every annotation, and today —
   * filtered-out placements leave no navigable trace.
   */
  _navigableDates(): string[] {
    const placements = this.store.state.placements.filter(p => this._assetTableView.matchesFilters(p));
    return sortedUniqueDates(
      todayString(),
      this.store.state.annotations.map(a => a.date),
      ...placements.flatMap(p => [p.getHistoryDates(), p.closedAt])
    );
  }

  _onHistoryDateChange(date: string | null): void {
    if (!this._summary) return;
    // Picking today means the current view — keep no history date at all.
    this._historyDate = date === todayString() ? null : date;
    // No history-panel re-render: the date input keeps the focus.
    this._historyChartView.setSelectedDate(date);
    this._renderTotals();
    this._renderBreakdown();
    this._renderAssetTable();
  }

  _onShowClosedChange(showClosed: boolean): void {
    this._showClosedPlacements = showClosed;
    UiState.save({ showClosedPlacements: showClosed });
    if (!this._summary) return;
    this._renderAssetTable();
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
    // In history mode the settings open on the viewed income year.
    settingsModal.show(this._historyDate ? Number.parseInt(this._historyDate.slice(0, 4), 10) : undefined);
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
          this._assetTableView.resetFilters();
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

  _getDisplayedTotals(view: GlobalSummary = this._viewSummary()): { gross: number; net: number } {
    const factor = view.priceLevelFactor ?? 1;
    if (!this._filterTotals) {
      return { gross: (view.totalGross || 0) * factor, net: (view.finalNetValue || 0) * factor };
    }
    const filtered = this._assetTableView.getFilteredEvaluations(view.evaluations);
    let totalGross = 0;
    let totalNet = 0;
    for (const { evaluation } of filtered) {
      totalGross += evaluation.grossValue || 0;
      totalNet += evaluation.netValue ?? ((evaluation.netValueBeforeIR ?? 0) - (evaluation.imposition ?? 0));
    }
    return { gross: totalGross * factor, net: totalNet * factor };
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
  }
}
