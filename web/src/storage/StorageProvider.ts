import type { AuthFailure } from './AuthFailure.js';

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
  init(): Promise<boolean> { return Promise.resolve(false); }
  abstract authenticate(): Promise<boolean>;
  disconnect(): Promise<void> { return Promise.resolve(); }
  abstract loadData(): Promise<unknown>;
  abstract saveData(data: unknown): Promise<boolean>;
  abstract getStatus(): Promise<StorageStatus>;

  /**
   * Returns a human-readable description of where the data is stored
   * (account, file path...), or null when it is unknown.
   */
  getDataLocation(): Promise<string | null> { return Promise.resolve(null); }

  /**
   * Whether this provider silently drops saves (demo mode): the UI warns
   * the user that changes live in memory only.
   */
  isReadOnly(): boolean { return false; }

  /**
   * Why the last interactive authenticate() attempt failed, classified for
   * the UI (see AuthFailure.ts). Null when no attempt failed.
   */
  getAuthFailure(): AuthFailure | null { return null; }
}
