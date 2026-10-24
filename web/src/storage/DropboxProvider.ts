import { StorageProvider } from './StorageProvider.js';
import type { StorageStatus } from './StorageProvider.js';
import type { AuthFailure } from './AuthFailure.js';
import { generateVerifier, pkceChallenge } from './pkce.js';

interface DropboxTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface DropboxFileMetadata {
  id?: string;
  name?: string;
}

type ApiCall = () => Promise<Response>;

/**
 * Dropbox storage provider — OAuth2 redirect flow with PKCE and offline
 * (refresh-token) access, no app secret involved. The app is registered with
 * "App folder" access: all file paths are relative to its dedicated folder.
 * See STORAGE_PROVIDERS.md.
 *
 * authenticate() navigates the whole page to the Dropbox consent screen, so
 * its promise never resolves; the verdict is read by resumeAuth() on the
 * return URL (?code= / ?error= + ?state=).
 *
 * Tokens live in localStorage (dbx_*): the refresh token never expires until
 * revoked, which gives the same "connected forever" experience as the Yapbam
 * desktop app. The data file is addressed by its Dropbox file id when known —
 * the id survives renames (the app-folder scope prevents moving it out).
 */
export class DropboxProvider extends StorageProvider {
  static readonly AUTHORIZE_URL = 'https://www.dropbox.com/oauth2/authorize';
  static readonly TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
  static readonly API_URL = 'https://api.dropboxapi.com/2';
  static readonly CONTENT_URL = 'https://content.dropboxapi.com/2';

  appKey: string;
  fileName: string;
  accessToken: string | null;
  tokenExpiration: number | null;
  refreshToken: string | null;
  userEmail: string | null;
  /** Dropbox file id ("id:..."), usable verbatim wherever a path is accepted
   *  and survives file renames. */
  fileId: string | null;
  /** Last file name seen in API responses (user may rename the file). */
  resolvedName: string | null;
  _authFailure: AuthFailure | null;

  constructor(appKey: string) {
    super();
    this.appKey = appKey;
    this.fileName = 'patrimoine_data.json';
    this.accessToken = localStorage.getItem('dbx_access') || null;
    this.tokenExpiration = Number(localStorage.getItem('dbx_expires')) || null;
    this.refreshToken = localStorage.getItem('dbx_refresh') || null;
    this.userEmail = localStorage.getItem('dbx_user_email') || null;
    this.fileId = localStorage.getItem('dbx_file_id') || null;
    this.resolvedName = localStorage.getItem('dbx_file_name') || null;
    this._authFailure = null;
  }

  override readonly authResponseParams = ['code', 'state', 'error', 'error_description'];

  override getAuthFailure(): AuthFailure | null {
    return this._authFailure;
  }

  override init(): Promise<boolean> {
    // The access token may be expired — it is refreshed lazily on the first
    // API call. The session is defined by the refresh token.
    return Promise.resolve(!!this.refreshToken);
  }

  /**
   * Starts the redirect flow: the page navigates to Dropbox and this promise
   * never resolves. The anti-CSRF state, PKCE verifier and exact redirect URI
   * are kept in sessionStorage for resumeAuth() on the way back.
   */
  override async authenticate(): Promise<boolean> {
    const verifier = generateVerifier();
    const challenge = await pkceChallenge(verifier);
    const state = crypto.randomUUID();
    // The redirect URI carries this provider's name in the connect param:
    // it is form-urlencoded (a bare "?connect" is rejected by Dropbox), and on
    // the way back it tells the app which provider owns the returned params
    // while remaining a plain "start Dropbox auth" deep link otherwise.
    const redirectUri = `${window.location.origin}${window.location.pathname}?connect=dropbox`;
    sessionStorage.setItem('dbx_state', state);
    sessionStorage.setItem('dbx_verifier', verifier);
    sessionStorage.setItem('dbx_redirect_uri', redirectUri);
    const params = new URLSearchParams({
      client_id: this.appKey,
      redirect_uri: redirectUri,
      response_type: 'code',
      token_access_type: 'offline',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state
    });
    window.location.assign(`${DropboxProvider.AUTHORIZE_URL}?${params}`);
    return new Promise<boolean>(() => {});
  }

