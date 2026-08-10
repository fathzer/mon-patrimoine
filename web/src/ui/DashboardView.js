import { I18n } from '../core/I18n.js';
import { HelpModalView } from './HelpModalView.js';
import { SettingsModalView } from './SettingsModalView.js';
import { PlacementModalView } from './PlacementModalView.js';

export class DashboardView {
  constructor(container, store) {
    this.container = container;
    this.store = store;
    this.selectedCategory = 'all';
  }

  showLoading(isLoading) {
    if (isLoading) {
      this.container.innerHTML = `<div class="main-content"><h2>${I18n.t('app.loading')}</h2></div>`;
    }
  }

  render(summary) {
    if (!summary) return;

    if (!summary.isAuthenticated) {
      this._renderAuthScreen();
      return;
    }

    this.container.innerHTML = `
      <header class="top-bar">
        <h1>${I18n.t('app.title')}</h1>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <button id="btn-settings" class="btn-secondary" title="Réglages du profil fiscal" style="padding: 0.5rem 0.8rem; font-size: 1rem;">
            ⚙️
          </button>
          <button id="btn-help" class="btn-secondary" title="Aide et informations" style="padding: 0.5rem 0.8rem; font-size: 1rem;">
            ❓
          </button>
          <button id="btn-logout" class="btn-secondary">${I18n.t('auth.logoutBtn')}</button>
        </div>
      </header>

      <main class="main-content">
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
            <div>${this._renderBreakdownRows(summary.breakdown)}</div>
          </div>
        </section>

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
                <th>${I18n.t('table.grossHeader')}</th>
                <th>${I18n.t('table.netHeader')}</th>
              </tr>
            </thead>
            <tbody>
              ${this._renderAssetRows(summary.evaluations)}
            </tbody>
          </table>
        </section>
      </main>

      <div id="modal-root"></div>
    `;

    this._bindEvents(summary);
  }

  _renderAuthScreen() {
    this.container.innerHTML = `
      <div class="auth-lock-screen">
        <div class="auth-card">
          <h2>${I18n.t('auth.welcomeTitle')}</h2>
          <p class="text-muted" style="margin-bottom: 2rem;">${I18n.t('auth.loginSubtitle')}</p>
          <button id="btn-login" class="btn-primary" style="width:100%; padding: 0.8rem;">
            ${I18n.t('auth.loginBtn')}
          </button>
        </div>
      </div>
    `;

    this.container.querySelector('#btn-login')?.addEventListener('click', () => this.store.login());
  }

  _renderBreakdownRows(breakdown) {
    return Object.entries(breakdown || {}).map(([catKey, val]) => `
      <div class="breakdown-row">
        <span>${I18n.t(`categories.${catKey}`)}</span>
        <strong>${this.formatCurrency(val.gross)} (${val.percentage}%)</strong>
      </div>
    `).join('');
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
      return `<tr><td colspan="4" style="text-align:center;" class="text-muted">Aucun actif trouvé</td></tr>`;
    }

    return filtered.map(({ instance, evaluation }) => {
      const institutionHtml = instance.institution
        ? `<div style="font-size: 0.8rem; color: var(--text-muted);">${this.escapeHtml(instance.institution)}</div>`
        : '';

      return `
      <tr class="asset-row" data-id="${instance.id}">
        <td>
          <div style="font-weight: 600;">${this.escapeHtml(instance.label)}</div>
          ${institutionHtml}
        </td>
        <td><span class="tag-category">${I18n.t(`categories.${instance.getCategory()}`)}</span></td>
        <td><strong>${this.formatCurrency(evaluation.grossValue)}</strong></td>
        <td style="color: var(--accent);"><strong>${this.formatCurrency(evaluation.netValueBeforeIR)}</strong></td>
      </tr>
    `;
    }).join('');
  }

  _bindEvents(summary) {
    this.container.querySelector('#btn-logout')?.addEventListener('click', () => this.store.logout());

    // Clic Réglages
    this.container.querySelector('#btn-settings')?.addEventListener('click', () => {
      const modalRoot = this.container.querySelector('#modal-root');
      const settingsModal = new SettingsModalView(modalRoot, this.store);
      settingsModal.show();
    });

    this.container.querySelector('#btn-help')?.addEventListener('click', () => {
      const modalRoot = this.container.querySelector('#modal-root');
      const helpModal = new HelpModalView(modalRoot);
      helpModal.show();
    });

    this.container.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.selectedCategory = e.currentTarget.dataset.cat;
        this.render(summary);
      });
    });

    this.container.querySelector('#btn-add-asset')?.addEventListener('click', () => {
      this._showAssetModal();
    });

    this.container.querySelectorAll('.asset-row').forEach(row => {
      row.addEventListener('click', () => {
        const item = summary.evaluations.find(e => e.instance.id === row.dataset.id);
        if (item) this._showAssetModal(item.instance);
      });
    });
  }

  _showAssetModal(placement = null) {
    const modalRoot = this.container.querySelector('#modal-root');
    const placementModal = new PlacementModalView(modalRoot, this.store);
    placementModal.show(placement);
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
  }

  escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  }
}
