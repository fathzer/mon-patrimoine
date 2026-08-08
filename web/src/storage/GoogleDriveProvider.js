import { StorageProvider } from './StorageProvider.js';

export class GoogleDriveProvider extends StorageProvider {
  constructor(clientId) {
    super();
    this.clientId = clientId;
    this.fileName = 'patrimoine_data.json';
    this.accessToken = null;
    this.tokenClient = null;
    this.fileId = null;
  }

  async init() {
    if (!this.clientId) return false;
    await this.initGis();
    return new Promise((resolve) => {
      this.tokenClient.callback = (resp) => {
        if (resp.error) {
          this.accessToken = null;
          resolve(false);
        } else {
          this.accessToken = resp.access_token;
          resolve(true);
        }
      };
      this.tokenClient.requestAccessToken({ prompt: '' });
    });
  }

  initGis() {
    return new Promise((resolve) => {
      if (window.google?.accounts?.oauth2) {
        this._setupTokenClient(resolve);
      } else {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.onload = () => this._setupTokenClient(resolve);
        document.head.appendChild(script);
      }
    });
  }

  _setupTokenClient(resolve) {
    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: this.clientId,
      scope: 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file',
      callback: () => {}
    });
    resolve(true);
  }

  async authenticate() {
    if (!this.tokenClient) await this.initGis();
    return new Promise((resolve) => {
      this.tokenClient.callback = (resp) => {
        if (resp.error) return resolve(false);
        this.accessToken = resp.access_token;
        resolve(true);
      };
      this.tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  }

  async disconnect() {
    this.accessToken = null;
  }

  async _findFileId() {
    if (this.fileId) return this.fileId;
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${this.fileName}'`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      this.fileId = data.files[0].id;
      return this.fileId;
    }
    return null;
  }

  async loadData() {
    const fileId = await this._findFileId();
    if (!fileId) return null;
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    return await res.json();
  }

  async saveData(data) {
    const fileId = await this._findFileId();
    const content = JSON.stringify(data, null, 2);

    if (fileId) {
      const res = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: content
        }
      );
      return res.ok;
    } else {
      const metadata = { name: this.fileName, parents: ['appDataFolder'] };
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([content], { type: 'application/json' }));

      const res = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.accessToken}` },
          body: form
        }
      );
      const createdFile = await res.json();
      this.fileId = createdFile.id;
      return res.ok;
    }
  }

  async getStatus() {
    return { isConnected: !!this.accessToken, userEmail: '', providerName: 'Google Drive' };
  }
}
