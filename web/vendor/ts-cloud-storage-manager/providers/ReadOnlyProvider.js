import { StorageProvider } from '../StorageProvider.js';
/**
 * Read-only provider: data is fetched from a plain URL (e.g. a demo dataset
 * hosted anywhere) and kept in memory only — every save is silently dropped,
 * so a page reload restores the remote content. The revision token is the
 * HTTP ETag when the server sends one.
 */
export class ReadOnlyProvider extends StorageProvider {
    dataUrl;
    /**
     * @param dataUrl the plain URL serving the JSON data file (no auth);
     *        saves are silently dropped.
     */
    constructor(dataUrl) {
        super();
        this.dataUrl = dataUrl;
    }
    init() { return Promise.resolve(true); }
    authenticate() { return Promise.resolve(true); }
    isReadOnly() { return true; }
    async load() {
        const response = await fetch(this.dataUrl);
        if (!response.ok) {
            throw new Error(`Read-only data fetch failed: HTTP ${response.status}`);
        }
        return { data: await response.json(), rev: response.headers.get('etag') };
    }
    /** Saves are dropped on purpose: edits live in memory only. */
    save() { return Promise.resolve({ status: 'saved', rev: null }); }
    getStatus() {
        return Promise.resolve({ isConnected: true, providerName: 'Read-only' });
    }
    getDataLocation() {
        return Promise.resolve(this.dataUrl);
    }
}
//# sourceMappingURL=ReadOnlyProvider.js.map