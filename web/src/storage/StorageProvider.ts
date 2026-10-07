export interface StorageStatus {
  isConnected: boolean;
  providerName: string;
  userEmail?: string;
}

export interface StorageConfig {
  googleClientId?: string;
}

/**
 * Abstract base class for storage providers.
 * Subclasses must implement authentication, data load/save and status retrieval.
 */
export abstract class StorageProvider {
  async init(): Promise<boolean> { return false; }
  abstract authenticate(): Promise<boolean>;
  async disconnect(): Promise<void> {}
  abstract loadData(): Promise<unknown>;
  abstract saveData(data: unknown): Promise<boolean>;
  abstract getStatus(): Promise<StorageStatus>;
}
