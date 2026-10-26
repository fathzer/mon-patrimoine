import { GoogleDriveProvider } from './providers/GoogleDriveProvider.js';
import { DropboxProvider } from './providers/DropboxProvider.js';
import { OneDriveProvider } from './providers/OneDriveProvider.js';
import { SyncEngine, UNRECONCILABLE } from './sync/SyncEngine.js';
export class StorageManager {
    /** localStorage key remembering which provider holds the account session. */
    static PROVIDER_KEY = 'mp_provider';
    /** sessionStorage key set while a redirect OAuth flow is in flight — on the
     *  return URL it tells which provider must consume the OAuth parameters. */
    static PENDING_KEY = 'mp_pending_provider';
    currentProvider;
    _defaultProvider;
    _config;
    _currentName;
    _engine = null;
    /**
     * @returns the name of the provider currently selected (last picked or
     *          remembered).
     */
    get providerName() {
        return this._currentName;
    }
    /**
     * @param config provider-specific blocks; a provider is offered only when
     *        its block is present. fileName applies to every provider.
     */
    constructor(config = {}) {
        this._config = config;
        this._currentName = this._rememberedName();
        this._defaultProvider = this._createProvider(this._currentName);
        this.currentProvider = this._defaultProvider;
        if (config.sync)
            this.enableSync(config.sync.policy ?? (() => UNRECONCILABLE), config.sync);
    }
    _rememberedName() {
        const saved = localStorage.getItem(StorageManager.PROVIDER_KEY);
        return saved === 'dropbox' || saved === 'onedrive' ? saved : 'gdrive';
    }
    _createProvider(name) {
        switch (name) {
            case 'dropbox': return new DropboxProvider(this._config.dropbox.appKey, this._config.fileName);
            case 'onedrive': return new OneDriveProvider(this._config.oneDrive.clientId, this._config.fileName);
            default: {
                const google = this._config.google;
                return new GoogleDriveProvider(google.clientId, {
                    fileName: this._config.fileName,
                    appTag: google.appTag,
                    confirmDialog: google.confirmDialog
                });
            }
        }
    }
    /**
     * @returns the providers offered by the provider picker — only those
     *          whose config block is present (a missing block hides the
     *          entry).
     */
    availableProviders() {
        const providers = [];
        if (this._config.dropbox)
            providers.push({ name: 'dropbox', label: 'Dropbox' });
        if (this._config.oneDrive)
            providers.push({ name: 'onedrive', label: 'OneDrive' });
        if (this._config.google)
            providers.push({ name: 'gdrive', label: 'Google Drive' });
        return providers;
    }
    /**
     * Enables offline-first sync: creates (or returns) the SyncEngine wrapped
     * around the active provider. The manager then owns its whole lifecycle —
     * init on session restore, provider re-wrap on switches, pause during
     * read-only sessions, state purge on disconnect.
     * @param policy the app-supplied merge policy (defaults to
     *        always-UNRECONCILABLE: every divergence parks).
     * @param options store implementation and polling interval.
     * @returns the managed SyncEngine — subscribe/save through it.
     */
    enableSync(policy = () => UNRECONCILABLE, options = {}) {
        this._engine ??= new SyncEngine(this.currentProvider, policy, options);
        return this._engine;
    }
    /** @returns the engine created by the `sync` config block or
     *          {@link enableSync}, null when sync is disabled. */
    get syncEngine() { return this._engine; }
    _requireEngine() {
        if (!this._engine)
            throw new Error('Sync is not enabled — pass a config.sync block or call enableSync()');
        return this._engine;
    }
    /**
     * Subscribes to sync-state changes (forwarded to the managed engine).
     * @param cb receives the new {@link SyncStatus} on every change.
     * @returns an unsubscribe function.
     */
    onStatus(cb) { return this._requireEngine().onStatus(cb); }
    /**
     * Fired when the working copy is replaced by a merge/pull — re-render
     * (forwarded to the managed engine).
     * @param cb receives the new working copy.
     * @returns an unsubscribe function.
     */
    onData(cb) { return this._requireEngine().onData(cb); }
    /**
     * Resolves a parked conflict (forwarded to the managed engine).
     * @param resolution 'local' | 'remote' | {merged: data}.
     * @returns the verdict of the resolution push.
     */
    resolveConflict(resolution) {
        return this._requireEngine().resolveConflict(resolution);
    }
    /**
     * Eager remote-change check + merge (forwarded to the managed engine).
     * @returns resolves when the check/merge completed.
     */
    pull() { return this._requireEngine().pull(); }
    /**
     * Selects an account provider by name; it also becomes the default the
     * app returns to after a demo session. A managed engine is re-wrapped
     * around the new provider.
     * @param name one of {@link availableProviders}' names.
     */
    useProviderByName(name) {
        this._currentName = name;
        this._defaultProvider = this._createProvider(name);
        this.currentProvider = this._defaultProvider;
        this._resync();
    }
    /**
     * Swaps the active provider (e.g. entering a read-only demo session).
     * A managed engine pauses on read-only providers — the account's sync
     * state is preserved — and is re-wrapped otherwise.
     * @param provider the provider instance to activate.
     */
    useProvider(provider) {
        this.currentProvider = provider;
        if (provider.isReadOnly()) {
            this._engine?.pause();
        }
        else {
            this._resync();
        }
    }
    /**
     * Back to the regular provider — e.g. after a demo-mode logout, so the
     * next login targets the user's real storage again. A managed engine is
     * re-wrapped (its state survived the pause).
     */
    restoreDefaultProvider() {
        this.currentProvider = this._defaultProvider;
        this._resync();
    }
    /** Re-wraps the managed engine around the current provider, if enabled. */
    _resync() { void this._engine?.setProvider(this.currentProvider); }
    /**
     * Tries the remembered provider first, then every configured one: the user
     * may have a session under another provider. The managed engine is
     * re-wrapped around whichever provider restored a session.
     * @returns true when a provider restored a session.
     */
    async initialize() {
        let found = await this.currentProvider.init();
        // The remembered provider has no session: another one might (the user
        // once connected through it without updating the remembered choice).
        for (const { name } of this.availableProviders()) {
            if (found || name === this._currentName)
                continue;
            const provider = this._createProvider(name);
            if (await provider.init()) {
                // Fields set directly — the engine is re-wrapped below.
                this._currentName = name;
                this._defaultProvider = provider;
                this.currentProvider = provider;
                found = true;
            }
        }
        if (!found)
            return false;
        if (this.currentProvider.isReadOnly()) {
            // Read-only sessions (demo) pause the engine — never re-wrap it:
            // pending account edits must not be pushed into a silent no-op save.
            this._engine?.pause();
        }
        else if (this._engine?.provider === this.currentProvider) {
            await this._engine.init();
        }
        else {
            await this._engine?.setProvider(this.currentProvider);
        }
        return true;
    }
    /** @returns see {@link StorageProvider.load}. */
    async load() { return await this.currentProvider.load(); }
    async save(data, baseRev) {
        if (this._engine && baseRev === undefined)
            return await this._engine.save(data);
        return await this.currentProvider.save(data, baseRev ?? null);
    }
    /** @returns see {@link StorageProvider.getRemoteRevision}. */
    async getRemoteRevision() { return await this.currentProvider.getRemoteRevision(); }
    /**
     * @returns true when the active provider is connected (redirect flows
     *          never resolve — see {@link resumeAuth}).
     */
    async authenticate() {
        // Redirect-flow providers leave the page; remembering which one started
        // the flow lets resumeAuth() route the return URL to it. A popup-flow
        // provider clears any stale marker left by an abandoned redirect.
        if (this.currentProvider.authResponseParams.length > 0) {
            sessionStorage.setItem(StorageManager.PENDING_KEY, this._currentName);
        }
        else {
            sessionStorage.removeItem(StorageManager.PENDING_KEY);
        }
        const ok = await this.currentProvider.authenticate();
        if (ok) {
            this._rememberName();
            await this._engine?.init();
        }
        return ok;
    }
    /**
     * Routes an OAuth return URL to the provider that started the flow — the
     * PENDING_KEY marker first, then the connect=<name> value embedded in the
     * redirect URI as a fallback.
     * @param url the full URL the OAuth provider redirected back to.
     * @returns the auth verdict, or 'none' when the URL carries no OAuth
     *          return parameters.
     */
    async resumeAuth(url) {
        const pending = sessionStorage.getItem(StorageManager.PENDING_KEY)
            ?? url.searchParams.get('connect')
            // Providers whose redirect URI cannot carry the connect marker
            // (OneDrive — Microsoft forbids query strings) prefix it into state.
            ?? url.searchParams.get('state')?.split(':')[0];
        if (pending === 'gdrive' || pending === 'dropbox' || pending === 'onedrive') {
            this.useProviderByName(pending);
        }
        const verdict = await this.currentProvider.resumeAuth(url);
        if (verdict === 'none')
            return 'none';
        sessionStorage.removeItem(StorageManager.PENDING_KEY);
        if (verdict)
            this._rememberName();
        return verdict;
    }
    _rememberName() {
        localStorage.setItem(StorageManager.PROVIDER_KEY, this._currentName);
    }
    /**
     * Ends the session and purges the managed engine's sync state (base,
     * working copy, outbox) — the next login starts from a clean slate.
     * @returns resolves once the session is cleared.
     */
    async disconnect() {
        await this._engine?.reset();
        await this.currentProvider.disconnect();
    }
    /** @returns see {@link StorageProvider.getStatus}. */
    async getStatus() { return await this.currentProvider.getStatus(); }
    /** @returns see {@link StorageProvider.getDataLocation}. */
    async getDataLocation() { return await this.currentProvider.getDataLocation(); }
}
//# sourceMappingURL=StorageManager.js.map