import { I18n } from '../core/I18n.js';
import { PlacementModalView } from './PlacementModalView.js';

export class AssetTableView {
  constructor(store) {
    this.store = store;
    this.selectedCategory = 'all';
    this.container = null;
    this.summary = null;
    this.modalRoot = null;
  }

  setContainer(container) {
    this.container = container;
  }

  render(summary, modalRoot) {
    this.summary = summary;
    this.modalRoot = modalRoot;
    this.container.innerHTML = `
      <div class="toolbar">
        <div class="filters-bar">
          ${this._renderFilters(summary.categories)}
        </div>
        <button id="btn-add-asset" class="btn-primary">${I18n.t('actions.addAsset')}</button>
      </div>

      <section class="asset-table-container">
        <table class="asset-table">
          <thead>
            <tr>
              <th>${I18n.t('table.assetHeader')}</th>
              <th>${I18n.t('table.categoryHeader')}</th>
              <th style="text-align: right;">${I18n.t('table.grossHeader')}</th>
              <th style="text-align: right;">${I18n.t('table.socialHeader')}</th>
              <th style="text-align: right;">${I18n.t('table.taxHeader')}</th>
              <th style="text-align: right;">${I18n.t('table.netHeader')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${this._renderAssetRows(summary.evaluations)}
          </tbody>
        </table>
      </section>
    `;

    this._bindEvents();
  }

  _renderFilters(availableCategories) {
    const categories = ['all', ...(availableCategories || [])];
    return categories.map(catKey => `
      <button class="filter-btn ${this.selectedCategory === catKey ? 'active' : ''}" data-cat="${catKey}">
        ${catKey === 'all' ? I18n.t('filters.all') : I18n.t(`categories.${catKey}`)}
      </button>
    `).join('');
  }

  _renderAssetRows(evaluations) {
    const filtered = this.selectedCategory === 'all'
      ? evaluations
      : evaluations.filter(e => e.instance.getCategory() === this.selectedCategory);

    if (!filtered || filtered.length === 0) {
      return `<tr><td colspan="7" style="text-align:center;" class="text-muted">Aucun actif trouvé</td></tr>`;
    }

    return filtered.map(({ instance, evaluation }) => {
      const institutionHtml = instance.institution
        ? `<div style="font-size: 0.8rem; color: var(--text-muted);">${this._escapeHtml(instance.institution)}</div>`
        : '';

      return `
      <tr class="asset-row" data-id="${instance.id}">
        <td>
          <div style="font-weight: 600;">${this._escapeHtml(instance.label)}</div>
          ${institutionHtml}
        </td>
        <td><span class="tag-category">${I18n.t(`categories.${instance.getCategory()}`)}</span></td>
        <td style="text-align: right;"><strong>${this._formatCurrency(evaluation.grossValue)}</strong></td>
        <td style="text-align: right;">${this._formatCurrency(evaluation.socialCharges)}</td>
        <td style="text-align: right;">${this._formatCurrency(evaluation.imposition)}</td>
        <td style="text-align: right; color: var(--accent);"><strong>${this._formatCurrency(evaluation.netValueBeforeIR - (evaluation.imposition ?? 0))}</strong></td>
        <td style="text-align: center;">${this._renderFiscalIcon(evaluation)}</td>
      </tr>
    `;
    }).join('');
  }

  _bindEvents() {
    this.container.querySelector('#btn-add-asset')?.addEventListener('click', () => {
      const placementModal = new PlacementModalView(this.modalRoot, this.store);
      placementModal.show();
    });

    this.container.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.selectedCategory = e.currentTarget.dataset.cat;
        this.render(this.summary, this.modalRoot);
      });
    });

    this.container.querySelectorAll('.asset-row').forEach(row => {
      row.addEventListener('click', () => {
        const item = this.summary.evaluations.find(e => e.instance.id === row.dataset.id);
        if (item) {
          const placementModal = new PlacementModalView(this.modalRoot, this.store);
          placementModal.show(item.instance);
        }
      });
    });
  }

  _formatCurrency(amount) {
    if (amount == null || amount === 0) {
      return '';
    }
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  }

  _renderFiscalIcon(evaluation) {
    const netValue = (evaluation.netValueBeforeIR ?? 0) - (evaluation.imposition ?? 0);
    if (evaluation.grossValue === netValue) {
      return '';
    }
    return `<span style="cursor: help; color: var(--text-muted); font-weight: 600;">?</span>`;
  }

  _escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  }
}
