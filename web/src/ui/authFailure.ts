import { I18n } from '../core/I18n.js';
import type { AuthFailure } from 'ts-cloud-storage-manager';

/** Paragraphs explaining why a login failed — inserted between the common
 *  "connection failed" title and the retry hint in the connect card. The
 *  failure kinds come from the storage library; their wording lives here
 *  because it depends on the app's I18n. */
export function authFailureExplanation(failure: AuthFailure | null): string {
  const kind = failure?.kind ?? 'error';
  let html = `<p>${I18n.t(`auth.failure.${kind}`)}</p>`;
  if (kind === 'popupBlocked') {
    html += `<p>${I18n.t('auth.failure.popupBlockedHow')}</p>`;
  }
  if (failure?.detail) {
    html += `<p class="text-muted">${escapeHtml(failure.detail)}</p>`;
  }
  return html;
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[m]);
}
