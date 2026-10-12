import { I18n } from '../core/I18n.js';
import { todayString } from '../core/DatedHistory.js';
import { EARLIEST_FISCAL_DATE } from '../fiscality/rates.js';
import { ToggleSwitch } from './ToggleSwitch.js';

interface HistoryPanelOptions {
  onClose?: () => void;
  onDateChange?: (date: string | null) => void;
  onShowClosedChange?: (showClosed: boolean) => void;
  initialShowClosed?: boolean;
}

/**
 * History panel: date selector ("view as of") and closed-placements toggle.
 * The chart area (`#history-chart`) is a placeholder for the step-5 graph.
 */
export class HistoryPanelView {
  container: HTMLElement | null;
  _date: string | null;
  _showClosed: boolean;
  _onClose: () => void;
  _onDateChange: (date: string | null) => void;
  _onShowClosedChange: (showClosed: boolean) => void;

  constructor(container: HTMLElement | null, options: HistoryPanelOptions = {}) {
    this.container = container;
    this._date = null;
    this._showClosed = options.initialShowClosed ?? false;
    this._onClose = options.onClose || (() => {});
    this._onDateChange = options.onDateChange || (() => {});
    this._onShowClosedChange = options.onShowClosedChange || (() => {});
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

  /** Resets the controls to their defaults: no date selected, closed hidden. */
  reset(): void {
    this._date = null;
    this._showClosed = false;
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
        ${ToggleSwitch.create({
          name: 'history-show-closed',
          id: 'history-show-closed',
          label: I18n.t('history.showClosed'),
          checked: this._showClosed
        })}
      </div>
      <div id="history-chart"></div>
    `;

    this._bindEvents();
  }

  _bindEvents(): void {
    this.container!.querySelector('[data-action="close"]')?.addEventListener('click', () => {
      this._onClose();
    });

    const dateInput = this.container!.querySelector('#history-date') as HTMLInputElement | null;
    dateInput?.addEventListener('change', () => {
      // No min/max attributes: they clamp mid-typing in segmented inputs,
      // which makes the year untypable. Bounds are enforced on commit.
      if (dateInput!.value && dateInput!.value < EARLIEST_FISCAL_DATE) dateInput!.value = EARLIEST_FISCAL_DATE;
      if (dateInput!.value && dateInput!.value > todayString()) dateInput!.value = todayString();
      this._date = dateInput!.value || null;
      this._onDateChange(this._date);
    });

    const closedToggle = this.container!.querySelector('input[name="history-show-closed"]') as HTMLInputElement | null;
    closedToggle?.addEventListener('change', () => {
      this._showClosed = closedToggle!.checked;
      this._onShowClosedChange(this._showClosed);
    });
  }
}
