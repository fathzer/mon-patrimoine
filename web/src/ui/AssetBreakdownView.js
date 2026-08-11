import { I18n } from '../core/I18n.js';
import { AssetDonutChartView } from './AssetDonutChartView.js';

export class AssetBreakdownView {
  constructor(container) {
    this.container = container;
    this._useNet = false;
    this._summary = null;
  }

  setContainer(container) {
    this.container = container;
  }

  render(summary) {
    this._summary = summary;
    const breakdownData = this._getBreakdownData(summary, this._useNet);
    const evaluations = summary?.evaluations || [];
    this.container.className = 'breakdown-group';
    this.container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3 style="margin: 0;">${I18n.t('summary.breakdownTitle')}</h3>
        <div class="filters-bar">
          <button class="filter-btn ${!this._useNet ? 'active' : ''}" data-mode="gross">${I18n.t('summary.gross')}</button>
          <button class="filter-btn ${this._useNet ? 'active' : ''}" data-mode="net">${I18n.t('summary.net')}</button>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 150px 1fr; gap: 1.5rem; align-items: center;">
        <div id="donut-container"></div>
        <div id="breakdown-list">${this._renderRows(breakdownData)}</div>
      </div>
    `;

    const donutChart = new AssetDonutChartView(this.container.querySelector('#donut-container'), {
      onHover: (cat) => this._highlightCategory(cat),
      onLeave: () => this._clearHighlight()
    });
    donutChart.render(evaluations, this._useNet ? 'netValueBeforeIR' : 'grossValue');

    this.container.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._useNet = btn.dataset.mode === 'net';
        this.render(this._summary);
      });
    });
  }

  _getBreakdownData(summary, useNet) {
    if (!useNet) {
      const data = {};
      for (const [cat, val] of Object.entries(summary?.breakdown || {})) {
        data[cat] = { value: val.gross, percentage: val.percentage };
      }
      return data;
    }

    const netByCat = {};
    let total = 0;
    for (const { instance, evaluation } of (summary?.evaluations || [])) {
      const cat = instance.getCategory();
      const value = evaluation.netValueBeforeIR || 0;
      netByCat[cat] = (netByCat[cat] || 0) + value;
      total += value;
    }

    const data = {};
    for (const [cat, value] of Object.entries(netByCat)) {
      data[cat] = {
        value,
        percentage: total > 0 ? Math.round((value / total) * 100) : 0
      };
    }
    return data;
  }

  _renderRows(breakdownData) {
    return Object.entries(breakdownData || {}).map(([catKey, val]) => `
      <div class="breakdown-row" data-cat="${catKey}">
        <span>${I18n.t(`categories.${catKey}`)}</span>
        <strong>${this._formatCurrency(val.value)} (${val.percentage}%)</strong>
      </div>
    `).join('');
  }

  _highlightCategory(cat) {
    this.container.querySelectorAll('.breakdown-row').forEach(row => {
      row.style.opacity = row.dataset.cat === cat ? '1' : '0.4';
    });
  }

  _clearHighlight() {
    this.container.querySelectorAll('.breakdown-row').forEach(row => {
      row.style.opacity = '';
    });
  }

  _formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
  }
}
