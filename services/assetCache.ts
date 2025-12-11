
// This service handles long-term storage of AI generated assets using IndexedDB.
// LocalStorage is limited to ~5MB, which fills up after 5-10 images.
// IndexedDB allows for GBs of storage, enabling permanent caching of all game assets.

const DB_NAME = 'AetherCrawl_Assets_DB';
const DB_VERSION = 1;
const STORE_NAME = 'textures';

let dbInstance: IDBDatabase | null = null;

const openDB = (): Promise<IDBDatabase> => {
    if (dbInstance) return Promise.resolve(dbInstance);

    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject("IndexedDB not supported");
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };

        request.onsuccess = (event) => {
            dbInstance = (event.target as IDBOpenDBRequest).result;
            resolve(dbInstance);
        };

        request.onerror = (event) => {
            console.error("IndexedDB error:", (event.target as IDBOpenDBRequest).error);
            reject((event.target as IDBOpenDBRequest).error);
        };
    });
};

export const getCachedAsset = async (key: string): Promise<string | null> => {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const objectStore = transaction.objectStore(STORE_NAME);
            const request = objectStore.get(key);

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = () => {
                resolve(null);
            };
        });
    } catch (e) {
        console.warn("Failed to read from AssetCache", e);
        return null;
    }
};

export const cacheAsset = async (key: string, data: string): Promise<void> => {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const objectStore = transaction.objectStore(STORE_NAME);
            const request = objectStore.put(data, key);

            request.onsuccess = () => resolve();
            request.onerror = (e) => {
                console.warn("Failed to write to AssetCache", e);
                resolve(); // Don't crash app on cache fail
            };
        });
    } catch (e) {
        console.warn("Failed to access AssetCache for writing", e);
    }
};

// Helper to clear cache if needed (e.g. via options menu in future)
export const clearAssetCache = async (): Promise<void> => {
    try {
        const db = await openDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        transaction.objectStore(STORE_NAME).clear();
    } catch(e) {}
};
