/**
 * Storage Controller
 *
 * Memory-mapped I/O controller that manages all storage devices.
 */

import { BlockDevice, BlockDeviceError } from './block-device.js';
import { HardDiskDrive } from './hdd.js';
import { CDROMDrive } from './cdrom.js';
import { USBDrive } from './usb.js';

export const STORAGE_BASE = 0x20000000;
export const STORAGE_REGS_SIZE = 0x100;
export const DMA_BUFFER_OFFSET = 0x10000;
export const DMA_BUFFER_SIZE = 64 * 1024; // 64KB

export const STORAGE_REGS = {
  DEVICE_SELECT: 0x00,
  COMMAND: 0x04,
  STATUS: 0x08,
  SECTOR_LO: 0x0c,
  SECTOR_HI: 0x10,
  COUNT: 0x14,
  DMA_ADDR: 0x18,
} as const;

export enum StorageCommand {
  NOP = 0x00,
  READ = 0x01,
  WRITE = 0x02,
  FLUSH = 0x03,
  GET_INFO = 0x04,
}

export enum StorageStatus {
  READY = 0x01,
  BUSY = 0x02,
  ERROR = 0x04,
  DRQ = 0x08, // Data request
}

export enum DeviceType {
  HDD = 0,
  CDROM = 1,
  USB = 2,
}

export interface DeviceInfo {
  sectorSize: number;
  sectorCount: number;
  isReadOnly: boolean;
  isPresent: boolean;
}

/**
 * Storage Controller managing HDD, CD-ROM, and USB devices
 */
export class StorageController {
  private hdd: HardDiskDrive;
  private cdrom: CDROMDrive;
  private usb: USBDrive;

  // Registers
  private deviceSelect: number = 0;
  private sectorLo: number = 0;
  private sectorHi: number = 0;
  private count: number = 0;
  private dmaAddr: number = DMA_BUFFER_OFFSET + STORAGE_BASE;
  private status: number = StorageStatus.READY;

  // DMA Buffer
  private dmaBuffer: Uint8Array;

  // Device info cache
  private lastDeviceInfo: DeviceInfo = {
    sectorSize: 0,
    sectorCount: 0,
    isReadOnly: false,
    isPresent: false,
  };

  constructor(hdd: HardDiskDrive, cdrom: CDROMDrive, usb: USBDrive) {
    this.hdd = hdd;
    this.cdrom = cdrom;
    this.usb = usb;
    this.dmaBuffer = new Uint8Array(DMA_BUFFER_SIZE);
  }

  /**
   * Get the currently selected device
   */
  getSelectedDevice(): BlockDevice | null {
    switch (this.deviceSelect) {
      case DeviceType.HDD:
        return this.hdd;
      case DeviceType.CDROM:
        return this.cdrom;
      case DeviceType.USB:
        return this.usb;
      default:
        return null;
    }
  }

  /**
   * Read a register
   */
  readRegister(offset: number): number {
    switch (offset) {
      case STORAGE_REGS.DEVICE_SELECT:
        return this.deviceSelect;
      case STORAGE_REGS.STATUS:
        return this.status;
      case STORAGE_REGS.SECTOR_LO:
        return this.sectorLo >>> 0;
      case STORAGE_REGS.SECTOR_HI:
        return this.sectorHi >>> 0;
      case STORAGE_REGS.COUNT:
        return this.count;
      case STORAGE_REGS.DMA_ADDR:
        return this.dmaAddr >>> 0;
      default:
        return 0;
    }
  }

  /**
   * Write a register
   */
  writeRegister(offset: number, value: number): void {
    switch (offset) {
      case STORAGE_REGS.DEVICE_SELECT:
        this.deviceSelect = value & 0xff;
        break;
      case STORAGE_REGS.COMMAND:
        this.executeCommand(value);
        break;
      case STORAGE_REGS.SECTOR_LO:
        this.sectorLo = value >>> 0;
        break;
      case STORAGE_REGS.SECTOR_HI:
        this.sectorHi = value >>> 0;
        break;
      case STORAGE_REGS.COUNT:
        this.count = value & 0xffff;
        break;
      case STORAGE_REGS.DMA_ADDR:
        this.dmaAddr = value >>> 0;
        break;
    }
  }

  /**
   * Execute a storage command
   */
  private executeCommand(command: number): void {
    const device = this.getSelectedDevice();

    // Clear previous errors and set ready
    this.status = StorageStatus.READY;

    if (!device) {
      this.status = StorageStatus.ERROR;
      return;
    }

    try {
      switch (command) {
        case StorageCommand.NOP:
          break;

        case StorageCommand.READ:
          this.executeRead(device);
          break;

        case StorageCommand.WRITE:
          this.executeWrite(device);
          break;

        case StorageCommand.FLUSH:
          device.flush();
          break;

        case StorageCommand.GET_INFO:
          this.executeGetInfo(device);
          break;

        default:
          this.status = StorageStatus.ERROR;
      }
    } catch (e) {
      this.status = StorageStatus.ERROR;
    }
  }

  /**
   * Execute READ command
   */
  private executeRead(device: BlockDevice): void {
    const sector = this.getSector();
    const data = device.read(sector, this.count);

    // Copy to DMA buffer
    this.dmaBuffer.set(data, 0);
    this.status = StorageStatus.READY | StorageStatus.DRQ;
  }

