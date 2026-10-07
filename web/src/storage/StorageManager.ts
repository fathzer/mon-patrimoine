import { GoogleDriveProvider } from './GoogleDriveProvider.js';
import type { StorageProvider, StorageConfig, StorageStatus } from './StorageProvider.js';

export class StorageManager {
  currentProvider: StorageProvider;

  constructor(config: StorageConfig = {}) {
    this.currentProvider = new GoogleDriveProvider(config.googleClientId as string);
  }

  async initialize(): Promise<boolean> {
    return await this.currentProvider.init();
  }

  async load(): Promise<unknown> { return await this.currentProvider.loadData(); }
  async save(data: unknown): Promise<boolean> { return await this.currentProvider.saveData(data); }
  async authenticate(): Promise<boolean> { return await this.currentProvider.authenticate(); }
  async disconnect(): Promise<void> { await this.currentProvider.disconnect(); }
  async getStatus(): Promise<StorageStatus> { return await this.currentProvider.getStatus(); }
}
