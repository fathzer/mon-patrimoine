/** In-memory LocalStore — used by the test suite under Bun (no IndexedDB). */
export class MemoryStore {
    _map = new Map();
    get(key) { return Promise.resolve(this._map.get(key)); }
    set(key, value) { this._map.set(key, value); return Promise.resolve(); }
    delete(key) { this._map.delete(key); return Promise.resolve(); }
}
/** IndexedDB-backed LocalStore, a single object store of key → value. */
export class IdbStore {
    _dbName;
    _storeName;
    _db = null;
    /**
     * @param dbName the IndexedDB database name.
     * @param storeName the object-store name inside the database.
     */
    constructor(dbName = 'cloud-sync', storeName = 'state') {
        this._dbName = dbName;
        this._storeName = storeName;
    }
    _open() {
        this._db ??= new Promise((resolve, reject) => {
            const req = indexedDB.open(this._dbName, 1);
            req.onupgradeneeded = () => req.result.createObjectStore(this._storeName);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        return this._db;
    }
    _tx(mode) {
        return this._open().then(db => db.transaction(this._storeName, mode).objectStore(this._storeName));
    }
    async get(key) {
        const store = await this._tx('readonly');
        return await new Promise((resolve, reject) => {
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    async set(key, value) {
        const store = await this._tx('readwrite');
        await new Promise((resolve, reject) => {
            const req = store.put(value, key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }
    async delete(key) {
        const store = await this._tx('readwrite');
        await new Promise((resolve, reject) => {
            const req = store.delete(key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }
}
//# sourceMappingURL=LocalStore.js.map