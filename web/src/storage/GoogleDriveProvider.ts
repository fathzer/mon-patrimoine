import { StorageProvider } from './StorageProvider.js';
import type { StorageStatus } from './StorageProvider.js';

// Minimal type declarations for the Google Identity Services (GIS) client.
// Loaded dynamically from https://accounts.google.com/gsi/client.
interface GisTokenResponse {
  access_token?: string;
  error?: unknown;
}

interface GisErrorCallbackPayload {
  type?: string;
  message?: string;
}

interface GisTokenClient {
  callback: (resp: GisTokenResponse) => void;
  error_callback?: (error: GisErrorCallbackPayload) => void;
  requestAccessToken: (request: { prompt: string; login_hint?: string }) => void;
}

interface GisOauth2 {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (resp: GisTokenResponse) => void;
    error_callback?: (error: GisErrorCallbackPayload) => void;
  }) => GisTokenClient;
}

declare global {
  interface Window {
    google?: { accounts: { oauth2: GisOauth2 } };
  }
  const google: { accounts: { oauth2: GisOauth2 } } | undefined;
}

type ApiCall = () => Promise<Response>;

export class GoogleDriveProvider extends StorageProvider {
  static readonly TOKEN_EXPIRATION_MS = 3600 * 1000; // 1 heure en millisecondes

  clientId: string;
  fileName: string;
  accessToken: string | null;
  tokenExpiration: string | number | null;
  userEmail: string | null;
  tokenClient: GisTokenClient | null;
  fileId: string | null;
  _lastError: GisErrorCallbackPayload | null;

  constructor(clientId: string) {
    super();
    this.clientId = clientId;
    this.fileName = 'patrimoine_data.json';
    this.accessToken = localStorage.getItem('gdrive_token') || null;
    this.tokenExpiration = localStorage.getItem('gdrive_token_expiration') || null;
    this.userEmail = localStorage.getItem('gdrive_user_email') || null;
    this.tokenClient = null;
    this.fileId = null;
    this._lastError = null;
  }

  override async init(): Promise<boolean> {
    if (!this.clientId) return !!this.accessToken;
    await this.initGis();
    return !!this.accessToken;
  }

  initGis(): Promise<boolean> {
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

  _setupTokenClient(resolve: (value: boolean) => void): void {
    this.tokenClient = google!.accounts.oauth2.initTokenClient({
      client_id: this.clientId,
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
      callback: () => {},
      error_callback: (error: GisErrorCallbackPayload) => {
        console.error('Google token client error:', error);
        this._lastError = error;
      }
    });
    resolve(true);
  }

  override async authenticate(): Promise<boolean> {
    if (!this.tokenClient) await this.initGis();
    return new Promise((resolve) => {
      this.tokenClient!.callback = async (resp: GisTokenResponse) => {
        if (resp.error) return resolve(false);
        this._saveToken(resp.access_token!);

        // Fetch user email from userinfo endpoint
        await this._fetchUserEmail();

        resolve(true);
      };
      this.tokenClient!.requestAccessToken({ prompt: 'consent' });
    });
  }

  async _fetchUserEmail(): Promise<void> {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      if (response.ok) {
        const userInfo = await response.json() as { email?: string };
        if (userInfo.email) {
          this.userEmail = userInfo.email;
          localStorage.setItem('gdrive_user_email', this.userEmail);
        }
      }
    } catch (error) {
      console.error('Failed to fetch user email:', error);
    }
  }

  override async disconnect(): Promise<void> {
    this.accessToken = null;
    this.tokenExpiration = null;
    this.userEmail = null;
    localStorage.removeItem('gdrive_token');
    localStorage.removeItem('gdrive_token_expiration');
    localStorage.removeItem('gdrive_user_email');
  }

  _saveToken(accessToken: string): void {
    this.accessToken = accessToken;
    localStorage.setItem('gdrive_token', this.accessToken);
    this.tokenExpiration = Date.now() + GoogleDriveProvider.TOKEN_EXPIRATION_MS;
    localStorage.setItem('gdrive_token_expiration', String(this.tokenExpiration));
  }

  _isTokenExpired(): boolean {
    if (!this.tokenExpiration) return true;
    return Date.now() >= Number.parseInt(String(this.tokenExpiration), 10);
  }

  async _silentRefresh(): Promise<boolean> {
    if (!this.tokenClient) await this.initGis();

    this._lastError = null;

    return new Promise((resolve) => {
      this.tokenClient!.callback = (resp: GisTokenResponse) => {
        if (resp.error) {
          console.error('Silent token refresh failed:', resp.error);
          resolve(false);
        } else {
          this._saveToken(resp.access_token!);
          resolve(true);
        }
      };

      const tokenRequest: { prompt: string; login_hint?: string } = { prompt: '' };
      if (this.userEmail) {
        tokenRequest.login_hint = this.userEmail;
      }

      this.tokenClient!.requestAccessToken(tokenRequest);

      // Check for error_callback after a short delay to detect popup blocking
      setTimeout(() => {
        if (this._lastError) {
          console.error('Popup blocked detected via error_callback:', this._lastError);
          resolve(false);
        }
      }, 100);
    });
  }

