import type { AuthFailure } from './AuthFailure.js';

export interface StorageStatus {
  isConnected: boolean;
  providerName: string;
  userEmail?: string;
}

export interface StorageConfig {
  googleClientId?: string;
  dropboxAppKey?: string;
}

/**
 * Abstract base class for storage providers.
 * Subclasses must implement authentication, data load/save and status retrieval.
 */
export abstract class StorageProvider {
  init(): Promise<boolean> { return Promise.resolve(false); }
  abstract authenticate(): Promise<boolean>;

  /**
   * Query-string parameters this provider produces on the OAuth return URL
   * (redirect flows only — e.g. ['code','state','error']). They are stripped
   * by the URL cleanup once consumed. Providers with a JS-callback flow
   * (Google GIS popup) keep the empty default.
   */
  readonly authResponseParams: string[] = [];

  /**
   * Redirect-flow providers: consumes the OAuth return parameters present in
   * the URL after the provider sent the browser back (exchanges the code,
   * checks the anti-CSRF state...). Returns 'none' when the URL carries
   * nothing this provider recognizes, true/false for the auth verdict.
   * Popup-flow providers keep the default no-op.
   */
  resumeAuth(_url: URL): Promise<boolean | 'none'> { return Promise.resolve('none'); }

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