  override async resumeAuth(url: URL): Promise<boolean | 'none'> {
    const params = url.searchParams;
    const error = params.get('error');
    const code = params.get('code');
    if (!error && !code) return 'none';

    if (error) {
      this._authFailure = error === 'access_denied'
        ? { kind: 'accessDenied' }
        : { kind: 'error', detail: params.get('error_description') ?? error };
      this._clearAuthRequest();
      return false;
    }

    const expectedState = sessionStorage.getItem('dbx_state');
    const verifier = sessionStorage.getItem('dbx_verifier');
    const redirectUri = sessionStorage.getItem('dbx_redirect_uri');
    this._clearAuthRequest();
    if (!expectedState || expectedState !== params.get('state') || !verifier || !redirectUri) {
      // Either a forged URL or a stale page (auth was started in another tab).
      this._authFailure = { kind: 'error', detail: 'OAuth state mismatch' };
      return false;
    }

    try {
      await this._exchangeCode(code!, verifier, redirectUri);
      // The account may have changed: the cached file id/name are no longer valid.
      this.fileId = null;
      this.resolvedName = null;
      localStorage.removeItem('dbx_file_id');
      localStorage.removeItem('dbx_file_name');
      this._authFailure = null;
      await this._fetchUserEmail();
      return true;
    } catch (e) {
      this._authFailure = { kind: 'error', detail: e instanceof Error ? e.message : String(e) };
      return false;
    }
  }

  _clearAuthRequest(): void {
    sessionStorage.removeItem('dbx_state');
    sessionStorage.removeItem('dbx_verifier');
    sessionStorage.removeItem('dbx_redirect_uri');
  }

