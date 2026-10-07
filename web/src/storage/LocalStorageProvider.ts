import { StorageProvider } from './StorageProvider.js';
import type { StorageStatus } from './StorageProvider.js';

export class LocalStorageProvider extends StorageProvider {
  storageKey: string;

  constructor(storageKey: string = 'patrimoine_data_v1') {
    super();
    this.storageKey = storageKey;
  }

  override async init(): Promise<boolean> { return true; }
  override async authenticate(): Promise<boolean> { return true; }
  override async disconnect(): Promise<void> {}

  override async loadData(): Promise<unknown> {
    const rawData = localStorage.getItem(this.storageKey);
    return rawData ? JSON.parse(rawData) : null;
  }

  override async saveData(data: unknown): Promise<boolean> {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  override async getStatus(): Promise<StorageStatus> {
    return { isConnected: false, userEmail: '', providerName: 'Stockage Local' };
  }
}
