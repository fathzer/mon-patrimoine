import { I18n } from '../core/I18n.js';
import type { StorageManager, SyncStatus } from 'ts-cloud-storage-manager';

/**
 * Top-of-screen alert strip driven by the managed SyncEngine's status
 * channel. Three states, by priority: parked conflict (the user picks a
 * side), failed save awaiting retry (with the next attempt time), remote
 * update detected (pull button). Empty — hidden — while nothing needs
 * attention.
 */
export class SyncBanner {
  _root: HTMLElement;
  _storage: StorageManager;

  constructor(root: HTMLElement, storage: StorageManager) {
    this._root = root;
    this._storage = storage;
    storage.onStatus(s => this.render(s));
  }

  render(status: SyncStatus): void {
    // Demo sessions pause the engine — its stale account-side status
    // (e.g. pending edits) must not alarm while browsing demo data.
    if (this._storage.currentProvider.isReadOnly()) {
      this._root.innerHTML = '';
      return;
    }
    if (status.conflict) {
      this._root.innerHTML = `
        <div class="sync-banner sync-warning">
          <span>${I18n.t('syncBanner.conflict')}</span>
          <button id="sync-keep-local" class="btn-secondary">${I18n.t('syncBanner.keepLocal')}</button>
          <button id="sync-keep-remote" class="btn-secondary">${I18n.t('syncBanner.keepCloud')}</button>
        </div>`;
      this._onClick('sync-keep-local', () => this._storage.resolveConflict('local'));
      this._onClick('sync-keep-remote', () => this._storage.resolveConflict('remote'));
      return;
    }
    if (status.pending && (status.lastError || status.nextRetryAt)) {
      const time = status.nextRetryAt
        ? I18n.t('syncBanner.retryAt', {
            time: new Date(status.nextRetryAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          })
        : I18n.t('syncBanner.retrySoon');
      this._root.innerHTML = `
        <div class="sync-banner sync-warning">
          <span>${I18n.t('syncBanner.savePending', { time })}</span>
        </div>`;
      return;
    }
    if (status.remoteChanged) {
      this._root.innerHTML = `
        <div class="sync-banner sync-warning">
          <span>${I18n.t('syncBanner.remoteUpdate')}</span>
          <button id="sync-pull" class="btn-secondary">${I18n.t('syncBanner.update')}</button>
        </div>`;
      this._onClick('sync-pull', () => this._storage.pull());
      return;
    }
    this._root.innerHTML = '';
  }

  _onClick(id: string, action: () => Promise<unknown>): void {
    this._root.querySelector(`#${id}`)?.addEventListener('click', () => { void action(); });
  }
}
