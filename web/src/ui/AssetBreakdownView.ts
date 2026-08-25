import { I18n } from '../core/I18n.js';
import { AssetDonutChartView } from './AssetDonutChartView.js';
import type { GlobalSummary, EvaluationEntry } from '../core/AppStore.js';

interface BreakdownRowData {
  value: number;
  percentage: number;
}

interface AssetBreakdownOptions {
  onClose?: () => void;
}

export class AssetBreakdownView {
  container: HTMLElement | null;
  _useNet: boolean;
  _onClose: () => void;
  _summary: GlobalSummary | null;

  constructor(container: HTMLElement | null, options: AssetBreakdownOptions = {}) {
    this.container = container;
    this._useNet = false;
    this._onClose = options.onClose || (() => {});
    this._summary = null;
  }

  setContainer(container: HTMLElement): void {
    this.container = container;
  }

  render(summary: GlobalSummary): void {
    this._summary = summary;
    const breakdownData = this._getBreakdownData(summary, this._useNet);
    const evaluations: EvaluationEntry[] = summary?.evaluations || [];
    this.container!.className = 'breakdown-group';
    this.container!.innerHTML = `
      <div class="breakdown-header">
        <h3 style="margin: 0;">${I18n.t('summary.breakdownTitle')}</h3>
        <div class="breakdown-switch">
          <span class="breakdown-switch-label">${I18n.t('summary.gross')}</span>
          <label class="breakdown-switch-track">
            <input type="checkbox" data-mode-toggle ${this._useNet ? 'checked' : ''}>
            <span class="breakdown-switch-slider"></span>
          </label>
          <span class="breakdown-switch-label">${I18n.t('summary.net')}</span>
        </div>
        <button class="breakdown-close" type="button" data-action="close">&times;</button>
      </div>
      <div class="breakdown-content">
        <div id="donut-container"></div>
        <div id="breakdown-list">${this._renderRows(breakdownData)}</div>
      </div>
    `;

    const donutChart = new AssetDonutChartView(this.container!.querySelector('#donut-container') as HTMLElement, {
      onHover: (cat) => this._highlightCategory(cat),
      onLeave: () => this._clearHighlight()
    });
    donutChart.render(evaluations, this._useNet ? 'netValue' : 'grossValue');

    this._bindEvents();
  }

  _getBreakdownData(summary: GlobalSummary | null | undefined, useNet: boolean): Record<string, BreakdownRowData> {
    if (!useNet) {
      const data: Record<string, BreakdownRowData> = {};
      for (const [cat, val] of Object.entries(summary?.breakdown || {})) {
        data[cat] = { value: val.gross, percentage: val.percentage };
      }
      return data;
    }

    const netByCat: Record<string, number> = {};
    let total = 0;
    for (const { instance, evaluation } of (summary?.evaluations || [])) {
      const cat = instance.getCategory();
      const value = evaluation.netValue ?? ((evaluation.netValueBeforeIR ?? 0) - (evaluation.imposition ?? 0));
      netByCat[cat] = (netByCat[cat] || 0) + value;
      total += value;
    }

    const data: Record<string, BreakdownRowData> = {};
    for (const [cat, value] of Object.entries(netByCat)) {
      data[cat] = {
        value,
        percentage: total > 0 ? Math.round((value / total) * 10000) / 100 : 0
      };
    }
    return data;
  }

  _renderRows(breakdownData: Record<string, BreakdownRowData> | null | undefined): string {
    return Object.entries(breakdownData || {}).map(([catKey, val]) => `
      <div class="breakdown-row" data-cat="${catKey}">
        <span>${I18n.t(`categories.${catKey}`)}</span>
        <strong>${this._formatCurrency(val.value)} (${this._formatPercentage(val.percentage)}%)</strong>
      </div>
    `).join('');
  }

  _bindEvents(): void {
    const modeToggle = this.container!.querySelector('[data-mode-toggle]') as HTMLInputElement | null;
    modeToggle?.addEventListener('change', () => {
      this._useNet = modeToggle!.checked;
      this.render(this._summary!);
    });

    this.container!.querySelector('[data-action="close"]')?.addEventListener('click', () => {
      this._onClose();
    });
  }

  _highlightCategory(cat: string): void {
    this.container!.querySelectorAll<HTMLElement>('.breakdown-row').forEach(row => {
      row.style.opacity = row.dataset.cat === cat ? '1' : '0.4';
    });
  }

  _clearHighlight(): void {
    this.container!.querySelectorAll<HTMLElement>('.breakdown-row').forEach(row => {
      row.style.opacity = '';
    });
  }

  _formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
  }

  _formatPercentage(value: number): string {
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
  }
}
