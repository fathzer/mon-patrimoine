import { I18n } from '../core/I18n.js';

export class ConfirmDialog {
  static ask(message, container = document.body) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-content" style="max-width: 420px; text-align: center;">
          <h3 style="margin: 0 0 1.5rem; color: var(--danger);">${message}</h3>
          <div style="display: flex; justify-content: center; gap: 1rem; margin-top: 1.5rem;">
            <button type="button" class="btn-secondary confirm-dialog-cancel">${I18n.t('actions.cancel')}</button>
            <button type="button" class="btn-danger confirm-dialog-confirm">${I18n.t('actions.delete')}</button>
          </div>
        </div>
      `;
      container.appendChild(overlay);

      const cleanup = () => {
        document.removeEventListener('keydown', onKey);
        overlay.remove();
      };

      const onKey = (e) => {
        if (e.key === 'Escape') {
          cleanup();
          resolve(false);
        }
      };

      document.addEventListener('keydown', onKey);

      overlay.querySelector('.confirm-dialog-cancel')?.addEventListener('click', () => {
        cleanup();
        resolve(false);
      });

      overlay.querySelector('.confirm-dialog-confirm')?.addEventListener('click', () => {
        cleanup();
        resolve(true);
      });

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          cleanup();
          resolve(false);
        }
      });
    });
  }
}
