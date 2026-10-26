/**
 * Abstract base class for storage providers.
 * Subclasses must implement authentication, data load/save and status retrieval.
 */
export class StorageProvider {
    /**
     * Restores a persisted session (tokens in localStorage) without user
     * interaction.
     * @returns true when a usable session was restored.
     */
    init() { return Promise.resolve(false); }
    /**
     * Query-string parameters this provider produces on the OAuth return URL
     * (redirect flows only — e.g. ['code','state','error']). They are stripped
     * by the URL cleanup once consumed. Providers with a JS-callback flow
     * (Google GIS popup) keep the empty default.
     */
    authResponseParams = [];
    /**
     * Redirect-flow providers: consumes the OAuth return parameters present in
     * the URL after the provider sent the browser back (exchanges the code,
     * checks the anti-CSRF state...). Returns 'none' when the URL carries
     * nothing this provider recognizes, true/false for the auth verdict.
     * Popup-flow providers keep the default no-op.
     * @param _url the URL the provider sent the browser back to.
     * @returns 'none' when the URL carries no OAuth parameter for this
     *          provider, otherwise the auth verdict.
     */
    resumeAuth(_url) { return Promise.resolve('none'); }
    /**
     * Ends the session and clears stored credentials (tokens, file id).
     * @returns resolves once credentials are cleared.
     */
    disconnect() { return Promise.resolve(); }
    /**
     * Reads the current remote revision without downloading the file content
     * (metadata only). Auth errors are thrown so callers can stop polling on
     * a dead session.
     * @returns the current rev, or null when the file is absent or its
     *          revision indeterminable.
     */
    getRemoteRevision() { return Promise.resolve(null); }
    /**
     * @returns a human-readable description of where the data is stored
     *          (account, file path...), or null when it is unknown.
     */
    getDataLocation() { return Promise.resolve(null); }
    /**
     * @returns true when this provider silently drops saves (read-only data):
     *          the UI warns the user that changes live in memory only.
     */
    isReadOnly() { return false; }
    /**
     * @returns why the last interactive authenticate() attempt failed,
     *          classified for the UI (see AuthFailure.ts); null when no
     *          attempt failed.
     */
    getAuthFailure() { return null; }
}
//# sourceMappingURL=StorageProvider.js.map