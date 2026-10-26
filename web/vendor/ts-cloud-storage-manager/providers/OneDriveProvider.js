import { StorageProvider } from '../StorageProvider.js';
import { generateVerifier, pkceChallenge } from '../pkce.js';
/**
 * Microsoft OneDrive storage provider — OAuth2 redirect flow with PKCE and
 * offline (refresh-token) access, no app secret involved: the application
 * must be registered as a "Single-page application" platform in the Entra
 * portal. The Files.ReadWrite.AppFolder permission restricts access to the
 * dedicated application folder ("Applications/<app name>").
 *
 * authenticate() navigates the whole page to the Microsoft consent screen, so
 * its promise never resolves; the verdict is read by resumeAuth() on the
 * return URL (?code= / ?error= + ?state=).
 *
 * Tokens live in localStorage (od_*). Microsoft rotates the refresh token on
 * every use — the new one is persisted each time. The data file is addressed
 * by its drive item id when known — the id survives renames (the app-folder
 * scope prevents moving it out of reach).
 *
 * Revision-aware contract: `rev` is the drive item eTag. save() sends it in
 * `if-match`; Microsoft answers 412 when the remote item changed — reported
 * as a 'conflict' verdict. An eTag also changes on pure-metadata edits
 * (rename...), which may cause harmless extra pulls — acceptable.
 */
