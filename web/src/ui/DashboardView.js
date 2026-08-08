import { I18n } from '../core/I18n.js';

export class DashboardView {
  constructor(container, store) {
    this.container = container;
    this.store = store;
    this.selectedCategory = 'all';
    this.activeModal = null;
  }

  showLoading(isLoading) {
    if (isLoading) {
      this.container.innerHTML = `<div class="main-content"><h2>${I18n.t('app.loading')}</h2></div>`;
    }
  }

  async render(summary) {
    if (!summary) return;

    const cloudStatus = await this.store.storageManager.getStatus();

    this.container.innerHTML = `
      <header class="top-bar">
        <h1>${I18n.t('app.title')}</h1>
        <div class="cloud-status">
          <span class="text-muted">
            ${cloudStatus.isConnected 
              ? I18n.t('cloud.statusConnected', { provider: cloudStatus.providerName })
              : I18n.t('cloud.statusDisconnected')}
          </span>
          <button id="btn-cloud-toggle" class="btn-cloud">
            ${cloudStatus.isConnected ? I18n.t('cloud.disconnectBtn') : I18n.t('cloud.connectBtn')}
          </button>
        </div>
      </header>

      <main class="main-content">
        <!-- Bandeau de synthèse Finary -->
        <section class="summary-banner">
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

          <div class="breakdown-group">
            <h3>${I18n.t('summary.breakdownTitle')}</h3>
            <div class="breakdown-bars">
              ${this._renderBreakdownRows(summary.breakdown)}
            </div>
          </div>
        </section>

        <!-- Filtres par catégorie -->
        <nav class="filters-bar" id="filters-bar">
          ${this._renderFilters(summary.categories)}
        </nav>

        <!-- Vue en Liste -->
        <section class="asset-table-container">
          <table class="asset-table">
            <thead>
              <tr>
                <th>${I18n.t('table.assetHeader')}</th>
                <th>${I18n.t('table.categoryHeader')}</th>
                <th>${I18n.t('table.grossHeader')}</th>
                <th>${I18n.t('table.netHeader')}</th>
              </tr>
            </thead>
            <tbody id="asset-rows">
              ${this._renderAssetRows(summary.evaluations)}
            </tbody>
          </table>
        </section>
      </main>

      <div id="modal-root"></div>
    `;

    this._bindEvents(summary);
  }

  _renderBreakdownRows(breakdown) {
    return Object.entries(breakdown).map(([catKey, val]) => `
      <div class="breakdown-row">
        <div class="breakdown-info">
          <span>${I18n.t(`categories.${catKey}`)}</span>
          <strong>${this.formatCurrency(val.gross)} (${val.percentage}%)</strong>
        </div>
      </div>
    `).join('');
  }

  _renderFilters(availableCategories) {
    const categories = ['all', ...availableCategories];
    return categories.map(catKey => `
      <button class="filter-btn ${this.selectedCategory === catKey ? 'active' : ''}" data-cat="${catKey}">
        ${I18n.t(`categories.${catKey}`)}
      </button>
    `).join('');
  }

  _renderAssetRows(evaluations) {
    const filtered = this.selectedCategory === 'all'
      ? evaluations
      : evaluations.filter(e => e.instance.category === this.selectedCategory);

    return filtered.map(({ instance, evaluation }) => `
      <tr class="asset-row" data-id="${instance.id}">
        <td>
          <div class="asset-title">${this.escapeHtml(instance.label)}</div>
          <div class="asset-institution">${this.escapeHtml(instance.institution)}</div>
        </td>
        <td>
          <span class="tag-category">${I18n.t(`categories.${instance.category}`)}</span>
        </td>
        <td><strong>${this.formatCurrency(evaluation.grossValue)}</strong></td>
        <td style="color: var(--accent);"><strong>${this.formatCurrency(evaluation.netValueBeforeIR)}</strong></td>
      </tr>
    `).join('');
  }

  _bindEvents(summary) {
    // Bouton Cloud
    this.container.querySelector('#btn-cloud-toggle')?.addEventListener('click', async () => {
      const status = await this.store.storageManager.getStatus();
      if (status.isConnected) {
        await this.store.storageManager.disconnectCurrent();
      } else {
        await this.store.storageManager.authenticateCurrent();
      }
      this.store.init();
    });

    // Filtres
    this.container.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.selectedCategory = e.currentTarget.dataset.cat;
        this.render(summary);
      });
    });

    // Clic sur ligne d'actif -> Détail Modal
    this.container.querySelectorAll('.asset-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.dataset.id;
        const item = summary.evaluations.find(e => e.instance.id === id);
        if (item) this._showModal(item);
      });
    });
  }

  _showModal({ instance, evaluation }) {
    const modalRoot = this.container.querySelector('#modal-root');
    modalRoot.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <h2>${I18n.t('modal.detailsTitle')} - ${this.escapeHtml(instance.label)}</h2>
          <p><strong>Institution :</strong> ${this.escapeHtml(instance.institution)}</p>
          <p><strong>Valeur Brute :</strong> ${this.formatCurrency(evaluation.grossValue)}</p>
          <p><strong>Valeur Nette :</strong> ${this.formatCurrency(evaluation.netValueBeforeIR)}</p>
          ${evaluation.latentGain ? `<p><strong>${I18n.t('modal.latentGain')} :</strong> ${this.formatCurrency(evaluation.latentGain)}</p>` : ''}
          ${evaluation.socialCharges ? `<p><strong>${I18n.t('modal.socialChargesDeducted')} :</strong> -${this.formatCurrency(evaluation.socialCharges)}</p>` : ''}
          
          <button id="close-modal" class="btn-cloud" style="margin-top: 1.5rem;">${I18n.t('modal.closeBtn')}</button>
        </div>
      </div>
    `;

    modalRoot.querySelector('#close-modal').addEventListener('click', () => {
      modalRoot.innerHTML = '';
    });
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
  }

  escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  }
}
