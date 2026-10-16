import { StorageProvider } from './StorageProvider.js';
import type { StorageStatus } from './StorageProvider.js';

/** Public Gist URL serving the demo dataset. */
export const DEMO_DATA_URL =
  'https://gist.githubusercontent.com/fathzer/3f2d318a89d09dac58e57b2989eaaddd/raw/demo.json';

/**
 * Read-only provider for the demo mode: data is fetched from a public Gist
 * and kept in memory only — every save is silently dropped, so a page
 * reload restores the Gist content.
 */
export class DemoProvider extends StorageProvider {
  dataUrl: string;

  constructor(dataUrl: string = DEMO_DATA_URL) {
    super();
    this.dataUrl = dataUrl;
  }

  override init(): Promise<boolean> { return Promise.resolve(true); }
  override authenticate(): Promise<boolean> { return Promise.resolve(true); }
  override isReadOnly(): boolean { return true; }

  override async loadData(): Promise<unknown> {
    const response = await fetch(this.dataUrl);
    if (!response.ok) {
      throw new Error(`Demo data fetch failed: HTTP ${response.status}`);
    }
    return await response.json();
  }

  /** Saves are dropped on purpose: demo edits live in memory only. */
  override saveData(): Promise<boolean> { return Promise.resolve(true); }

  override getStatus(): Promise<StorageStatus> {
    return Promise.resolve({ isConnected: true, providerName: 'Mode démo' });
  }

  override getDataLocation(): Promise<string | null> {
    return Promise.resolve(this.dataUrl);
  }
}
