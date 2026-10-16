import { I18n } from './core/I18n.js';
import { StorageManager } from './storage/StorageManager.js';
import { AppStore } from './core/AppStore.js';
import { DashboardView } from './ui/DashboardView.js';
import { HelpModalView } from './ui/HelpModalView.js';
import { PlacementFactory } from './placements/PlacementFactory.js';
import { UiState } from './core/UiState.js';

const GOOGLE_CLIENT_ID = '1075597097575-9q8l4dvvahrpqn4l7dvu1999i0259ct8.apps.googleusercontent.com';

document.addEventListener('DOMContentLoaded', () => {
  const appRoot = document.getElementById('app-root');
  if (appRoot) {
    void bootApp(appRoot);
  } else {
    bootLanding();
  }
  registerServiceWorker();
});

/** Landing page (site root): the content is static markup readable without
 *  JS; this only wires the footer help modal. The connect/demo buttons are
 *  plain links to app/?connect and app/?demo. */
function bootLanding(): void {
  // Forward legacy deep links (index.html?demo used to enter demo mode).
  if (new URLSearchParams(window.location.search).has('demo')) {
    window.location.replace('app/?demo');
    return;
  }
  const storageManager = new StorageManager({ googleClientId: GOOGLE_CLIENT_ID });
  document.getElementById('landing-help')?.addEventListener('click', (event) => {
    event.preventDefault();
    const modalRoot = document.getElementById('landing-modal-root') as HTMLElement;
    new HelpModalView(modalRoot, storageManager).show();
  });
}

async function bootApp(appRoot: HTMLElement): Promise<void> {
  await PlacementFactory.loadModules();

  const storageManager = new StorageManager({ googleClientId: GOOGLE_CLIENT_ID });
  const store = new AppStore(storageManager);
  const dashboard = new DashboardView(appRoot, store);

  let wasAuthenticated = false;
  store.on('state:changed', (summary) => {
    // Leaving a session (logout or expiry) returns to the landing page;
    // the in-app reconnect card is only for ?connect and failed restores.
    if (wasAuthenticated && !summary.isAuthenticated) {
      UiState.save({ lastSession: null });
      window.location.replace('./');
      return;
    }
    wasAuthenticated = summary.isAuthenticated;
    dashboard.render(summary);
    // Remember the session kind so a reload can restore the demo.
    UiState.save({
      lastSession: summary.isAuthenticated
        ? (storageManager.currentProvider.isReadOnly() ? 'demo' : 'account')
        : null
    });
  });
  store.on('state:loading', (isLoading) => dashboard.showLoading(isLoading));
  store.on('save:error', () => window.alert(I18n.t('alerts.saveError')));
  store.on('load:error', () => window.alert(I18n.t('alerts.loadError')));

  const params = new URLSearchParams(window.location.search);
  // A requested ?demo URL wins over any existing session — the demo banner
  // keeps it clearly distinguishable from real data.
  if (params.has('demo')) {
    await store.loginDemo();
    return;
  }
  await store.init();
  if (store.state.isAuthenticated) return;
  if (params.has('connect')) {
    // The landing's Connexion link leads here: start the auth flow right
    // away. A blocked popup, a cancel or an error goes back to the landing
    // where a real click can retry.
    try {
      await store.login();
    } catch (error) {
      console.error('Authentication failed:', error);
    }
    if (!store.state.isAuthenticated) window.location.replace('./');
    return;
  }
  if (UiState.load().lastSession === 'demo') {
    await store.loginDemo();
    return;
  }
  // No session and nothing requested: back to the landing page.
  window.location.replace('./');
}

function registerServiceWorker(): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then((registration) => console.log('Service Worker registered:', registration.scope))
      .catch((error) => console.error('Service Worker registration failed:', error));
  }
}
