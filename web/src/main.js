import { StorageManager } from './storage/StorageManager.js';
import { AppStore } from './core/AppStore.js';
import { DashboardView } from './ui/DashboardView.js';

document.addEventListener('DOMContentLoaded', async () => {
  const storageManager = new StorageManager({});
  const store = new AppStore(storageManager);
  const dashboard = new DashboardView(document.getElementById('app-root'), store);

  store.on('state:changed', (summary) => dashboard.render(summary));
  store.on('state:loading', (isLoading) => dashboard.showLoading(isLoading));

  await store.init();
});
