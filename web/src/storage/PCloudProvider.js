import { StorageProvider } from './StorageProvider.js';

export class PCloudProvider extends StorageProvider {
  constructor(clientId) {
    super();
    this.clientId = clientId;
    this.fileName = 'patrimoine_data.json';
    this.accessToken = localStorage.getItem('pcloud_token') || null;
    this.apiLocation = 'api.pcloud.com';
  }

  async init() {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash.substring(1));
      this.accessToken = params.get('access_token');
      localStorage.setItem('pcloud_token', this.accessToken);
      history.replaceState(null, '', window.location.pathname);
      return true;
    }
    return !!this.accessToken;
  }

  async authenticate() {
    const redirectUrl = encodeURIComponent(window.location.origin + window.location.pathname);
    window.location.href = `https://${this.apiLocation}/oauth2/authorize?client_id=${this.clientId}&response_type=token&redirect_uri=${redirectUrl}`;
  }

  async disconnect() {
    this.accessToken = null;
    localStorage.removeItem('pcloud_token');
  }

  async loadData() {
    if (!this.accessToken) return null;
    const res = await fetch(`https://${this.apiLocation}/downloadfile?path=/${this.fileName}&access_token=${this.accessToken}`);
    if (!res.ok) return null;
    return await res.json();
  }

  async saveData(data) {
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

  async getStatus() {
    return { isConnected: !!this.accessToken, userEmail: '', providerName: 'pCloud' };
  }
}
