export class StorageProvider {
  constructor() {
    if (new.target === StorageProvider) {
      throw new TypeError("Classe abstraite StorageProvider.");
    }
  }
  async init() { return false; }
  async authenticate() { throw new Error('Not implemented'); }
  async disconnect() {}
  async loadData() { throw new Error('Not implemented'); }
  async saveData(data) { throw new Error('Not implemented'); }
  async getStatus() { return { isConnected: false, providerName: 'Cloud' }; }
}
