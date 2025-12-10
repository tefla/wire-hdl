// Persistent Disk Storage using IndexedDB
// Stores disk sectors that persist across page refreshes

const DB_NAME = 'wireos-disk';
const DB_VERSION = 1;
const STORE_NAME = 'sectors';

const META_KEY = '__meta__';
const DEFAULT_VOLUME = 'hdd0';

interface DiskMeta {
  version: 2;
  activeVolume: string;
  volumes: string[];
}

export class PersistentDisk {
  private db: IDBDatabase | null = null;
  private cache: Map<string, Uint8Array> = new Map();
  private dirty: Set<string> = new Set();
  private flushTimeout: number | null = null;
  private meta: DiskMeta = {
    version: 2,
    activeVolume: DEFAULT_VOLUME,
    volumes: [DEFAULT_VOLUME],
  };

  async init(): Promise<void> {
    this.db = await this.openDatabase();
    await this.loadMeta();
  }

  private async openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
    });
  }

  private keyForSector(sector: number, volume: string = this.meta.activeVolume): string {
    return `${volume}:${sector}`;
  }

  private parseKey(key: IDBValidKey): { volume: string; sector: number } {
    const str = String(key);
    if (str.includes(':')) {
      const [volume, sectorStr] = str.split(':');
      return { volume, sector: parseInt(sectorStr, 10) };
    }
    return { volume: DEFAULT_VOLUME, sector: parseInt(str, 10) };
  }

  private async loadMeta(): Promise<void> {
    if (!this.db) return;

    const metaFromDb = await this.loadMetaFromDB();
    if (metaFromDb) {
      this.meta = metaFromDb;
      return;
    }

    // Legacy DB without meta entry: discover existing keys and persist metadata
    const discovered = new Set<string>();
    const existing = await this.readAllSectors();
    for (const key of existing.keys()) {
      const parsed = this.parseKey(key);
      discovered.add(parsed.volume);
    }
    if (discovered.size === 0) {
      discovered.add(DEFAULT_VOLUME);
    }

    const first = discovered.values().next().value || DEFAULT_VOLUME;
    this.meta = {
      version: 2,
      activeVolume: first,
      volumes: Array.from(discovered),
    };
    await this.saveMeta();
  }

  private async loadMetaFromDB(): Promise<DiskMeta | null> {
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(META_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result as DiskMeta);
        } else {
          resolve(null);
        }
      };
    });
  }

  private async saveMeta(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(this.meta, META_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  getActiveVolume(): string {
    return this.meta.activeVolume;
  }

  listVolumes(): string[] {
    return [...this.meta.volumes];
  }

  async setActiveVolume(volume: string, createIfMissing = true): Promise<void> {
    if (volume === this.meta.activeVolume) return;

    if (createIfMissing && !this.meta.volumes.includes(volume)) {
      this.meta.volumes.push(volume);
    } else if (!this.meta.volumes.includes(volume)) {
      throw new Error(`Volume ${volume} does not exist`);
    }

    await this.flush();
    this.cache.clear();
    this.dirty.clear();

    this.meta.activeVolume = volume;
    await this.saveMeta();
  }

  async createVolume(name: string, switchTo: boolean = true): Promise<void> {
    if (!this.meta.volumes.includes(name)) {
      this.meta.volumes.push(name);
    }
    if (switchTo) {
      await this.setActiveVolume(name, true);
    } else {
      await this.saveMeta();
    }
  }

  async deleteVolume(name: string): Promise<void> {
    if (!this.meta.volumes.includes(name)) return;
    if (this.meta.volumes.length <= 1) return; // keep at least one volume

    await this.flush();
    await this.removeVolumeData(name);

    this.meta.volumes = this.meta.volumes.filter((v) => v !== name);
    if (this.meta.activeVolume === name) {
      this.meta.activeVolume = this.meta.volumes[0] || DEFAULT_VOLUME;
    }

    this.cache.clear();
    this.dirty.clear();
    await this.saveMeta();
  }

  private async removeVolumeData(volume: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.openCursor();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result as IDBCursorWithValue | null;
        if (!cursor) return;

        const parsed = this.parseKey(cursor.key);
        if (parsed.volume === volume) {
          cursor.delete();
        }
        cursor.continue();
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getSector(sector: number): Promise<Uint8Array> {
    const key = this.keyForSector(sector);

    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    // Load from IndexedDB
    if (this.db) {
      const data = await this.loadSectorFromDB(key);
      if (data) {
        this.cache.set(key, data);
        return data;
      }
    }

    // Return empty sector
    const empty = new Uint8Array(512);
    this.cache.set(key, empty);
    return empty;
  }

  loadSector(sector: number, data: Uint8Array): void {
    const key = this.keyForSector(sector);
    this.cache.set(key, new Uint8Array(data));
    this.dirty.add(key);
    this.scheduleFlush();
  }

  private async loadSectorFromDB(key: string): Promise<Uint8Array | null> {
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        if (request.result) {
          resolve(new Uint8Array(request.result));
        } else {
          // Fallback to legacy layout (no volume prefix)
          const legacyKey = key.includes(':') ? parseInt(key.split(':')[1], 10) : NaN;
          if (!Number.isNaN(legacyKey)) {
            const legacyRequest = store.get(legacyKey);
            legacyRequest.onerror = () => reject(legacyRequest.error);
            legacyRequest.onsuccess = () => {
              if (legacyRequest.result) {
                resolve(new Uint8Array(legacyRequest.result));
              } else {
                resolve(null);
              }
            };
            return;
          }
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

    for (const key of this.dirty) {
      const data = this.cache.get(key);
      if (data) {
        store.put(data.buffer, key);
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
    this.meta = { version: 2, activeVolume: DEFAULT_VOLUME, volumes: [DEFAULT_VOLUME] };

    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      store.put(this.meta, META_KEY);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private async readAllSectors(): Promise<Map<string, Uint8Array>> {
    const result = new Map<string, Uint8Array>();
    if (!this.db) return result;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.openCursor();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result as IDBCursorWithValue | null;
        if (!cursor) return;

        if (cursor.key !== META_KEY) {
          result.set(String(cursor.key), new Uint8Array(cursor.value));
        }
        cursor.continue();
      };

      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
    });
  }

  // Export all sectors as a blob for download
  async exportDisk(): Promise<Blob> {
    await this.flush();

    const sectors = await this.readAllSectors();
    const exportPayload: {
      version: number;
      meta: DiskMeta;
      volumes: Record<string, Record<number, number[]>>;
    } = {
      version: 2,
      meta: this.meta,
      volumes: {},
    };

    for (const [key, data] of sectors) {
      if (key === META_KEY) continue;
      const { volume, sector } = this.parseKey(key);
      if (!exportPayload.volumes[volume]) {
        exportPayload.volumes[volume] = {};
      }
      exportPayload.volumes[volume][sector] = Array.from(data);
    }

    const json = JSON.stringify(exportPayload);
    return new Blob([json], { type: 'application/json' });
  }

  // Import sectors from a blob
  async importDisk(blob: Blob): Promise<void> {
    const text = await blob.text();
    const parsed = JSON.parse(text);

    await this.clear();

    // New format includes meta + volumes
    if (parsed && parsed.version === 2 && parsed.volumes) {
      const volumes = Object.keys(parsed.volumes as Record<string, unknown>);
      this.meta = {
        version: 2,
        activeVolume:
          parsed.meta?.activeVolume && volumes.includes(parsed.meta.activeVolume)
            ? parsed.meta.activeVolume
            : volumes[0] || DEFAULT_VOLUME,
        volumes: volumes.length > 0 ? volumes : [DEFAULT_VOLUME],
      };

      for (const [volume, sectorMap] of Object.entries(
        parsed.volumes as Record<string, Record<string, number[]>>
      )) {
        for (const [sectorStr, data] of Object.entries(sectorMap)) {
          const sector = parseInt(sectorStr, 10);
          const key = this.keyForSector(sector, volume);
          this.cache.set(key, new Uint8Array(data as number[]));
          this.dirty.add(key);
        }
      }
    } else {
      // Legacy format: flat map of sector -> data for default volume
      for (const [sectorStr, data] of Object.entries(parsed as Record<string, number[]>)) {
        const sector = parseInt(sectorStr, 10);
        const key = this.keyForSector(sector, this.meta.activeVolume);
        this.cache.set(key, new Uint8Array(data as number[]));
        this.dirty.add(key);
      }
      this.meta = { version: 2, activeVolume: DEFAULT_VOLUME, volumes: [DEFAULT_VOLUME] };
    }

    await this.saveMeta();
    await this.flush();
  }
}