  async _exchangeCode(code: string, verifier: string, redirectUri: string): Promise<void> {
    const res = await fetch(DropboxProvider.TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        client_id: this.appKey,
        code_verifier: verifier
      })
    });
    const token = await res.json() as DropboxTokenResponse;
    if (!res.ok || !token.access_token || !token.refresh_token) {
      const reason = token.error ?? `HTTP ${res.status}`;
      throw new Error(`Dropbox token exchange failed: ${reason}`);
    }
    this._saveTokens(token);
  }

  async _refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      // No way back without a refresh token: drop any orphan credentials.
      this._clearSession();
      throw new Error('No Dropbox refresh token');
    }
    const res = await fetch(DropboxProvider.TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        client_id: this.appKey
      })
    });
    const token = await res.json() as DropboxTokenResponse;
    if (!res.ok || !token.access_token) {
      if (token.error === 'invalid_grant' || res.status === 401) {
        // The refresh token was revoked or is dead: the session is over.
        this._clearSession();
      }
      const reason = token.error ?? `HTTP ${res.status}`;
      throw new Error(`Dropbox token refresh failed: ${reason}`);
    }
    this._saveTokens(token);
  }

  _saveTokens(token: DropboxTokenResponse): void {
    this.accessToken = token.access_token ?? null;
    if (this.accessToken) localStorage.setItem('dbx_access', this.accessToken);
    // Refresh tokens are not rotated by Dropbox, but keep it if one is sent.
    if (token.refresh_token) {
      this.refreshToken = token.refresh_token;
      localStorage.setItem('dbx_refresh', this.refreshToken);
    }
    this.tokenExpiration = Date.now() + (token.expires_in ?? 14400) * 1000;
    localStorage.setItem('dbx_expires', String(this.tokenExpiration));
  }

  _isTokenExpired(): boolean {
    return !this.accessToken || !this.tokenExpiration || Date.now() >= this.tokenExpiration;
  }

  async _ensureAccessToken(): Promise<void> {
    if (!this._isTokenExpired()) return;
    await this._refreshAccessToken();
  }

  /** Runs an API call, refreshing the access token first when expired and
   *  retrying once on 401 (the stored expiration may be optimistic). */
  async _executeWithAuthRetry(apiCall: ApiCall): Promise<Response> {
    await this._ensureAccessToken();
    const res = await apiCall();
    if (res.status !== 401) return res;
    await this._refreshAccessToken();
    return await apiCall();
  }

  async _api(path: string, body: unknown): Promise<Response> {
    return await this._executeWithAuthRetry(() => fetch(`${DropboxProvider.API_URL}/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }));
  }

  async _fetchUserEmail(): Promise<void> {
    try {
      const res = await this._api('users/get_current_account', null);
      if (res.ok) {
        const account = await res.json() as { email?: string };
        if (account.email) {
          this.userEmail = account.email;
          localStorage.setItem('dbx_user_email', this.userEmail);
        }
      }
    } catch (error) {
      console.error('Failed to fetch Dropbox account email:', error);
    }
  }

  _filePath(): string {
    // Dropbox file ids are returned already prefixed ("id:...") and are used
    // verbatim wherever a path is accepted — they survive renames.
    return this.fileId ?? `/${this.fileName}`;
  }

  /**
   * True when the response is a "file not found" API error (HTTP 409 with a
   * path/not_found tag) rather than a real failure.
   */
  async _isNotFound(res: Response): Promise<boolean> {
    if (res.status !== 409) return false;
    try {
      const body = await res.json() as { error?: { path?: { ['.tag']?: string } } };
      return body.error?.path?.['.tag'] === 'not_found';
    } catch {
      return false;
    }
  }

  async _tryDownload(): Promise<Response | null> {
    const res = await this._executeWithAuthRetry(() => fetch(`${DropboxProvider.CONTENT_URL}/files/download`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Dropbox-API-Arg': JSON.stringify({ path: this._filePath() })
      }
    }));
    if (res.ok) return res;
    if (await this._isNotFound(res)) {
      if (this.fileId) {
        // The stored id is stale (file deleted, or account switched): retry by name.
        this.fileId = null;
        localStorage.removeItem('dbx_file_id');
        return await this._tryDownload();
      }
      return null;
    }
    throw new Error(`Dropbox download failed: HTTP ${res.status}`);
  }

  override async loadData(): Promise<unknown> {
    if (!this.refreshToken) return null;
    const res = await this._tryDownload();
    if (!res) return null;
    const metaHeader = res.headers.get('Dropbox-API-Result');
    if (metaHeader) {
      try {
        const meta = JSON.parse(metaHeader) as DropboxFileMetadata;
        this._cacheFileInfo(meta);
      } catch { /* metadata header is informational only */ }
    }
    try {
      return await res.json();
    } catch {
      throw new Error('Data file content is not valid JSON');
    }
  }

  override async saveData(data: unknown): Promise<boolean> {
    if (!this.refreshToken) return false;
    const content = JSON.stringify(data, null, 2);
    let res = await this._upload(this._filePath(), content);
    if (!res.ok && this.fileId) {
      // Writing by id failed (file deleted or account switched): retry by name.
      this.fileId = null;
      localStorage.removeItem('dbx_file_id');
      res = await this._upload(`/${this.fileName}`, content);
    }
    if (!res.ok) return false;
    const meta = await res.json() as DropboxFileMetadata;
    this._cacheFileInfo(meta);
    return true;
  }

  _upload(path: string, content: string): Promise<Response> {
    return this._executeWithAuthRetry(() => fetch(`${DropboxProvider.CONTENT_URL}/files/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({ path, mode: 'overwrite', autorename: false, mute: true })
      },
      body: content
    }));
  }

  _cacheFileInfo(meta: DropboxFileMetadata): void {
    if (meta.id) {
      this.fileId = meta.id;
      localStorage.setItem('dbx_file_id', meta.id);
    }
    if (meta.name) {
      this.resolvedName = meta.name;
      localStorage.setItem('dbx_file_name', meta.name);
    }
  }

  override async disconnect(): Promise<void> {
    // Best effort remote revoke: revoking the access token also disables the
    // associated refresh token. The access token must be valid for the call,
    // so it is refreshed first when expired.
    try {
      await this._ensureAccessToken();
      if (this.accessToken) {
        await fetch(`${DropboxProvider.API_URL}/auth/token/revoke`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.accessToken}` }
        });
      }
    } catch { /* local disconnect proceeds anyway */ }
    this._clearSession();
  }

  _clearSession(): void {
    this.accessToken = null;
    this.tokenExpiration = null;
    this.refreshToken = null;
    this.userEmail = null;
    this.fileId = null;
    this.resolvedName = null;
    for (const key of ['dbx_access', 'dbx_expires', 'dbx_refresh', 'dbx_user_email', 'dbx_file_id', 'dbx_file_name']) {
      localStorage.removeItem(key);
    }
  }

  override getStatus(): Promise<StorageStatus> {
    return Promise.resolve({
      isConnected: !!this.refreshToken,
      providerName: 'Dropbox',
      userEmail: this.userEmail ?? undefined
    });
  }

  override getDataLocation(): Promise<string | null> {
    if (!this.refreshToken) return Promise.resolve(null);
    const account = this.userEmail ? ` (${this.userEmail})` : '';
    return Promise.resolve(`Dropbox${account}: /${this.resolvedName ?? this.fileName}`);
  }
}
