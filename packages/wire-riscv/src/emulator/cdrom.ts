/**
 * CD-ROM Drive Driver
 *
 * Implements the BlockDevice interface for read-only optical media (ISO images).
 */

import { BlockDevice, BlockDeviceError, BlockDeviceErrorType } from './block-device.js';

export const CDROM_SECTOR_SIZE = 2048;
export const ISO9660_MAGIC = 'CD001';

export enum CDROMStatus {
  NO_DISC = 0,
  TRAY_OPEN = 1,
  READY = 2,
  READING = 3,
  ERROR = 4,
}

/**
 * CD-ROM Drive implementation for ISO images
 */
export class CDROMDrive implements BlockDevice {
  readonly sectorSize = CDROM_SECTOR_SIZE;
  readonly isReadOnly = true;

  private data: Uint8Array | null = null;
  private _sectorCount: number = 0;
  private trayOpen: boolean = false;

  get sectorCount(): number {
    return this._sectorCount;
  }

  /**
   * Check if a disc is inserted
   */
  hasDisc(): boolean {
    return this.data !== null;
  }

  /**
   * Check if the tray is open
   */
  isTrayOpen(): boolean {
    return this.trayOpen;
  }

  /**
   * Get drive status
   */
  getStatus(): CDROMStatus {
    if (this.trayOpen) {
      return CDROMStatus.TRAY_OPEN;
    }
    if (!this.data) {
      return CDROMStatus.NO_DISC;
    }
    return CDROMStatus.READY;
  }

  /**
   * Insert a disc (ISO image)
   */
  insertDisc(iso: Uint8Array): void {
    this.data = new Uint8Array(iso);
    this._sectorCount = Math.floor(iso.length / CDROM_SECTOR_SIZE);
    this.trayOpen = false;
  }

  /**
   * Eject the disc
   */
  ejectDisc(): void {
    this.data = null;
    this._sectorCount = 0;
    this.trayOpen = true;
  }

  /**
   * Open the tray (ejects disc if present)
   */
  openTray(): void {
    if (this.data) {
      this.ejectDisc();
    } else {
      this.trayOpen = true;
    }
  }

  /**
   * Close the tray
   */
  closeTray(): void {
    this.trayOpen = false;
  }

  read(sector: number, count: number): Uint8Array {
    if (!this.data) {
      throw new BlockDeviceError(BlockDeviceErrorType.IO_ERROR, 'No disc in drive');
    }

    this.validateAccess(sector, count);

    const offset = sector * CDROM_SECTOR_SIZE;
    const length = count * CDROM_SECTOR_SIZE;
    return new Uint8Array(this.data.buffer, offset, length);
  }

  write(_sector: number, _data: Uint8Array): void {
    throw new BlockDeviceError(BlockDeviceErrorType.READ_ONLY, 'CD-ROM is read-only');
  }

  flush(): void {
    // CD-ROM is read-only, nothing to flush
  }

  /**
   * Get ISO image (for debugging)
   */
  getISOData(): Uint8Array | null {
    return this.data ? new Uint8Array(this.data) : null;
  }

  private validateAccess(sector: number, count: number): void {
    if (sector < 0) {
      throw new BlockDeviceError(
        BlockDeviceErrorType.OUT_OF_BOUNDS,
        `Invalid sector number: ${sector}`
      );
    }
    if (count <= 0) {
      throw new BlockDeviceError(
        BlockDeviceErrorType.INVALID_COUNT,
        `Invalid count: ${count}`
      );
    }
    if (sector + count > this._sectorCount) {
      throw new BlockDeviceError(
        BlockDeviceErrorType.OUT_OF_BOUNDS,
        `Read beyond disc: sector ${sector} + count ${count} > ${this._sectorCount}`
      );
    }
  }
}

/**
 * Create a minimal ISO image for testing
 */
export function createMinimalISO(sectorCount: number): Uint8Array {
  return new Uint8Array(sectorCount * CDROM_SECTOR_SIZE);
}
