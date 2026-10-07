import { StorageProvider } from './StorageProvider.js';
import type { StorageStatus } from './StorageProvider.js';

export class LocalStorageProvider extends StorageProvider {
  storageKey: string;

  constructor(storageKey: string = 'patrimoine_data_v1') {
    super();
    this.storageKey = storageKey;
  }

  override init(): Promise<boolean> { return Promise.resolve(true); }
  override authenticate(): Promise<boolean> { return Promise.resolve(true); }
  override disconnect(): Promise<void> { return Promise.resolve(); }

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

  override getStatus(): Promise<StorageStatus> {
    return Promise.resolve({ isConnected: false, userEmail: '', providerName: 'Stockage Local' });
  }

  override getDataLocation(): Promise<string | null> {
    return Promise.resolve(`localStorage: ${this.storageKey}`);
  }
}