  _showReconnectionDialog(): Promise<boolean> {
    return new Promise((resolve) => {
      const dialog = document.createElement('div');
      dialog.innerHTML = `
        <div class="modal-overlay">
          <div class="modal-content help-modal-content">
            <h2 class="help-modal-header">
              🔐 Reconnexion requise
            </h2>
            <div class="help-modal-body">
              <section class="help-section">
                <h3 class="help-section-title">
                  ⚠️ Expiration du jeton d'accès
                </h3>
                <p>
                  <strong>Pourquoi cette fenêtre ?</strong>
                </p>
                <p>
                  Votre jeton d'accès à Google Drive a expiré. Pour des raisons de sécurité, Google interdit la reconnexion automatique sans intervention utilisateur explicite à moins de faire transiter vos données de connexion sur nos serveurs.</br>
                  Ce transit serait une violation de notre promesse "Aucune de vos données ne nous est envoyée".
                </p>
                <p>
                  <strong>Ce que vous devez faire :</strong>
                </p>
                <p>
                  Cliquez sur le bouton "Se reconnecter" ci-dessous pour autoriser à nouveau l'accès à votre Google Drive. Une fenêtre pop-up s'ouvrira pour vous demander de confirmer l'autorisation.
                </p>
                <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid #f59e0b; border-radius: 6px; padding: 0.75rem; margin-top: 1rem;">
                  <p style="margin: 0; font-size: 0.9rem;">
                    <strong>⚠️ Important :</strong> Assurez-vous que votre navigateur autorise les pop-ups pour ce site, sinon la fenêtre de connexion Google ne s'ouvrira pas. Si vous voyez une icône de pop-up bloqué dans la barre d'adresse, cliquez dessus pour autoriser les pop-ups temporairement.
                  </p>
                </div>
              </section>
            </div>
            <div class="modal-actions help-modal-footer">
              <button type="button" id="btn-cancel-reconnect" class="btn-secondary">
                Annuler
              </button>
              <button type="button" id="btn-reconnect" class="btn-primary">
                Se reconnecter
              </button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(dialog);

      const reconnectBtn = dialog.querySelector<HTMLButtonElement>('#btn-reconnect');
      const cancelBtn = dialog.querySelector<HTMLButtonElement>('#btn-cancel-reconnect');
      const overlay = dialog.querySelector<HTMLElement>('.modal-overlay');

      const close = (confirmed = false) => {
        dialog.remove();
        resolve(confirmed);
      };

      reconnectBtn?.addEventListener('click', () => close(true));
      cancelBtn?.addEventListener('click', () => close(false));
      overlay?.addEventListener('click', (e) => {
        if (e.target === overlay) close(false);
      });
    });
  }

  async _executeWithAuthRetry(apiCall: ApiCall): Promise<Response> {
    await this._handleTokenExpiration();
    const result = await apiCall();
    return await this._handleAuthError(result, apiCall);
  }

  async _handleTokenExpiration(): Promise<void> {
    if (this._isTokenExpired()) {
      const refreshed = await this._silentRefresh();
      if (!refreshed) {
        await this._forceReconnection();
      }
    }
  }

  async _forceReconnection(): Promise<void> {
    const userConfirmed = await this._showReconnectionDialog();
    if (userConfirmed) {
      const success = await this.authenticate();
      if (!success) {
        throw new Error('Authentication failed');
      }
    } else {
      throw new Error('User cancelled reconnection');
    }
  }

  async _handleAuthError(result: Response, apiCall: ApiCall): Promise<Response> {
    if (result instanceof Response && result.status === 401) {
      return await this._retryAfterAuthError(apiCall);
    }
    return result;
  }

  async _retryAfterAuthError(apiCall: ApiCall): Promise<Response> {
    const refreshed = await this._silentRefresh();
    if (refreshed) {
      return await apiCall();
    }
    const userConfirmed = await this._showReconnectionDialog();
    if (userConfirmed) {
      const success = await this.authenticate();
      if (success) {
        return await apiCall();
      }
    }
    throw new Error('Authentication failed after reconnection');
  }

  async _findFileId(): Promise<string | null> {
    if (this.fileId) return this.fileId;

    const res = await this._executeWithAuthRetry(async () => {
      const q = encodeURIComponent("name = 'patrimoine_data.json' and trashed = false");
      return await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${q}`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );
    });

    const data = await res.json() as { files?: Array<{ id: string }> };
    if (data.files && data.files.length > 0) {
      this.fileId = data.files[0].id;
      return this.fileId;
    }
    return null;
  }

  override async loadData(): Promise<unknown> {
    if (!this.accessToken) return null;
    const fileId = await this._findFileId();
    if (!fileId) return null;

    const res = await this._executeWithAuthRetry(async () => {
      return await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );
    });

    return await res.json();
  }

  override async saveData(data: unknown): Promise<boolean> {
    if (!this.accessToken) return false;
    const fileId = await this._findFileId();
    const content = JSON.stringify(data, null, 2);

    if (fileId) {
      return await this._updateExistingFile(fileId, content);
    } else {
      return await this._createNewFile(content);
    }
  }

  async _updateExistingFile(fileId: string, content: string): Promise<boolean> {
    const res = await this._executeWithAuthRetry(async () => {
      return await fetch(
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
    });

    return res.ok;
  }

  async _createNewFile(content: string): Promise<boolean> {
    const metadata = {
      name: this.fileName,
      mimeType: 'application/json'
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([content], { type: 'application/json' }));

    const res = await this._executeWithAuthRetry(async () => {
      return await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.accessToken}` },
          body: form
        }
      );
    });

    const createdFile = await res.json() as { id?: string };
    if (res.ok && createdFile.id) {
      this.fileId = createdFile.id;
    }
    return res.ok;
  }

  override async getStatus(): Promise<StorageStatus> {
    return { isConnected: !!this.accessToken, providerName: 'Google Drive' };
  }
}
