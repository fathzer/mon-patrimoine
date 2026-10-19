import { I18n } from '../core/I18n.js';
import { UiState } from '../core/UiState.js';
import { todayString, compareDates } from '../core/DatedHistory.js';
import { EARLIEST_FISCAL_DATE } from '../fiscality/rates.js';
import { bindDatedInput } from './datedInput.js';
import { navInputBar, bindNavInput } from './navInput.js';
import { HelpPopover } from './HelpPopover.js';
import { commentIcon } from './icons.js';
import { INFLATION_SERIES_IDS, INFLATION_SERIES_LABELS, NO_INFLATION_UI_STATE, type InflationUiState } from '../core/inflation.js';
import type { ChartAnnotation } from '../core/AppStore.js';

interface HistoryPanelOptions {
  onClose?: () => void;
  onDateChange?: (date: string | null) => void;
  onInflationSourceChange?: (source: string | null) => void;
  /** Pulls the current inflation UI state from the owner; the panel stays stateless. */
  getInflationState?: () => InflationUiState;
  /** Pulls the chart annotations from the owner. */
  getAnnotations?: () => ChartAnnotation[];
  onAnnotationSave?: (date: string, text: string) => void;
  onAnnotationDelete?: (date: string) => void;
  /** Pulls the sorted navigable dates for the ◀/▶ arrows (recorded
   *  placement points, annotations and today — evaluated lazily). */
  getNavDates?: () => string[];
}

/**
 * History panel: "view as of" date selector and inflation-source selector.
 * The closed-placements toggle lives in the asset table toolbar. The chart
 * area (`#history-chart`) is a placeholder for the step-6 graph.
 *
 * The panel holds no inflation state of its own: it reads it from the owner
 * via `getInflationState` on every render/refresh, so `DashboardView` is the
 * single source of truth.
 */
export class HistoryPanelView {
  container: HTMLElement | null;
  _date: string | null;
  _onClose: () => void;
  _onDateChange: (date: string | null) => void;
  _onInflationSourceChange: (source: string | null) => void;
  _getInflationState: () => InflationUiState;
  _getAnnotations: () => ChartAnnotation[];
  _onAnnotationSave: (date: string, text: string) => void;
  _onAnnotationDelete: (date: string) => void;
  _getNavDates: () => string[];
  /** Re-syncs the ◀/▶ disabled state after programmatic date changes. */
  _refreshNav: (() => void) | null;

  constructor(container: HTMLElement | null, options: HistoryPanelOptions = {}) {
    this.container = container;
    this._date = null;
    this._onClose = options.onClose || (() => {});
    this._onDateChange = options.onDateChange || (() => {});
    this._onInflationSourceChange = options.onInflationSourceChange || (() => {});
    this._getInflationState = options.getInflationState || (() => NO_INFLATION_UI_STATE);
    this._getAnnotations = options.getAnnotations || (() => []);
    this._onAnnotationSave = options.onAnnotationSave || (() => {});
    this._onAnnotationDelete = options.onAnnotationDelete || (() => {});
    this._getNavDates = options.getNavDates || (() => [todayString()]);
    this._refreshNav = null;
  }

  setContainer(container: HTMLElement): void {
    this.container = container;
  }

  /** Sets the selected date and reflects it in the input when rendered. */
  setDate(date: string | null): void {
    this._date = date;
    const input = this.container?.querySelector('#history-date') as HTMLInputElement | null;
    if (input) input.value = date ?? '';
    this._refreshNav?.();
    this._refreshAnnotateBtn();
  }

  /**
   * Reflects the comment state at the current target date on the annotate
   * button: filled icon + the comment text as tooltip when one exists.
   */
  _refreshAnnotateBtn(): void {
    const btn = this.container?.querySelector('#history-annotate') as HTMLButtonElement | null;
    if (!btn) return;
    const existing = this._getAnnotations().find(a => a.date === this._annotationDate());
    btn.innerHTML = commentIcon(!!existing);
    btn.classList.toggle('has-annotation', !!existing);
    btn.title = existing ? existing.text : I18n.t('history.annotateTitle');
  }

  /** Refreshes the inflation selector value from the owner state. */
  refreshInflation(): void {
    const state = this._getInflationState();
    const select = this.container?.querySelector('#inflation-source') as HTMLSelectElement | null;
    if (select) select.value = state.source ?? '';
  }

  /** Resets the controls to the default: no date selected. */
  reset(): void {
    this._date = null;
  }

