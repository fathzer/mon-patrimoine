import { StorageProvider } from './StorageProvider.js';
import type { StorageStatus } from './StorageProvider.js';

export class PCloudProvider extends StorageProvider {
  clientId: string;
  fileName: string;
  accessToken: string | null;
  apiLocation: string;

  constructor(clientId: string) {
    super();
    this.clientId = clientId;
    this.fileName = 'patrimoine_data.json';
    this.accessToken = localStorage.getItem('pcloud_token') || null;
    this.apiLocation = 'api.pcloud.com';
  }

  override init(): Promise<boolean> {
    const hash = window.location.hash;
    if (hash?.includes('access_token')) {
      const params = new URLSearchParams(hash.substring(1));
      this.accessToken = params.get('access_token');
      localStorage.setItem('pcloud_token', this.accessToken as string);
      history.replaceState(null, '', window.location.pathname);
      return Promise.resolve(true);
    }
    return Promise.resolve(!!this.accessToken);
  }

  override authenticate(): Promise<boolean> {
    const redirectUrl = encodeURIComponent(window.location.origin + window.location.pathname);
    window.location.href = `https://${this.apiLocation}/oauth2/authorize?client_id=${this.clientId}&response_type=token&redirect_uri=${redirectUrl}`;
    return Promise.resolve(false);
  }

  override disconnect(): Promise<void> {
    this.accessToken = null;
    localStorage.removeItem('pcloud_token');
    return Promise.resolve();
  }

  override async loadData(): Promise<unknown> {
    if (!this.accessToken) return null;
    const res = await fetch(`https://${this.apiLocation}/downloadfile?path=/${this.fileName}&access_token=${this.accessToken}`);
    if (!res.ok) return null;
    return await res.json();
  }

  override async saveData(data: unknown): Promise<boolean> {
    if (!this.accessToken) return false;
    const formData = new FormData();
    formData.append('filename', this.fileName);
    formData.append('file', new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));

    const res = await fetch(`https://${this.apiLocation}/uploadfile?path=/&access_token=${this.accessToken}`, {
      method: 'POST',
      body: formData
    });
    return res.ok;
  }

  override getStatus(): Promise<StorageStatus> {
    return Promise.resolve({ isConnected: !!this.accessToken, userEmail: '', providerName: 'pCloud' });
  }

  override getDataLocation(): Promise<string | null> {
    return Promise.resolve(this.accessToken ? `pCloud: /${this.fileName}` : null);
  }
}
