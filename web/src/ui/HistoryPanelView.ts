import { I18n } from '../core/I18n.js';
import { todayString } from '../core/DatedHistory.js';
import { EARLIEST_FISCAL_DATE } from '../fiscality/rates.js';
import { bindDatedInput } from './datedInput.js';
import { HelpPopover } from './HelpPopover.js';
import { INFLATION_SERIES_IDS, INFLATION_SERIES_LABELS, NO_INFLATION_UI_STATE, type InflationUiState } from '../core/inflation.js';

interface HistoryPanelOptions {
  onClose?: () => void;
  onDateChange?: (date: string | null) => void;
  onInflationSourceChange?: (source: string | null) => void;
  /** Pulls the current inflation UI state from the owner; the panel stays stateless. */
  getInflationState?: () => InflationUiState;
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

  constructor(container: HTMLElement | null, options: HistoryPanelOptions = {}) {
    this.container = container;
    this._date = null;
    this._onClose = options.onClose || (() => {});
    this._onDateChange = options.onDateChange || (() => {});
    this._onInflationSourceChange = options.onInflationSourceChange || (() => {});
    this._getInflationState = options.getInflationState || (() => NO_INFLATION_UI_STATE);
  }

  setContainer(container: HTMLElement): void {
    this.container = container;
  }

  /** Sets the selected date and reflects it in the input when rendered. */
  setDate(date: string | null): void {
    this._date = date;
    const input = this.container?.querySelector('#history-date') as HTMLInputElement | null;
    if (input) input.value = date ?? '';
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
        <label for="history-date">${I18n.t('history.viewAtDate')}</label>
        <input type="date" id="history-date" class="form-control" value="${this._date ?? ''}" />
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
      <div id="history-chart"></div>
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
      });
    }

    const inflationSelect = this.container!.querySelector('#inflation-source') as HTMLSelectElement | null;
    inflationSelect?.addEventListener('change', () => {
      HelpPopover.hide();
      this._onInflationSourceChange(inflationSelect!.value || null);
    });
  }
}
