// The stable public kit — everything re-exported here is contractual.
// Anything else (provider implementations, pkce, overlayClose, and all
// members prefixed with _) is internal and free to change between versions.
// Provider contract
export { StorageProvider } from './StorageProvider.js';
// Facade
export { StorageManager } from './StorageManager.js';
// The only concrete provider apps instantiate (demo sessions, useProvider)
export { ReadOnlyProvider } from './providers/ReadOnlyProvider.js';
// Offline-first sync layer
export { SyncEngine, UNRECONCILABLE } from './sync/SyncEngine.js';
export { MemoryStore, IdbStore } from './sync/LocalStore.js';
//# sourceMappingURL=index.js.map