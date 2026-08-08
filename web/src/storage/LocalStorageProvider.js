import { StorageProvider } from './StorageProvider.js';

export class LocalStorageProvider extends StorageProvider {
  constructor(storageKey = 'patrimoine_data_v1') {
    super();
    this.storageKey = storageKey;
  }

  async init() { return true; }
  async authenticate() { return true; }
  async disconnect() {}

  async loadData() {
    const rawData = localStorage.getItem(this.storageKey);
    return rawData ? JSON.parse(rawData) : null;
  }

  async saveData(data) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  async getStatus() {
    return { isConnected: false, userEmail: '', providerName: 'Stockage Local' };
  }
}
