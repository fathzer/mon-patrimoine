import { GoogleDriveProvider } from './GoogleDriveProvider.js';

export class StorageManager {
  constructor(config = {}) {
    this.currentProvider = new GoogleDriveProvider(config.googleClientId);
  }

  async initialize() {
    return await this.currentProvider.init();
  }

  async load() { return await this.currentProvider.loadData(); }
  async save(data) { return await this.currentProvider.saveData(data); }
  async authenticate() { return await this.currentProvider.authenticate(); }
  async disconnect() { return await this.currentProvider.disconnect(); }
  async getStatus() { return await this.currentProvider.getStatus(); }
}
