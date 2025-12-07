// Persistent Disk Storage using IndexedDB
// Stores disk sectors that persist across page refreshes

const DB_NAME = 'wireos-disk';
const DB_VERSION = 1;
const STORE_NAME = 'sectors';

export class PersistentDisk {
  private db: IDBDatabase | null = null;
  private cache: Map<number, Uint8Array> = new Map();
  private dirty: Set<number> = new Set();
  private flushTimeout: number | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
    });
  }

  async getSector(sector: number): Promise<Uint8Array> {
    // Check cache first
    if (this.cache.has(sector)) {
      return this.cache.get(sector)!;
    }

    // Load from IndexedDB
    if (this.db) {
      const data = await this.loadSectorFromDB(sector);
      if (data) {
        this.cache.set(sector, data);
        return data;
      }
    }

    // Return empty sector
    const empty = new Uint8Array(512);
    this.cache.set(sector, empty);
    return empty;
  }

  loadSector(sector: number, data: Uint8Array): void {
    this.cache.set(sector, new Uint8Array(data));
    this.dirty.add(sector);
    this.scheduleFlush();
  }

  private async loadSectorFromDB(sector: number): Promise<Uint8Array | null> {
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(sector);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        if (request.result) {
          resolve(new Uint8Array(request.result));
        } else {
          resolve(null);
        }
      };
    });
  }

  private scheduleFlush(): void {
    if (this.flushTimeout !== null) return;
    this.flushTimeout = window.setTimeout(() => {
      this.flush();
      this.flushTimeout = null;
    }, 100);
  }

  async flush(): Promise<void> {
    if (!this.db || this.dirty.size === 0) return;

    const tx = this.db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    for (const sector of this.dirty) {
      const data = this.cache.get(sector);
      if (data) {
        store.put(data.buffer, sector);
      }
    }

    this.dirty.clear();

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.dirty.clear();

    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // Export all sectors as a blob for download
  async exportDisk(): Promise<Blob> {
    await this.flush();

    const sectors: { [key: number]: number[] } = {};
    for (const [sector, data] of this.cache) {
      sectors[sector] = Array.from(data);
    }

    const json = JSON.stringify(sectors);
    return new Blob([json], { type: 'application/json' });
  }

  // Import sectors from a blob
  async importDisk(blob: Blob): Promise<void> {
    const text = await blob.text();
    const sectors = JSON.parse(text);

    await this.clear();

    for (const [sectorStr, data] of Object.entries(sectors)) {
      const sector = parseInt(sectorStr);
      this.loadSector(sector, new Uint8Array(data as number[]));
    }

    await this.flush();
  }
}
