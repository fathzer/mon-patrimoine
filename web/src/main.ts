import { I18n } from './core/I18n.js';
import { StorageManager } from './storage/StorageManager.js';
import { AppStore } from './core/AppStore.js';
import { DashboardView } from './ui/DashboardView.js';

document.addEventListener('DOMContentLoaded', async () => {
  const storageManager = new StorageManager({
    // Insérer ici votre Client ID Google Drive si nécessaire
    googleClientId: '1075597097575-9q8l4dvvahrpqn4l7dvu1999i0259ct8.apps.googleusercontent.com'
  });
  const store = new AppStore(storageManager);
  const dashboard = new DashboardView(document.getElementById('app-root') as HTMLElement, store);

  store.on('state:changed', (summary) => dashboard.render(summary));
  store.on('state:loading', (isLoading) => dashboard.showLoading(isLoading));
  store.on('save:error', () => window.alert(I18n.t('alerts.saveError')));

  await store.init();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then((registration) => console.log('Service Worker registered:', registration.scope))
      .catch((error) => console.error('Service Worker registration failed:', error));
  }
});
