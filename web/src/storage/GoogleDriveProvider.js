import { StorageProvider } from './StorageProvider.js';

export class GoogleDriveProvider extends StorageProvider {
  static TOKEN_EXPIRATION_MS = 3600 * 1000; // 1 heure en millisecondes

  constructor(clientId) {
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

  async init() {
    if (!this.clientId) return !!this.accessToken;
    await this.initGis();
    return !!this.accessToken;
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
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
      callback: () => {},
      error_callback: (error) => {
        console.error('Google token client error:', error);
        this._lastError = error;
      }
    });
    resolve(true);
  }

  async authenticate() {
    if (!this.tokenClient) await this.initGis();
    return new Promise((resolve) => {
      this.tokenClient.callback = async (resp) => {
        if (resp.error) return resolve(false);
        this._saveToken(resp.access_token);
        
        // Fetch user email from userinfo endpoint
        await this._fetchUserEmail();
        
        resolve(true);
      };
      this.tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  }

  async _fetchUserEmail() {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      if (response.ok) {
        const userInfo = await response.json();
        if (userInfo.email) {
          this.userEmail = userInfo.email;
          localStorage.setItem('gdrive_user_email', this.userEmail);
        }
      }
    } catch (error) {
      console.error('Failed to fetch user email:', error);
    }
  }

  async disconnect() {
    this.accessToken = null;
    this.tokenExpiration = null;
    this.userEmail = null;
    localStorage.removeItem('gdrive_token');
    localStorage.removeItem('gdrive_token_expiration');
    localStorage.removeItem('gdrive_user_email');
  }

  _saveToken(accessToken) {
    this.accessToken = accessToken;
    localStorage.setItem('gdrive_token', this.accessToken);
    this.tokenExpiration = Date.now() + GoogleDriveProvider.TOKEN_EXPIRATION_MS;
    localStorage.setItem('gdrive_token_expiration', this.tokenExpiration);
  }

  _isTokenExpired() {
    if (!this.tokenExpiration) return true;
    return Date.now() >= Number.parseInt(this.tokenExpiration, 10);
  }

  async _silentRefresh() {
    if (!this.tokenClient) await this.initGis();
    
    this._lastError = null;
    
    return new Promise((resolve) => {
      this.tokenClient.callback = (resp) => {
        if (resp.error) {
          console.error('Silent token refresh failed:', resp.error);
          resolve(false);
        } else {
          this._saveToken(resp.access_token);
          resolve(true);
        }
      };
      
      const tokenRequest = { prompt: '' };
      if (this.userEmail) {
        tokenRequest.login_hint = this.userEmail;
      }
      
      this.tokenClient.requestAccessToken(tokenRequest);
      
      // Check for error_callback after a short delay to detect popup blocking
      setTimeout(() => {
        if (this._lastError) {
          console.error('Popup blocked detected via error_callback:', this._lastError);
          resolve(false);
        }
      }, 100);
    });
  }

  _showReconnectionDialog() {
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
      
      const reconnectBtn = dialog.querySelector('#btn-reconnect');
      const cancelBtn = dialog.querySelector('#btn-cancel-reconnect');
      const overlay = dialog.querySelector('.modal-overlay');
      
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

  async _executeWithAuthRetry(apiCall) {
    await this._handleTokenExpiration();
    const result = await apiCall();
    return await this._handleAuthError(result, apiCall);
  }

  async _handleTokenExpiration() {
    if (this._isTokenExpired()) {
      const refreshed = await this._silentRefresh();
      if (!refreshed) {
        await this._forceReconnection();
      }
    }
  }

  async _forceReconnection() {
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

  async _handleAuthError(result, apiCall) {
    if (result instanceof Response && result.status === 401) {
      return await this._retryAfterAuthError(apiCall);
    }
    return result;
  }

  async _retryAfterAuthError(apiCall) {
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

  async _findFileId() {
    if (this.fileId) return this.fileId;
    
    const res = await this._executeWithAuthRetry(async () => {
      const q = encodeURIComponent("name = 'patrimoine_data.json' and trashed = false");
      return await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${q}`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );
    });
    
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      this.fileId = data.files[0].id;
      return this.fileId;
    }
    return null;
  }

  async loadData() {
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

  async saveData(data) {
    if (!this.accessToken) return false;
    const fileId = await this._findFileId();
    const content = JSON.stringify(data, null, 2);

    if (fileId) {
      return await this._updateExistingFile(fileId, content);
    } else {
      return await this._createNewFile(content);
    }
  }

  async _updateExistingFile(fileId, content) {
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

  async _createNewFile(content) {
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
    
    const createdFile = await res.json();
    if (res.ok && createdFile.id) {
      this.fileId = createdFile.id;
    }
    return res.ok;
  }

  async getStatus() {
    return { isConnected: !!this.accessToken, providerName: 'Google Drive' };
  }
}