export class OneDriveProvider extends StorageProvider {
    // The "consumers" tenant restricts sign-in to personal Microsoft accounts,
    // the audience of OneDrive Personal this app targets.
    static AUTHORIZE_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize';
    static TOKEN_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
    static GRAPH_URL = 'https://graph.microsoft.com/v1.0';
    static SCOPES = 'offline_access User.Read Files.ReadWrite.AppFolder';
    clientId;
    fileName;
    accessToken;
    tokenExpiration;
    refreshToken;
    userEmail;
    /** Drive item id, usable in /me/drive/items/<id> and surviving renames. */
    fileId;
    /** Last file name seen in API responses (user may rename the file). */
    resolvedName;
    _authFailure;
    /**
     * @param clientId the Entra application (client) id — "Single-page
     *        application" platform.
     * @param fileName name of the data file in the app folder.
     */
    constructor(clientId, fileName = 'data.json') {
        super();
        this.clientId = clientId;
        this.fileName = fileName;
        this.accessToken = localStorage.getItem('od_access') || null;
        this.tokenExpiration = Number(localStorage.getItem('od_expires')) || null;
        this.refreshToken = localStorage.getItem('od_refresh') || null;
        this.userEmail = localStorage.getItem('od_user_email') || null;
        this.fileId = localStorage.getItem('od_file_id') || null;
        this.resolvedName = localStorage.getItem('od_file_name') || null;
        this._authFailure = null;
    }
    authResponseParams = ['code', 'state', 'error', 'error_description'];
    getAuthFailure() {
        return this._authFailure;
    }
    init() {
        // The access token may be expired — it is refreshed lazily on the first
        // API call. The session is defined by the refresh token.
        return Promise.resolve(!!this.refreshToken);
    }
    /**
     * Starts the redirect flow: the page navigates to Microsoft and this promise
     * never resolves. The anti-CSRF state, PKCE verifier and exact redirect URI
     * are kept in sessionStorage for resumeAuth() on the way back.
     */
    async authenticate() {
        const verifier = generateVerifier();
        const challenge = await pkceChallenge(verifier);
        // The state doubles as the provider marker: Microsoft's SPA redirect URIs
        // cannot carry a query string (unlike Dropbox's), so the bare app URL is
        // used and the provider name is prefixed inside the state, which is
        // echoed back verbatim (see StorageManager.resumeAuth).
        const state = `onedrive:${crypto.randomUUID()}`;
        const redirectUri = `${window.location.origin}${window.location.pathname}`;
        sessionStorage.setItem('od_state', state);
        sessionStorage.setItem('od_verifier', verifier);
        sessionStorage.setItem('od_redirect_uri', redirectUri);
        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            response_mode: 'query',
            scope: OneDriveProvider.SCOPES,
            code_challenge: challenge,
            code_challenge_method: 'S256',
            state
        });
        window.location.assign(`${OneDriveProvider.AUTHORIZE_URL}?${params}`);
        return new Promise(() => { });
    }
    async resumeAuth(url) {
        const params = url.searchParams;
        const error = params.get('error');
        const code = params.get('code');
        if (!error && !code)
            return 'none';
        if (error) {
            this._authFailure = error === 'access_denied'
                ? { kind: 'accessDenied' }
                : { kind: 'error', detail: params.get('error_description') ?? error };
            this._clearAuthRequest();
            return false;
        }
        const expectedState = sessionStorage.getItem('od_state');
        const verifier = sessionStorage.getItem('od_verifier');
        const redirectUri = sessionStorage.getItem('od_redirect_uri');
        this._clearAuthRequest();
        if (!expectedState || expectedState !== params.get('state') || !verifier || !redirectUri) {
            // Either a forged URL or a stale page (auth was started in another tab).
            this._authFailure = { kind: 'error', detail: 'OAuth state mismatch' };
            return false;
        }
        try {
            await this._exchangeCode(code, verifier, redirectUri);
            // The account may have changed: the cached file id/name are no longer valid.
            this.fileId = null;
            this.resolvedName = null;
            localStorage.removeItem('od_file_id');
            localStorage.removeItem('od_file_name');
            this._authFailure = null;
            await this._fetchUserEmail();
            return true;
        }
        catch (e) {
            this._authFailure = { kind: 'error', detail: e instanceof Error ? e.message : String(e) };
            return false;
        }
    }
    _clearAuthRequest() {
        sessionStorage.removeItem('od_state');
        sessionStorage.removeItem('od_verifier');
        sessionStorage.removeItem('od_redirect_uri');
    }
    async _exchangeCode(code, verifier, redirectUri) {
        const res = await fetch(OneDriveProvider.TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri,
                client_id: this.clientId,
                code_verifier: verifier,
                scope: OneDriveProvider.SCOPES
            })
        });
        const token = await res.json();
        if (!res.ok || !token.access_token || !token.refresh_token) {
            const reason = token.error ?? `HTTP ${res.status}`;
            throw new Error(`OneDrive token exchange failed: ${reason}`);
        }
        this._saveTokens(token);
    }
    async _refreshAccessToken() {
        if (!this.refreshToken) {
            // No way back without a refresh token: drop any orphan credentials.
            this._clearSession();
            throw new Error('No OneDrive refresh token');
        }
        const res = await fetch(OneDriveProvider.TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: this.refreshToken,
                client_id: this.clientId,
                scope: OneDriveProvider.SCOPES
            })
        });
        const token = await res.json();
        if (!res.ok || !token.access_token) {
            if (token.error === 'invalid_grant' || res.status === 401) {
                // The refresh token was revoked or is dead: the session is over.
                this._clearSession();
            }
            const reason = token.error ?? `HTTP ${res.status}`;
            throw new Error(`OneDrive token refresh failed: ${reason}`);
        }
        this._saveTokens(token);
    }
    _saveTokens(token) {
        this.accessToken = token.access_token ?? null;
        if (this.accessToken)
            localStorage.setItem('od_access', this.accessToken);
        // Microsoft rotates the refresh token on every refresh: always persist it.
        if (token.refresh_token) {
            this.refreshToken = token.refresh_token;
            localStorage.setItem('od_refresh', this.refreshToken);
        }
        this.tokenExpiration = Date.now() + (token.expires_in ?? 3600) * 1000;
        localStorage.setItem('od_expires', String(this.tokenExpiration));
    }
    _isTokenExpired() {
        return !this.accessToken || !this.tokenExpiration || Date.now() >= this.tokenExpiration;
    }
    async _ensureAccessToken() {
        if (!this._isTokenExpired())
            return;
        await this._refreshAccessToken();
    }
    /** Runs an API call, refreshing the access token first when expired and
     *  retrying once on 401 (the stored expiration may be optimistic). */
    async _executeWithAuthRetry(apiCall) {
        await this._ensureAccessToken();
        const res = await apiCall();
        if (res.status !== 401)
            return res;
        await this._refreshAccessToken();
        return await apiCall();
    }
    async _fetchUserEmail() {
        try {
            const res = await this._executeWithAuthRetry(() => fetch(`${OneDriveProvider.GRAPH_URL}/me`, {
                headers: { Authorization: `Bearer ${this.accessToken}` }
            }));
            if (res.ok) {
                const account = await res.json();
                const email = account.mail ?? account.userPrincipalName;
                if (email) {
                    this.userEmail = email;
                    localStorage.setItem('od_user_email', this.userEmail);
                }
            }
        }
        catch (error) {
            console.error('Failed to fetch OneDrive account email:', error);
        }
    }
    /** The Graph path addressing the data file: by item id once discovered
     *  (survives renames), by name in the app folder otherwise. */
    _itemPath() {
        return this.fileId
            ? `/me/drive/items/${this.fileId}`
            : `/me/drive/special/approot:/${this.fileName}:`;
    }
    async _tryDownload() {
        const res = await this._executeWithAuthRetry(() => fetch(`${OneDriveProvider.GRAPH_URL}${this._itemPath()}/content`, {
            headers: { Authorization: `Bearer ${this.accessToken}` }
        }));
        if (res.ok)
            return res;
        if (res.status === 404) {
            if (this.fileId) {
                // The stored id is stale (file deleted, or account switched): retry by name.
                this.fileId = null;
                localStorage.removeItem('od_file_id');
                return await this._tryDownload();
            }
            return null;
        }
        throw new Error(`OneDrive download failed: HTTP ${res.status}`);
    }
    async load() {
        if (!this.refreshToken)
            return null;
        const res = await this._tryDownload();
        if (!res)
            return null;
        let data;
        try {
            data = await res.json();
        }
        catch {
            throw new Error('Data file content is not valid JSON');
        }
        // The content response carries no metadata: fetch the drive item to
        // learn its id (subsequent calls address it directly) and its eTag.
        const item = await this._fetchItemMetadata();
        return { data, rev: item?.eTag ?? null };
    }
    /** Fetches the drive item (id, name, eTag), caching id and name for
     *  later calls. Returns null when the file does not exist. */
    async _fetchItemMetadata() {
        const res = await this._executeWithAuthRetry(() => fetch(`${OneDriveProvider.GRAPH_URL}${this._itemPath()}?$select=id,name,eTag`, { headers: { Authorization: `Bearer ${this.accessToken}` } }));
        if (res.ok) {
            const item = await res.json();
            this._cacheFileInfo(item);
            return item;
        }
        if (res.status === 404 && this.fileId) {
            // The stored id is stale (file deleted, or account switched): retry by name.
            this.fileId = null;
            localStorage.removeItem('od_file_id');
            return await this._fetchItemMetadata();
        }
        if (res.status === 404)
            return null;
        throw new Error(`OneDrive metadata fetch failed: HTTP ${res.status}`);
    }
    async save(data, baseRev) {
        if (!this.refreshToken)
            throw new Error('No OneDrive session');
        const content = JSON.stringify(data, null, 2);
        let res = await this._upload(this._itemPath(), content, baseRev);
        if (res.status === 412)
            return { status: 'conflict' };
        if (!res.ok && this.fileId) {
            // Writing by id failed (file deleted or account switched): retry by name.
            this.fileId = null;
            localStorage.removeItem('od_file_id');
            res = await this._upload(this._itemPath(), content, baseRev);
            if (res.status === 412)
                return { status: 'conflict' };
        }
        if (!res.ok)
            throw new Error(`OneDrive upload failed: HTTP ${res.status}`);
        const item = await res.json();
        this._cacheFileInfo(item);
        return { status: 'saved', rev: item.eTag ?? null };
    }
    _upload(itemPath, content, baseRev) {
        // A baseRev turns the write into a conditional update: Microsoft answers
        // 412 when the remote eTag differs — our 'conflict' verdict.
        const headers = {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/octet-stream'
        };
        if (baseRev)
            headers['if-match'] = baseRev;
        return this._executeWithAuthRetry(() => fetch(`${OneDriveProvider.GRAPH_URL}${itemPath}/content`, {
            method: 'PUT',
            headers,
            body: content
        }));
    }
    async getRemoteRevision() {
        if (!this.refreshToken)
            return null;
        const item = await this._fetchItemMetadata();
        return item?.eTag ?? null;
    }
    _cacheFileInfo(meta) {
        if (meta.id) {
            this.fileId = meta.id;
            localStorage.setItem('od_file_id', meta.id);
        }
        if (meta.name) {
            this.resolvedName = meta.name;
            localStorage.setItem('od_file_name', meta.name);
        }
    }
    disconnect() {
        // Microsoft exposes no token revocation endpoint usable by a public
        // client: the local credentials are simply dropped. The user can revoke
        // the consent itself from their Microsoft account settings.
        this._clearSession();
        return Promise.resolve();
    }
    _clearSession() {
        this.accessToken = null;
        this.tokenExpiration = null;
        this.refreshToken = null;
        this.userEmail = null;
        this.fileId = null;
        this.resolvedName = null;
        for (const key of ['od_access', 'od_expires', 'od_refresh', 'od_user_email', 'od_file_id', 'od_file_name']) {
            localStorage.removeItem(key);
        }
    }
    getStatus() {
        return Promise.resolve({
            isConnected: !!this.refreshToken,
            providerName: 'OneDrive',
            userEmail: this.userEmail ?? undefined
        });
    }
    getDataLocation() {
        if (!this.refreshToken)
            return Promise.resolve(null);
        const account = this.userEmail ? ` (${this.userEmail})` : '';
        return Promise.resolve(`OneDrive${account}: /${this.resolvedName ?? this.fileName}`);
    }
}
//# sourceMappingURL=OneDriveProvider.js.map