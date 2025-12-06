// Disk Drive for the Wire-HDL Computer System
// 32MB virtual disk with 512-byte sectors

export const DISK = {
  SECTOR_SIZE: 512,
  MAX_SECTORS: 65536, // 32MB
  TOTAL_SIZE: 512 * 65536,
};

// Disk status bits
export const DISK_STATUS = {
  READY: 0x01,
  BUSY: 0x02,
  ERROR: 0x80,
};

// Disk commands
export const DISK_CMD = {
  READ: 0x01,
  WRITE: 0x02,
  SEEK: 0x03,
};

export class Disk {
  private data: Uint8Array;
  private status: number = DISK_STATUS.READY;
  private currentSector: number = 0;

  // Callback to access memory for DMA transfers
  private readMemory: (addr: number) => number;
  private writeMemory: (addr: number, value: number) => void;

  constructor(
    readMemory: (addr: number) => number,
    writeMemory: (addr: number, value: number) => void
  ) {
    this.data = new Uint8Array(DISK.TOTAL_SIZE);
    this.readMemory = readMemory;
    this.writeMemory = writeMemory;
  }

  /**
   * Get the current disk status
   */
  getStatus(): number {
    return this.status;
  }

  /**
   * Execute a disk command
   */
  executeCommand(
    cmd: number,
    sector: number,
    bufferAddr: number,
    count: number
  ): void {
    if (this.status & DISK_STATUS.BUSY) {
      return; // Already busy
    }

    switch (cmd) {
      case DISK_CMD.READ:
        this.read(sector, bufferAddr, count);
        break;
      case DISK_CMD.WRITE:
        this.write(sector, bufferAddr, count);
        break;
      case DISK_CMD.SEEK:
        this.seek(sector);
        break;
    }
  }

  /**
   * Read sectors from disk to memory
   */
  private read(sector: number, bufferAddr: number, count: number): void {
    this.status = DISK_STATUS.BUSY;

    for (let s = 0; s < count; s++) {
      const sectorNum = sector + s;
      if (sectorNum >= DISK.MAX_SECTORS) {
        this.status = DISK_STATUS.ERROR;
        return;
      }

      const diskOffset = sectorNum * DISK.SECTOR_SIZE;
      const memOffset = bufferAddr + s * DISK.SECTOR_SIZE;

      for (let i = 0; i < DISK.SECTOR_SIZE; i++) {
        this.writeMemory(memOffset + i, this.data[diskOffset + i]);
      }
    }

    this.currentSector = sector + count;
    this.status = DISK_STATUS.READY;
  }

  /**
   * Write sectors from memory to disk
   */
  private write(sector: number, bufferAddr: number, count: number): void {
    this.status = DISK_STATUS.BUSY;

    for (let s = 0; s < count; s++) {
      const sectorNum = sector + s;
      if (sectorNum >= DISK.MAX_SECTORS) {
        this.status = DISK_STATUS.ERROR;
        return;
      }

      const diskOffset = sectorNum * DISK.SECTOR_SIZE;
      const memOffset = bufferAddr + s * DISK.SECTOR_SIZE;

      for (let i = 0; i < DISK.SECTOR_SIZE; i++) {
        this.data[diskOffset + i] = this.readMemory(memOffset + i);
      }
    }

    this.currentSector = sector + count;
    this.status = DISK_STATUS.READY;
  }

  /**
   * Seek to a sector (just updates current sector)
   */
  private seek(sector: number): void {
    if (sector >= DISK.MAX_SECTORS) {
      this.status = DISK_STATUS.ERROR;
      return;
    }
    this.currentSector = sector;
    this.status = DISK_STATUS.READY;
  }

  /**
   * Load disk image from a Uint8Array
   */
  loadImage(data: Uint8Array, offset: number = 0): void {
    const maxSize = this.data.length - offset;
    const copySize = Math.min(data.length, maxSize);
    this.data.set(data.subarray(0, copySize), offset);
  }

  /**
   * Load data to a specific sector
   */
  loadSector(sector: number, data: Uint8Array): void {
    if (sector >= DISK.MAX_SECTORS) return;
    const offset = sector * DISK.SECTOR_SIZE;
    const copySize = Math.min(data.length, DISK.SECTOR_SIZE);
    this.data.set(data.subarray(0, copySize), offset);
  }

  /**
   * Get a sector's data (for debugging/export)
   */
  getSector(sector: number): Uint8Array {
    if (sector >= DISK.MAX_SECTORS) return new Uint8Array(DISK.SECTOR_SIZE);
    const offset = sector * DISK.SECTOR_SIZE;
    return this.data.slice(offset, offset + DISK.SECTOR_SIZE);
  }

  /**
   * Get the entire disk image (for export/persistence)
   */
  getImage(): Uint8Array {
    return this.data;
  }

  /**
   * Format the disk (fill with zeros)
   */
  format(): void {
    this.data.fill(0);
    this.status = DISK_STATUS.READY;
    this.currentSector = 0;
  }

  /**
   * Save disk image to IndexedDB (browser persistence)
   */
  async save(dbName: string = 'wire-computer', storeName: string = 'disk'): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);

      request.onerror = () => reject(request.error);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);

        store.put(this.data, 'image');

        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
    });
  }

  /**
   * Load disk image from IndexedDB (browser persistence)
   */
  async load(dbName: string = 'wire-computer', storeName: string = 'disk'): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);

      request.onerror = () => reject(request.error);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);

        const getRequest = store.get('image');

        getRequest.onsuccess = () => {
          if (getRequest.result) {
            this.data.set(new Uint8Array(getRequest.result));
            db.close();
            resolve(true);
          } else {
            db.close();
            resolve(false);
          }
        };

        getRequest.onerror = () => {
          db.close();
          reject(getRequest.error);
        };
      };
    });
  }
}