  render(): void {
    this.container!.className = 'history-panel';
    this.container!.innerHTML = `
      <div class="history-panel-header">
        <h3>${I18n.t('history.title')}</h3>
        <button class="history-panel-close" type="button" data-action="close">&times;</button>
      </div>
      <div class="history-panel-controls">
        ${navInputBar({
          label: I18n.t('history.viewAtDate'),
          prevId: 'history-prev', inputId: 'history-date', nextId: 'history-next',
          inputType: 'date',
          value: this._date ?? '',
          prevTitle: I18n.t('history.prevPoint'), nextTitle: I18n.t('history.nextPoint')
        })}
        <button id="history-annotate" class="history-annotate-btn" type="button" title="${I18n.t('history.annotateTitle')}">${commentIcon()}</button>
        <span class="history-panel-inflation-group">
          <label for="inflation-source">${I18n.t('history.inflationLabel')}</label>
          <select id="inflation-source" class="form-control">
            <option value="">${I18n.t('history.inflationNone')}</option>
            ${INFLATION_SERIES_IDS.map(id => `<option value="${id}">${INFLATION_SERIES_LABELS[id]}</option>`).join('')}
          </select>
          ${HelpPopover.getHtml({
            title: I18n.t('history.inflationHelpTitle'),
            content: () => this._inflationHelpContent(),
            icon: true
          })}
        </span>
      </div>
      <div id="annotation-editor" class="annotation-editor" hidden>
        <span class="annotation-editor-date"></span>
        <input type="text" id="annotation-text" class="form-control" maxlength="200" placeholder="${I18n.t('history.annotationPlaceholder')}" />
        <button type="button" class="btn-primary" data-action="annotation-save">${I18n.t('history.annotationSave')}</button>
        <button type="button" class="btn-danger" data-action="annotation-delete" hidden>${I18n.t('history.annotationDelete')}</button>
        <button type="button" class="btn-secondary" data-action="annotation-cancel">${I18n.t('history.annotationCancel')}</button>
      </div>
      <details id="chart-details" class="variations"${UiState.load().historyChartOpen ? ' open' : ''}>
        <summary class="variations-summary">${I18n.t('history.chartTitle')}
          (<span class="val-gross">${I18n.t('history.varGross')}</span> /
          <span class="val-net">${I18n.t('history.varNet')}</span>)</summary>
        <div id="history-chart"></div>
      </details>
      <div id="history-variations"></div>
    `;

    this._bindEvents();
  }

  /** Builds the popover body: explanation + current display status. */
  _inflationHelpContent(): string {
    const status = this._inflationStatusText();
    return `<p>${I18n.t('history.inflationHelpBody')}</p>` +
      (status ? `<p><em>${status}</em></p>` : '');
  }

  /** Current display status sentence, or '' when no source selected. */
  _inflationStatusText(): string {
    const state = this._getInflationState();
    if (state.error) return I18n.t('history.inflationLoadError');
    if (state.loading) return I18n.t('history.inflationLoading');
    if (state.source && state.baseMonth) {
      return I18n.t('history.inflationBaseMonth', { month: state.baseMonth });
    }
    return '';
  }

  _bindEvents(): void {
    this.container!.querySelector('[data-action="close"]')?.addEventListener('click', () => {
      this._onClose();
    });

    const dateInput = this.container!.querySelector('#history-date') as HTMLInputElement | null;
    // Clearing the field exits the dated view (empty value → null).
    if (dateInput) {
      bindDatedInput(dateInput, EARLIEST_FISCAL_DATE, todayString, (value) => {
        this._date = value || null;
        this._onDateChange(this._date);
        this._refreshNav?.();
        this._refreshAnnotateBtn();
      });

      // ◀/▶ cycle through the recorded dates (placement points, annotations,
      // today). Navigating also moves the annotation editor's target date,
      // which follows `this._date`.
      const prevBtn = this.container!.querySelector('#history-prev') as HTMLButtonElement;
      const nextBtn = this.container!.querySelector('#history-next') as HTMLButtonElement;
      this._refreshNav = bindNavInput<string>(dateInput, prevBtn, nextBtn, {
        getItems: this._getNavDates,
        parse: (raw) => raw || null,
        compare: compareDates,
        onNavigate: (date) => {
          dateInput.value = date;
          this._date = date;
          this._onDateChange(this._date);
          this._refreshNav?.();
          this._refreshAnnotateBtn();
        }
      });
    }
    this._refreshAnnotateBtn();

    const inflationSelect = this.container!.querySelector('#inflation-source') as HTMLSelectElement | null;
    inflationSelect?.addEventListener('change', () => {
      HelpPopover.hide();
      this._onInflationSourceChange(inflationSelect!.value || null);
    });

    // Fold/unfold of the chart block survives re-renders and reloads.
    const chartDetails = this.container!.querySelector<HTMLDetailsElement>('#chart-details');
    chartDetails?.addEventListener('toggle', () => {
      UiState.save({ historyChartOpen: chartDetails.open });
    });

    this.container!.querySelector('#history-annotate')?.addEventListener('click', () => {
      this._openAnnotationEditor();
    });
    const editor = this.container!.querySelector('#annotation-editor') as HTMLElement;
    editor.querySelector('[data-action="annotation-cancel"]')?.addEventListener('click', () => {
      editor.hidden = true;
    });
    editor.querySelector('[data-action="annotation-save"]')?.addEventListener('click', () => {
      const input = editor.querySelector('#annotation-text') as HTMLInputElement;
      this._onAnnotationSave(this._annotationDate(), input.value);
      editor.hidden = true;
      this._refreshAnnotateBtn();
    });
    editor.querySelector('[data-action="annotation-delete"]')?.addEventListener('click', () => {
      this._onAnnotationDelete(this._annotationDate());
      editor.hidden = true;
      this._refreshAnnotateBtn();
    });
  }

  /** Date an annotation targets: the view date, or today when none is set. */
  _annotationDate(): string {
    return this._date ?? todayString();
  }

  /** Opens the inline editor, prefilled with the existing annotation if any. */
  _openAnnotationEditor(): void {
    const editor = this.container!.querySelector('#annotation-editor') as HTMLElement;
    const input = editor.querySelector('#annotation-text') as HTMLInputElement;
    const existing = this._getAnnotations().find(a => a.date === this._annotationDate());
    editor.querySelector('.annotation-editor-date')!.textContent =
      new Date(this._annotationDate() + 'T00:00:00').toLocaleDateString('fr-FR');
    input.value = existing?.text ?? '';
    (editor.querySelector('[data-action="annotation-delete"]') as HTMLElement).hidden = !existing;
    editor.hidden = false;
    input.focus();
  }
}