  /**
   * Execute WRITE command
   */
  private executeWrite(device: BlockDevice): void {
    const sector = this.getSector();
    const length = this.count * device.sectorSize;
    const data = this.dmaBuffer.slice(0, length);

    device.write(sector, data);
    this.status = StorageStatus.READY;
  }

  /**
   * Execute GET_INFO command
   */
  private executeGetInfo(device: BlockDevice): void {
    let isPresent = true;

    // Check if device is present (for removable media)
    if (device instanceof USBDrive) {
      isPresent = device.isPresent();
    } else if (device instanceof CDROMDrive) {
      isPresent = device.hasDisc();
    }

    this.lastDeviceInfo = {
      sectorSize: device.sectorSize,
      sectorCount: device.sectorCount,
      isReadOnly: device.isReadOnly,
      isPresent,
    };
  }

  /**
   * Get device info from last GET_INFO command
   */
  getDeviceInfo(): DeviceInfo {
    return { ...this.lastDeviceInfo };
  }

  /**
   * Get the full sector number (64-bit)
   */
  private getSector(): number {
    return this.sectorLo; // For now, just use low 32 bits
  }

  /**
   * Get DMA buffer for direct access
   */
  getDMABuffer(): Uint8Array {
    return this.dmaBuffer;
  }

  /**
   * Memory-mapped I/O read
   */
  mmioRead(address: number): number {
    const offset = address - STORAGE_BASE;

    // Registers
    if (offset >= 0 && offset < STORAGE_REGS_SIZE) {
      const regOffset = offset & ~0x3;
      return this.readRegister(regOffset);
    }

    // DMA buffer
    if (offset >= DMA_BUFFER_OFFSET && offset < DMA_BUFFER_OFFSET + DMA_BUFFER_SIZE) {
      const bufOffset = offset - DMA_BUFFER_OFFSET;
      return (
        this.dmaBuffer[bufOffset] |
        (this.dmaBuffer[bufOffset + 1] << 8) |
        (this.dmaBuffer[bufOffset + 2] << 16) |
        (this.dmaBuffer[bufOffset + 3] << 24)
      ) >>> 0;
    }

    return 0;
  }

  /**
   * Memory-mapped I/O write
   */
  mmioWrite(address: number, value: number): void {
    const offset = address - STORAGE_BASE;

    // Registers
    if (offset >= 0 && offset < STORAGE_REGS_SIZE) {
      const regOffset = offset & ~0x3;
      this.writeRegister(regOffset, value);
      return;
    }

    // DMA buffer
    if (offset >= DMA_BUFFER_OFFSET && offset < DMA_BUFFER_OFFSET + DMA_BUFFER_SIZE) {
      const bufOffset = offset - DMA_BUFFER_OFFSET;
      this.dmaBuffer[bufOffset] = value & 0xff;
      this.dmaBuffer[bufOffset + 1] = (value >> 8) & 0xff;
      this.dmaBuffer[bufOffset + 2] = (value >> 16) & 0xff;
      this.dmaBuffer[bufOffset + 3] = (value >> 24) & 0xff;
    }
  }

  /**
   * Check if address is in controller's range
   */
  isInRange(address: number): boolean {
    const offset = address - STORAGE_BASE;
    if (offset >= 0 && offset < STORAGE_REGS_SIZE) return true;
    if (offset >= DMA_BUFFER_OFFSET && offset < DMA_BUFFER_OFFSET + DMA_BUFFER_SIZE) return true;
    return false;
  }

  /**
   * Memory-mapped I/O read byte
   */
  mmioReadByte(address: number): number {
    const offset = address - STORAGE_BASE;

    // Registers
    if (offset >= 0 && offset < STORAGE_REGS_SIZE) {
      const regOffset = offset & ~0x3;
      const byteOffset = offset & 0x3;
      const value = this.readRegister(regOffset);
      return (value >> (byteOffset * 8)) & 0xff;
    }

    // DMA buffer
    if (offset >= DMA_BUFFER_OFFSET && offset < DMA_BUFFER_OFFSET + DMA_BUFFER_SIZE) {
      return this.dmaBuffer[offset - DMA_BUFFER_OFFSET];
    }

    return 0;
  }

  /**
   * Memory-mapped I/O write byte
   */
  mmioWriteByte(address: number, value: number): void {
    const offset = address - STORAGE_BASE;

    // Registers - write affects full register for simplicity
    if (offset >= 0 && offset < STORAGE_REGS_SIZE) {
      const regOffset = offset & ~0x3;
      this.writeRegister(regOffset, value & 0xff);
      return;
    }

    // DMA buffer
    if (offset >= DMA_BUFFER_OFFSET && offset < DMA_BUFFER_OFFSET + DMA_BUFFER_SIZE) {
      this.dmaBuffer[offset - DMA_BUFFER_OFFSET] = value & 0xff;
    }
  }

  /**
   * Memory-mapped I/O read halfword
   */
  mmioReadHalfword(address: number): number {
    const lo = this.mmioReadByte(address);
    const hi = this.mmioReadByte(address + 1);
    return lo | (hi << 8);
  }

  /**
   * Memory-mapped I/O write halfword
   */
  mmioWriteHalfword(address: number, value: number): void {
    this.mmioWriteByte(address, value & 0xff);
    this.mmioWriteByte(address + 1, (value >> 8) & 0xff);
  }
}
