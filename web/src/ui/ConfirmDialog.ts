import { I18n } from '../core/I18n.js';
import { bindOverlayClose } from './overlayClose.js';

export class ConfirmDialog {
  static ask(message: string, container: HTMLElement = document.body, confirmLabel?: string): Promise<boolean> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-content" style="max-width: 420px; text-align: center;">
          <h3 style="margin: 0 0 1.5rem; color: var(--danger);">${message}</h3>
          <div style="display: flex; justify-content: center; gap: 1rem; margin-top: 1.5rem;">
            <button type="button" class="btn-secondary confirm-dialog-cancel">${I18n.t('actions.cancel')}</button>
            <button type="button" class="btn-danger confirm-dialog-confirm">${confirmLabel ?? I18n.t('actions.delete')}</button>
          </div>
        </div>
      `;
      container.appendChild(overlay);

      const cleanup = (): void => {
        document.removeEventListener('keydown', onKey);
        overlay.remove();
      };

      const onKey = (e: KeyboardEvent): void => {
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

      bindOverlayClose(overlay, () => {
        cleanup();
        resolve(false);
      });
    });
  }

  /**
   * Asks for a date (default: today) — e.g. the effective date of a closure.
   * Resolves with the chosen YYYY-MM-DD date, or null on cancel.
   */
  static askWithDate(message: string, confirmLabel: string, container: HTMLElement = document.body): Promise<string | null> {
    return new Promise((resolve) => {
      const today = new Date().toISOString().split('T')[0];
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-content" style="max-width: 420px; text-align: center;">
          <h3 style="margin: 0 0 1rem; color: var(--color-warning);">${message}</h3>
          <input type="date" class="form-control" value="${today}" required style="max-width: 220px; margin: 0 auto; text-align: center;" />
          <div style="display: flex; justify-content: center; gap: 1rem; margin-top: 1.5rem;">
            <button type="button" class="btn-secondary confirm-dialog-cancel">${I18n.t('actions.cancel')}</button>
            <button type="button" class="btn-warning confirm-dialog-confirm">${confirmLabel}</button>
          </div>
        </div>
      `;
      container.appendChild(overlay);

      const input = overlay.querySelector('input') as HTMLInputElement;

      const cleanup = (): void => {
        document.removeEventListener('keydown', onKey);
        overlay.remove();
      };

      const onKey = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') {
          cleanup();
          resolve(null);
        }
      };

      document.addEventListener('keydown', onKey);

      overlay.querySelector('.confirm-dialog-cancel')?.addEventListener('click', () => {
        cleanup();
        resolve(null);
      });

      overlay.querySelector('.confirm-dialog-confirm')?.addEventListener('click', () => {
        if (!input.checkValidity()) return;
        const date = input.value;
        cleanup();
        resolve(date);
      });

      bindOverlayClose(overlay, () => {
        cleanup();
        resolve(null);
      });
    });
  }
}
