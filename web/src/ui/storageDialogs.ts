import { I18n } from '../core/I18n.js';
import { bindOverlayClose } from './overlayClose.js';
import type { ConfirmDialogRequest } from 'ts-cloud-storage-manager';

/**
 * App-side renderer for the confirmation dialogs storage providers need
 * mid-flow (Google Drive reconnection, missing scopes). Injected into
 * StorageConfig.confirmDialog so the wording stays in French via I18n —
 * the library only carries English fallback strings.
 */
export function storageConfirmDialog(request: ConfirmDialogRequest): Promise<boolean> {
  const prefix = `storage.dialog.${request.kind}`;
  const warning = request.kind === 'reconnect'
    ? `<div style="background: rgba(245, 158, 11, 0.1); border: 1px solid #f59e0b; border-radius: 6px; padding: 0.75rem; margin-top: 1rem;">
         <p style="margin: 0; font-size: 0.9rem;">${I18n.t(`${prefix}.warning`)}</p>
       </div>`
    : '';
  return new Promise((resolve) => {
    const dialog = document.createElement('div');
    dialog.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content help-modal-content">
          <h2 class="help-modal-header">${I18n.t(`${prefix}.title`)}</h2>
          <div class="help-modal-body">
            <section class="help-section">
              <h3 class="help-section-title">${I18n.t(`${prefix}.section`)}</h3>
              <p><strong>${I18n.t('storage.dialog.whyTitle')}</strong></p>
              <p>${I18n.t(`${prefix}.why`)}</p>
              <p><strong>${I18n.t('storage.dialog.whatTitle')}</strong></p>
              <p>${I18n.t(`${prefix}.what`)}</p>
              ${warning}
            </section>
          </div>
          <div class="modal-actions help-modal-footer">
            <button type="button" id="btn-cancel" class="btn-secondary">${I18n.t('storage.dialog.cancel')}</button>
            <button type="button" id="btn-confirm" class="btn-primary">${I18n.t(`${prefix}.confirm`)}</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    const close = (confirmed = false) => {
      dialog.remove();
      resolve(confirmed);
    };

    dialog.querySelector<HTMLButtonElement>('#btn-confirm')?.addEventListener('click', () => close(true));
    dialog.querySelector<HTMLButtonElement>('#btn-cancel')?.addEventListener('click', () => close(false));
    const overlay = dialog.querySelector<HTMLElement>('.modal-overlay');
    if (overlay) bindOverlayClose(overlay, () => close(false));
  });
}
