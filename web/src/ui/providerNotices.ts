import { HelpPopover } from './HelpPopover.js';

/** The closing recommendation shared by every discouraged-provider notice. */
function recommendation(providerLabel: string): string {
  return `<p>Nous vous recommandons de choisir un autre fournisseur Cloud. Si vos données sont déjà sur ${providerLabel}, exportez-les depuis le tableau de bord (bouton « Exporter ») puis connectez-vous à un autre fournisseur avant de les ré-importer.</p>`;
}

/**
 * Temporary "discouraged" notices shown under the buttons of the provider
 * picker and in the top alert banner (keyed by the storage library's
 * provider names). The wording is app-specific, so it lives here rather
 * than in the library — remove a provider's entry when its situation is
 * resolved.
 */
const NOTICES: Record<string, { label: string; title: string; content: string }> = {
  onedrive: {
    label: 'OneDrive',
    title: 'OneDrive déconseillé',
    content: `
      <p>Nous rencontrons actuellement des difficultés dans le circuit de suivi administratif de Microsoft qui pourraient conduire à une coupure future de l'accès à vos données (elles resteront cependant accessibles via l'interface web de OneDrive).</p>
      ${recommendation('OneDrive')}
    `
  },
  gdrive: {
    label: 'Google Drive',
    title: 'Google Drive déconseillé',
    content: `
      <p>Google refuse de valider les applications hébergées sur GitHub Pages (domaine <code>github.io</code>) — un hébergement qui offre pourtant une garantie d'auditabilité et de traçabilité des modifications supérieure à celle d'un site servi sous son propre nom de domaine, où l'éditeur peut librement modifier le code et réexploiter les données confiées via Google.</p>
      <p>De plus, l'intégration du processus d'authentification avec Google Drive est moins fluide que celle des autres fournisseurs.</p>
      <p>L'application n'étant pas validée par Google, l'accès est restreint aux seuls utilisateurs de test déclarés (accès via l'interface web de Google Drive restant possible).</p>
      ${recommendation('Google Drive')}
    `
  }
};

/** The shared explanatory popover for a provider's notice — used by the
 *  button annotation and the top alert banner alike. */
function noticePopover(providerName: string, notice: { title: string; content: string }): string {
  return HelpPopover.getHtml({ title: notice.title, content: notice.content, icon: true });
}

/**
 * The "déconseillé" annotation rendered in the bottom-right corner of a
 * provider button — empty string for providers without a notice.
 */
export function providerNoticeHtml(providerName: string): string {
  const notice = NOTICES[providerName];
  if (!notice) return '';
  return `<span class="provider-note">déconseillé ${noticePopover(providerName, notice)}</span>`;
}

/**
 * Content of the top alert banner shown while the session runs on a
 * discouraged provider — empty string when the provider is fine.
 */
export function providerAlertBannerHtml(providerName: string): string {
  const notice = NOTICES[providerName];
  if (!notice) return '';
  return `Le fournisseur de stockage « ${notice.label} » est déconseillé — pensez à exporter vos données. ${noticePopover(providerName, notice)}`;
}
