import { GoogleDriveProvider } from './GoogleDriveProvider.js';
import type { StorageProvider, StorageConfig, StorageStatus } from './StorageProvider.js';

export class StorageManager {
  currentProvider: StorageProvider;
  _defaultProvider: StorageProvider;

  constructor(config: StorageConfig = {}) {
    this._defaultProvider = new GoogleDriveProvider(config.googleClientId as string);
    this.currentProvider = this._defaultProvider;
  }

  /** Swaps the active provider (e.g. entering demo mode). */
  useProvider(provider: StorageProvider): void {
    this.currentProvider = provider;
  }

  /** Back to the regular provider — e.g. after a demo-mode logout, so the
   *  next "Connexion" targets the user's real storage again. */
  restoreDefaultProvider(): void {
    this.currentProvider = this._defaultProvider;
  }

  async initialize(): Promise<boolean> {
    return await this.currentProvider.init();
  }

  async load(): Promise<unknown> { return await this.currentProvider.loadData(); }
  async save(data: unknown): Promise<boolean> { return await this.currentProvider.saveData(data); }
  async authenticate(): Promise<boolean> { return await this.currentProvider.authenticate(); }
  async disconnect(): Promise<void> { await this.currentProvider.disconnect(); }
  async getStatus(): Promise<StorageStatus> { return await this.currentProvider.getStatus(); }
  async getDataLocation(): Promise<string | null> { return await this.currentProvider.getDataLocation(); }
}
