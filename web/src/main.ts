import { I18n } from './core/I18n.js';
import { StorageManager } from './storage/StorageManager.js';
import { AppStore } from './core/AppStore.js';
import { DashboardView } from './ui/DashboardView.js';
import { HelpModalView } from './ui/HelpModalView.js';
import { PlacementFactory } from './placements/PlacementFactory.js';
import { UiState } from './core/UiState.js';

const GOOGLE_CLIENT_ID = '1075597097575-9q8l4dvvahrpqn4l7dvu1999i0259ct8.apps.googleusercontent.com';
const DROPBOX_APP_KEY = 'zvz86dayzn4qkt8';
const ONEDRIVE_CLIENT_ID = '59ee9063-c01a-49c7-b23e-a175d153b85e';

const STORAGE_CONFIG = { googleClientId: GOOGLE_CLIENT_ID, dropboxAppKey: DROPBOX_APP_KEY, oneDriveClientId: ONEDRIVE_CLIENT_ID };

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
  const storageManager = new StorageManager(STORAGE_CONFIG);
  document.getElementById('landing-help')?.addEventListener('click', (event) => {
    event.preventDefault();
    const modalRoot = document.getElementById('landing-modal-root') as HTMLElement;
    new HelpModalView(modalRoot, storageManager).show();
  });
}

async function bootApp(appRoot: HTMLElement): Promise<void> {
  await PlacementFactory.loadModules();

  const storageManager = new StorageManager(STORAGE_CONFIG);
  const store = new AppStore(storageManager);
  const dashboard = new DashboardView(appRoot, store);

  // The provider picker hands the picked name here: start its auth flow and
  // map the verdict (the redirect flows — Dropbox — never come back here:
  // authenticate() navigates away, the verdict arrives via resumeAuth).
  dashboard.onProviderPick = async (name) => {
    storageManager.useProviderByName(name);
    // The "waiting" card only suits popup flows (the consent window is up
    // while the page stays). A redirect flow leaves immediately — keeping the
    // picker on screen is what the bfcache restores if the user hits the
    // browser's back button from the provider's page.
    if (storageManager.currentProvider.authResponseParams.length === 0) {
      dashboard.showConnecting();
    }
    try {
      await store.login();
    } catch (error) {
      console.error('Authentication failed:', error);
    }
    if (store.state.isAuthenticated) {
      window.history.replaceState(null, '', window.location.pathname);
    } else {
      dashboard.showConnectFailed();
    }
  };

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
    let sessionKind: 'demo' | 'account' | null = null;
    if (summary.isAuthenticated) {
      sessionKind = storageManager.currentProvider.isReadOnly() ? 'demo' : 'account';
    }
    UiState.save({ lastSession: sessionKind });
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
  // A redirect-flow provider (Dropbox) comes back with its verdict carried
  // in the URL (?code / ?error + ?state). Consume it before anything could
  // conclude the user is unauthenticated.
  const verdict = await storageManager.resumeAuth(new URL(window.location.href));
  if (verdict !== 'none') {
    const url = new URL(window.location.href);
    for (const param of storageManager.currentProvider.authResponseParams) {
      url.searchParams.delete(param);
    }
    // On success the connect marker goes with the OAuth params; on failure it
    // is kept or restored — the URL then documents the failed attempt and a
    // reload retries the same provider through the connect=<name> deep link.
    if (verdict) {
      url.searchParams.delete('connect');
    } else {
      url.searchParams.set('connect', storageManager.providerName);
    }
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    await store.init();
    if (!verdict) dashboard.showConnectFailed();
    return;
  }

  await store.init();
  if (store.state.isAuthenticated) return;
  if (params.has('connect')) {
    // A named provider (?connect=dropbox) is a deep link straight into its
    // auth flow; a bare ?connect shows the picker card instead.
    const wanted = params.get('connect');
    const provider = storageManager.availableProviders().find(p => p.name === wanted);
    if (provider) {
      await dashboard.onProviderPick?.(provider.name);
    } else {
      dashboard.showProviderPicker();
    }
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
