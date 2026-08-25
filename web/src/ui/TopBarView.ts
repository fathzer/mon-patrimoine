import { I18n } from '../core/I18n.js';
import { HelpModalView } from './HelpModalView.js';
import type { AppStore } from '../core/AppStore.js';

interface TopBarCallbacks {
  onShowBreakdown?: () => void;
  onExport?: () => void;
  onImportClick?: () => void;
  onSettings?: () => void;
}

export class TopBarView {
  store: AppStore;
  _callbacks: TopBarCallbacks;
  _container: HTMLElement | null;
  _modalRoot: HTMLElement | null;
  _breakdownVisible: boolean;

  constructor(store: AppStore, callbacks: TopBarCallbacks = {}) {
    this.store = store;
    this._callbacks = callbacks;
    this._container = null;
    this._modalRoot = null;
    this._breakdownVisible = false;
  }

  setContainer(container: HTMLElement): void {
    this._container = container;
  }

  setModalRoot(modalRoot: HTMLElement): void {
    this._modalRoot = modalRoot;
  }

  render(isAuthenticated: boolean, breakdownVisible: boolean = false): void {
    this._breakdownVisible = breakdownVisible;
    if (!this._container) return;

    this._container.innerHTML = `
      <h1>
        <img src="favicon.svg" alt="" class="top-bar-logo">
        <span class="top-bar-title">${I18n.t('app.title')}</span>
      </h1>
      <div style="display: flex; gap: 0.5rem; align-items: center;">
        ${isAuthenticated ? this._getAuthButtons() : this._getUnauthButtons()}
      </div>
    `;

    this._bindEvents();
  }

  _getAuthButtons(): string {
    return `
      <button id="btn-show-breakdown" class="btn-secondary" title="${I18n.t('summary.breakdownTitle')}" style="padding: 0.5rem 0.8rem; display: ${this._breakdownVisible ? 'none' : 'inline-flex'}; align-items: center; justify-content: center;">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="var(--accent)" stroke-width="2" fill="none"/>
          <path d="M12 12 L12 3 A9 9 0 0 1 21 12 Z" fill="var(--accent)"/>
        </svg>
      </button>
      <button id="btn-import" class="btn-secondary" title="${I18n.t('actions.import')}" style="padding: 0.5rem 0.8rem; font-size: 1rem;">
        📥
      </button>
      <button id="btn-export" class="btn-secondary" title="${I18n.t('actions.export')}" style="padding: 0.5rem 0.8rem; font-size: 1rem;">
        📤
      </button>
      <button id="btn-settings" class="btn-secondary" title="Réglages du profil fiscal" style="padding: 0.5rem 0.8rem; font-size: 1rem;">
        ⚙️
      </button>
      <button id="btn-help" class="btn-secondary" title="Aide et informations" style="padding: 0.5rem 0.8rem; display: flex; align-items: center; justify-content: center;">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="var(--accent)" stroke-width="2" fill="none"/>
          <text x="12" y="12" text-anchor="middle" dominant-baseline="central" fill="var(--accent)" font-size="13" font-family="Inter, sans-serif">?</text>
        </svg>
      </button>
      <button id="btn-logout" class="btn-secondary" title="${I18n.t('auth.logoutBtn')}" style="padding: 0.5rem; display: flex; align-items: center; justify-content: center;">
        <span class="logout-icon" aria-hidden="true"></span>
      </button>
    `;
  }

  _getUnauthButtons(): string {
    return `
      <button id="btn-help" class="btn-secondary" title="Aide et informations" style="padding: 0.5rem 0.8rem; display: flex; align-items: center; justify-content: center;">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="var(--accent)" stroke-width="2" fill="none"/>
          <text x="12" y="12" text-anchor="middle" dominant-baseline="central" fill="var(--accent)" font-size="13" font-family="Inter, sans-serif">?</text>
        </svg>
      </button>
      <button id="btn-top-login" class="btn-primary" title="${I18n.t('auth.loginBtn')}" style="padding: 0.5rem; display: flex; align-items: center; justify-content: center;">
        <span class="login-icon" aria-hidden="true"></span>
      </button>
    `;
  }

  _bindEvents(): void {
    this._container!.querySelector('#btn-top-login')?.addEventListener('click', () => this.store.login());
    this._container!.querySelector('#btn-logout')?.addEventListener('click', () => this.store.logout());

    this._container!.querySelector('#btn-help')?.addEventListener('click', () => {
      if (this._modalRoot) {
        const helpModal = new HelpModalView(this._modalRoot);
        helpModal.show();
      }
    });

    this._container!.querySelector('#btn-show-breakdown')?.addEventListener('click', () => this._callbacks.onShowBreakdown?.());
    this._container!.querySelector('#btn-export')?.addEventListener('click', () => this._callbacks.onExport?.());
    this._container!.querySelector('#btn-import')?.addEventListener('click', () => this._callbacks.onImportClick?.());
    this._container!.querySelector('#btn-settings')?.addEventListener('click', () => this._callbacks.onSettings?.());
  }
}
