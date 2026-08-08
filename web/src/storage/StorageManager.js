import { LocalStorageProvider } from './LocalStorageProvider.js';
import { GoogleDriveProvider } from './GoogleDriveProvider.js';
import { PCloudProvider } from './PCloudProvider.js';

export class StorageManager {
  constructor(config = {}) {
    this.providers = {
      local: new LocalStorageProvider(),
      gdrive: new GoogleDriveProvider(config.googleClientId),
      pcloud: new PCloudProvider(config.pcloudClientId)
    };
    const activeKey = localStorage.getItem('active_storage_provider') || 'local';
    this.currentProvider = this.providers[activeKey] || this.providers.local;
  }

  async initialize() {
    return await this.currentProvider.init();
  }

  setProvider(providerKey) {
    if (!this.providers[providerKey]) throw new Error(`Provider inconnu: ${providerKey}`);
    this.currentProvider = this.providers[providerKey];
    localStorage.setItem('active_storage_provider', providerKey);
  }

  async load() { return await this.currentProvider.loadData(); }
  async save(data) { return await this.currentProvider.saveData(data); }
  async authenticateCurrent() { return await this.currentProvider.authenticate(); }
  async disconnectCurrent() { return await this.currentProvider.disconnect(); }
  async getStatus() { return await this.currentProvider.getStatus(); }
}
