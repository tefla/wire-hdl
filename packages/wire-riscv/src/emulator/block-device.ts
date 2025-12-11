/**
 * Block Device Abstraction Layer
 *
 * Provides a common interface for all storage devices in the emulator.
 */

export enum BlockDeviceErrorType {
  OUT_OF_BOUNDS = 'OUT_OF_BOUNDS',
  READ_ONLY = 'READ_ONLY',
  INVALID_COUNT = 'INVALID_COUNT',
  IO_ERROR = 'IO_ERROR',
}

export class BlockDeviceError extends Error {
  constructor(
    public readonly type: BlockDeviceErrorType,
    message: string
  ) {
    super(message);
    this.name = 'BlockDeviceError';
  }
}

/**
 * Block device interface that all storage drivers must implement
 */
export interface BlockDevice {
  /** Size of each sector in bytes (typically 512 or 2048) */
  readonly sectorSize: number;

  /** Total number of sectors on the device */
  readonly sectorCount: number;

  /** Whether the device is read-only */
  readonly isReadOnly: boolean;

  /**
   * Read sectors from the device
   * @param sector Starting sector number
   * @param count Number of sectors to read
   * @returns Uint8Array containing the read data
   * @throws BlockDeviceError on failure
   */
  read(sector: number, count: number): Uint8Array;

  /**
   * Write sectors to the device
   * @param sector Starting sector number
   * @param data Data to write (may be less than count * sectorSize)
   * @throws BlockDeviceError on failure or if read-only
   */
  write(sector: number, data: Uint8Array): void;

  /**
   * Flush any pending writes to the device
   * @throws BlockDeviceError on failure
   */
  flush(): void;
}

/**
 * Memory-backed block device for testing and RAM disks
 */
export class MemoryBlockDevice implements BlockDevice {
  readonly sectorSize: number;
  readonly sectorCount: number;
  readonly isReadOnly: boolean;
  private data: Uint8Array;

  constructor(totalSize: number, sectorSize: number = 512, readOnly: boolean = false) {
    this.sectorSize = sectorSize;
    this.sectorCount = Math.floor(totalSize / sectorSize);
    this.isReadOnly = readOnly;
    this.data = new Uint8Array(this.sectorCount * sectorSize);
  }

  read(sector: number, count: number): Uint8Array {
    this.validateRead(sector, count);

    const offset = sector * this.sectorSize;
    const length = count * this.sectorSize;
    return new Uint8Array(this.data.buffer, offset, length);
  }

  write(sector: number, data: Uint8Array): void {
    if (this.isReadOnly) {
      throw new BlockDeviceError(BlockDeviceErrorType.READ_ONLY, 'Device is read-only');
    }

    const count = Math.ceil(data.length / this.sectorSize);
    this.validateWrite(sector, count);

    const offset = sector * this.sectorSize;
    const writeLength = count * this.sectorSize;

    // Copy data, padding with zeros if needed
    for (let i = 0; i < writeLength; i++) {
      this.data[offset + i] = i < data.length ? data[i] : 0;
    }
  }

  flush(): void {
    // Memory device has no pending writes
  }

  /**
   * Get raw device data (for debugging/testing)
   */
  getRawData(): Uint8Array {
    return this.data;
  }

  /**
   * Set raw device data (for initialization)
   */
  setRawData(data: Uint8Array): void {
    if (data.length > this.data.length) {
      throw new BlockDeviceError(
        BlockDeviceErrorType.OUT_OF_BOUNDS,
        'Data exceeds device size'
      );
    }
    this.data.set(data);
  }

  private validateRead(sector: number, count: number): void {
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
        `Read beyond device: sector ${sector} + count ${count} > ${this.sectorCount}`
      );
    }
  }

  private validateWrite(sector: number, count: number): void {
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
        `Write beyond device: sector ${sector} + count ${count} > ${this.sectorCount}`
      );
    }
  }
}

/**
 * Operation record for mock device
 */
export interface BlockDeviceOperation {
  type: 'read' | 'write' | 'flush';
  sector: number;
  count: number;
  data?: Uint8Array;
}

/**
 * Mock block device for testing
 */
export class MockBlockDevice implements BlockDevice {
  readonly sectorSize: number;
  readonly sectorCount: number;
  readonly isReadOnly: boolean;

  private sectorData: Map<number, Uint8Array> = new Map();
  private writtenData: Map<number, Uint8Array> = new Map();
  private operations: BlockDeviceOperation[] = [];
  private failOnRead: boolean = false;
  private failOnWrite: boolean = false;

  constructor(sectorCount: number, sectorSize: number = 512, readOnly: boolean = false) {
    this.sectorCount = sectorCount;
    this.sectorSize = sectorSize;
    this.isReadOnly = readOnly;
  }

  read(sector: number, count: number): Uint8Array {
    this.operations.push({ type: 'read', sector, count });

    if (this.failOnRead) {
      throw new BlockDeviceError(BlockDeviceErrorType.IO_ERROR, 'Simulated read error');
    }

    const result = new Uint8Array(count * this.sectorSize);

    for (let i = 0; i < count; i++) {
      const sectorNum = sector + i;
      const data = this.sectorData.get(sectorNum);
      if (data) {
        result.set(data, i * this.sectorSize);
      }
      // Unconfigured sectors remain as zeros
    }

    return result;
  }

  write(sector: number, data: Uint8Array): void {
    const count = Math.ceil(data.length / this.sectorSize);
    this.operations.push({ type: 'write', sector, count, data: new Uint8Array(data) });

    if (this.failOnWrite) {
      throw new BlockDeviceError(BlockDeviceErrorType.IO_ERROR, 'Simulated write error');
    }

    if (this.isReadOnly) {
      throw new BlockDeviceError(BlockDeviceErrorType.READ_ONLY, 'Device is read-only');
    }

    // Store written data
    for (let i = 0; i < count; i++) {
      const sectorNum = sector + i;
      const sectorOffset = i * this.sectorSize;
      const sectorData = new Uint8Array(this.sectorSize);

      for (let j = 0; j < this.sectorSize; j++) {
        if (sectorOffset + j < data.length) {
          sectorData[j] = data[sectorOffset + j];
        }
      }

      this.writtenData.set(sectorNum, sectorData);
    }
  }

  flush(): void {
    this.operations.push({ type: 'flush', sector: 0, count: 0 });
  }

  // Mock configuration methods

  /**
   * Set data that will be returned when reading a specific sector
   */
  setSectorData(sector: number, data: Uint8Array): void {
    const copy = new Uint8Array(this.sectorSize);
    copy.set(data.slice(0, this.sectorSize));
    this.sectorData.set(sector, copy);
  }

  /**
   * Get data that was written to a specific sector
   */
  getWrittenData(sector: number): Uint8Array | undefined {
    return this.writtenData.get(sector);
  }

  /**
   * Get all recorded operations
   */
  getOperations(): BlockDeviceOperation[] {
    return [...this.operations];
  }

  /**
   * Clear recorded operations
   */
  clearOperations(): void {
    this.operations = [];
  }

  /**
   * Configure device to fail on read operations
   */
  setFailOnRead(fail: boolean): void {
    this.failOnRead = fail;
  }

  /**
   * Configure device to fail on write operations
   */
  setFailOnWrite(fail: boolean): void {
    this.failOnWrite = fail;
  }
}
