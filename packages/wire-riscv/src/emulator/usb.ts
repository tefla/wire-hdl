/**
 * USB Memory Stick Driver
 *
 * Implements the BlockDevice interface for USB mass storage with hot-plug support.
 */

import { BlockDevice, BlockDeviceError, BlockDeviceErrorType } from './block-device.js';

export const USB_SECTOR_SIZE = 512;
export const USB_DEFAULT_SIZE = 16 * 1024 * 1024; // 16MB default

export enum USBDriveStatus {
  NOT_PRESENT = 0,
  READY = 1,
  WRITE_PROTECTED = 2,
  ERROR = 3,
}

/**
 * USB Memory Stick implementation with hot-plug support
 */
export class USBDrive implements BlockDevice {
  readonly sectorSize = USB_SECTOR_SIZE;
  readonly sectorCount: number;

  private data: Uint8Array;
  private present: boolean = false;
  private writeProtected: boolean;

  constructor(totalBytes: number = USB_DEFAULT_SIZE, writeProtected: boolean = false) {
    this.sectorCount = Math.floor(totalBytes / USB_SECTOR_SIZE);
    this.data = new Uint8Array(this.sectorCount * USB_SECTOR_SIZE);
    this.writeProtected = writeProtected;
  }

  get isReadOnly(): boolean {
    return this.writeProtected;
  }

  /**
   * Check if device is present
   */
  isPresent(): boolean {
    return this.present;
  }

  /**
   * Get device status
   */
  getStatus(): USBDriveStatus {
    if (!this.present) {
      return USBDriveStatus.NOT_PRESENT;
    }
    if (this.writeProtected) {
      return USBDriveStatus.WRITE_PROTECTED;
    }
    return USBDriveStatus.READY;
  }

  /**
   * Insert the USB drive (make it present)
   */
  insert(): void {
    this.present = true;
  }

  /**
   * Insert with a disk image
   */
  insertWithImage(image: Uint8Array): void {
    if (image.length > this.data.length) {
      throw new BlockDeviceError(
        BlockDeviceErrorType.IO_ERROR,
        `Image size ${image.length} exceeds device size ${this.data.length}`
      );
    }
    this.data.set(image);
    this.present = true;
  }

  /**
   * Eject the USB drive (make it not present)
   */
  eject(): void {
    this.present = false;
  }

  /**
   * Eject and return the disk image
   */
  ejectWithImage(): Uint8Array | null {
    if (!this.present) {
      return null;
    }
    const image = new Uint8Array(this.data);
    this.present = false;
    return image;
  }

  /**
   * Set write protection status
   */
  setWriteProtected(protected_: boolean): void {
    this.writeProtected = protected_;
  }

  read(sector: number, count: number): Uint8Array {
    this.checkPresent();
    this.validateAccess(sector, count);

    const offset = sector * USB_SECTOR_SIZE;
    const length = count * USB_SECTOR_SIZE;
    return new Uint8Array(this.data.buffer, offset, length);
  }

  write(sector: number, data: Uint8Array): void {
    this.checkPresent();

    if (this.writeProtected) {
      throw new BlockDeviceError(BlockDeviceErrorType.READ_ONLY, 'Device is write-protected');
    }

    const count = Math.ceil(data.length / USB_SECTOR_SIZE);
    this.validateAccess(sector, count);

    const offset = sector * USB_SECTOR_SIZE;
    const writeLength = count * USB_SECTOR_SIZE;

    for (let i = 0; i < writeLength; i++) {
      this.data[offset + i] = i < data.length ? data[i] : 0;
    }
  }

  flush(): void {
    // In-memory USB has no pending writes
  }

  /**
   * Get total device size in bytes
   */
  getTotalBytes(): number {
    return this.sectorCount * USB_SECTOR_SIZE;
  }

  /**
   * Get raw data (for debugging)
   */
  getRawData(): Uint8Array {
    return this.data;
  }

  private checkPresent(): void {
    if (!this.present) {
      throw new BlockDeviceError(BlockDeviceErrorType.IO_ERROR, 'USB device not present');
    }
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
    if (sector + count > this.sectorCount) {
      throw new BlockDeviceError(
        BlockDeviceErrorType.OUT_OF_BOUNDS,
        `Access beyond device: sector ${sector} + count ${count} > ${this.sectorCount}`
      );
    }
  }
}
