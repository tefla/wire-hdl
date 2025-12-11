/**
 * Hard Disk Drive (HDD) Driver
 *
 * Implements the BlockDevice interface for hard disk storage.
 */

import { BlockDevice, BlockDeviceError, BlockDeviceErrorType } from './block-device.js';

export const HDD_SECTOR_SIZE = 512;
export const HDD_DEFAULT_SIZE = 64 * 1024 * 1024; // 64MB default
export const MBR_SIGNATURE = 0xaa55;

/**
 * MBR Partition Entry
 */
export interface PartitionEntry {
  active: boolean;
  type: number;
  lbaStart: number;
  sectorCount: number;
}

/**
 * Hard Disk Drive implementation
 */
export class HardDiskDrive implements BlockDevice {
  readonly sectorSize = HDD_SECTOR_SIZE;
  readonly sectorCount: number;
  readonly isReadOnly = false;

  private data: Uint8Array;

  constructor(totalBytes: number = HDD_DEFAULT_SIZE) {
    this.sectorCount = Math.floor(totalBytes / HDD_SECTOR_SIZE);
    this.data = new Uint8Array(this.sectorCount * HDD_SECTOR_SIZE);
  }

  /**
   * Create HDD from disk image
   */
  static fromImage(image: Uint8Array): HardDiskDrive {
    const hdd = new HardDiskDrive(image.length);
    hdd.data.set(image);
    return hdd;
  }

  read(sector: number, count: number): Uint8Array {
    this.validateAccess(sector, count);

    const offset = sector * HDD_SECTOR_SIZE;
    const length = count * HDD_SECTOR_SIZE;
    return new Uint8Array(this.data.buffer, offset, length);
  }

  write(sector: number, data: Uint8Array): void {
    const count = Math.ceil(data.length / HDD_SECTOR_SIZE);
    this.validateAccess(sector, count);

    const offset = sector * HDD_SECTOR_SIZE;
    const writeLength = count * HDD_SECTOR_SIZE;

    for (let i = 0; i < writeLength; i++) {
      this.data[offset + i] = i < data.length ? data[i] : 0;
    }
  }

  flush(): void {
    // In-memory HDD has no pending writes
    // In a browser environment, this would sync to IndexedDB
  }

  /**
   * Get total disk size in bytes
   */
  getTotalBytes(): number {
    return this.sectorCount * HDD_SECTOR_SIZE;
  }

  /**
   * Export the disk as a raw image
   */
  exportImage(): Uint8Array {
    return new Uint8Array(this.data);
  }

  /**
   * Import a raw disk image
   */
  importImage(image: Uint8Array): void {
    if (image.length !== this.data.length) {
      throw new BlockDeviceError(
        BlockDeviceErrorType.IO_ERROR,
        `Image size ${image.length} does not match disk size ${this.data.length}`
      );
    }
    this.data.set(image);
  }

  /**
   * Initialize the disk with an empty MBR
   */
  initializeMBR(): void {
    const mbr = createEmptyMBR();
    this.write(0, mbr);
  }

  /**
   * Get the partition table from sector 0
   */
  getPartitionTable(): PartitionEntry[] {
    const mbr = this.read(0, 1);
    return parseMBRPartitionTable(mbr);
  }

  /**
   * Get the raw data buffer (for debugging/testing)
   */
  getRawData(): Uint8Array {
    return this.data;
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
        `Access beyond disk: sector ${sector} + count ${count} > ${this.sectorCount}`
      );
    }
  }
}

/**
 * Create an empty MBR with boot signature
 */
export function createEmptyMBR(): Uint8Array {
  const mbr = new Uint8Array(512);

  // Set boot signature at offset 510-511
  mbr[510] = MBR_SIGNATURE & 0xff;
  mbr[511] = (MBR_SIGNATURE >> 8) & 0xff;

  return mbr;
}

/**
 * Parse MBR partition table
 */
export function parseMBRPartitionTable(mbr: Uint8Array): PartitionEntry[] {
  const partitions: PartitionEntry[] = [];

  // Check for valid MBR signature
  const signature = mbr[510] | (mbr[511] << 8);
  const isValidMBR = signature === MBR_SIGNATURE;

  // Partition table starts at offset 446, each entry is 16 bytes
  for (let i = 0; i < 4; i++) {
    const offset = 446 + i * 16;

    if (!isValidMBR) {
      partitions.push({
        active: false,
        type: 0,
        lbaStart: 0,
        sectorCount: 0,
      });
      continue;
    }

    const active = mbr[offset + 0] === 0x80;
    const type = mbr[offset + 4];

    // LBA start (little-endian 32-bit)
    const lbaStart =
      mbr[offset + 8] |
      (mbr[offset + 9] << 8) |
      (mbr[offset + 10] << 16) |
      (mbr[offset + 11] << 24);

    // Sector count (little-endian 32-bit)
    const sectorCount =
      mbr[offset + 12] |
      (mbr[offset + 13] << 8) |
      (mbr[offset + 14] << 16) |
      (mbr[offset + 15] << 24);

    partitions.push({
      active,
      type,
      lbaStart: lbaStart >>> 0, // Convert to unsigned
      sectorCount: sectorCount >>> 0,
    });
  }

  return partitions;
}
