import { I18n } from '../core/I18n.js';

/**
 * Classification of an interactive-authentication failure. Each provider
 * maps its native errors (GIS error_callback, an ?error= parameter on a
 * redirect return, a polled popup that closed...) onto these kinds — the
 * UI wording lives once here instead of being recoded per provider.
 */
export type AuthFailureKind =
  | 'popupBlocked'  // the browser refused to open the consent window
  | 'popupClosed'   // the user closed the consent window before completion
  | 'accessDenied'  // consent/access refused on the provider side
  | 'error';        // anything else (network, provider outage, unknown)

export interface AuthFailure {
  kind: AuthFailureKind;
  /** Provider-side detail (e.g. OAuth error_description), for diagnosis. */
  detail?: string;
}

/** Paragraphs explaining why a login failed — inserted between the common
 *  "connection failed" title and the retry hint in the connect card. */
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
