// Memory Controller for the Wire-HDL Computer System
// Unified address space with RAM, ROM, Video RAM, and I/O

export interface MemoryConfig {
  ramSize?: number;      // Default: 32KB ($0000-$7FFF)
  romSize?: number;      // Default: 16KB ($C000-$FFFF)
  videoRamSize?: number; // Default: 2KB ($4000-$47FF)
}

export interface IOHandlers {
  onVideoWrite?: (address: number, value: number) => void;
  onKeyboardRead?: () => number;
  hasKeyAvailable?: () => boolean;
  onDiskCommand?: (cmd: number) => void;
  getDiskStatus?: () => number;
  onSerialWrite?: (value: number) => void;
  onSerialRead?: () => number;
}

// Memory map constants
export const MEM = {
  // RAM regions
  RAM_START: 0x0000,
  ZERO_PAGE_END: 0x00FF,
  STACK_START: 0x0100,
  STACK_END: 0x01FF,
  RAM_END: 0x3FFF,

  // Video RAM
  VIDEO_START: 0x4000,
  VIDEO_END: 0x47FF,
  VIDEO_SIZE: 2000, // 80x25

  // Disk buffer
  DISK_BUFFER_START: 0x4800,
  DISK_BUFFER_END: 0x4FFF,

  // Extended RAM
  EXT_RAM_START: 0x5000,
  EXT_RAM_END: 0x7FFF,

  // I/O Registers
  IO_START: 0x8000,
  IO_END: 0x803F,

  // Display I/O
  VID_STATUS: 0x8000,
  CURSOR_X: 0x8001,
  CURSOR_Y: 0x8002,
  VID_CTRL: 0x8003,

  // Keyboard I/O
  KBD_STATUS: 0x8010,
  KBD_DATA: 0x8011,

  // Disk I/O
  DISK_STATUS: 0x8020,
  DISK_CMD: 0x8021,
  DISK_SECTOR_LO: 0x8022,
  DISK_SECTOR_HI: 0x8023,
  DISK_BUFFER_LO: 0x8024,
  DISK_BUFFER_HI: 0x8025,
  DISK_COUNT: 0x8026,

  // Serial I/O
  SERIAL_STATUS: 0x8030,
  SERIAL_DATA: 0x8031,

  // System
  SYS_TICKS_LO: 0x803E,
  SYS_TICKS_HI: 0x803F,

  // ROM
  ROM_START: 0xC000,
  ROM_END: 0xFFFF,
  RESET_VECTOR: 0xFFFC,
  IRQ_VECTOR: 0xFFFE,
};

export class Memory {
  // Main memory regions
  private ram: Uint8Array;
  private videoRam: Uint8Array;
  private diskBuffer: Uint8Array;
  private extRam: Uint8Array;
  private rom: Uint8Array;

  // I/O state
  private cursorX: number = 0;
  private cursorY: number = 0;
  private vidCtrl: number = 0;

  private kbdData: number = 0;
  private kbdStatus: number = 0;

  private diskStatus: number = 0x01; // Ready
  private diskCmd: number = 0;
  private diskSectorLo: number = 0;
  private diskSectorHi: number = 0;
  private diskBufferLo: number = 0;
  private diskBufferHi: number = 0;
  private diskCount: number = 0;

  private serialStatus: number = 0;
  private serialData: number = 0;

  private tickCounter: number = 0;

  // Handlers for I/O events
  private handlers: IOHandlers;

  constructor(config: MemoryConfig = {}, handlers: IOHandlers = {}) {
    // Initialize memory regions
    this.ram = new Uint8Array(0x4000);           // 16KB main RAM
    this.videoRam = new Uint8Array(2048);        // 2KB video RAM
    this.diskBuffer = new Uint8Array(2048);      // 2KB disk buffer
    this.extRam = new Uint8Array(0x3000);        // 12KB extended RAM
    this.rom = new Uint8Array(0x4000);           // 16KB ROM

    this.handlers = handlers;
  }

  /**
   * Load ROM data from a Uint8Array
   */
  loadRom(data: Uint8Array, offset: number = 0): void {
    const maxSize = this.rom.length - offset;
    const copySize = Math.min(data.length, maxSize);
    this.rom.set(data.subarray(0, copySize), offset);
  }

  /**
   * Load ROM from an array of bytes
   */
  loadRomBytes(bytes: number[], offset: number = 0): void {
    this.loadRom(new Uint8Array(bytes), offset);
  }

  /**
   * Get direct access to video RAM for rendering
   */
  getVideoRam(): Uint8Array {
    return this.videoRam;
  }

  /**
   * Get direct access to disk buffer
   */
  getDiskBuffer(): Uint8Array {
    return this.diskBuffer;
  }

  /**
   * Read a byte from the address space
   */
  read(address: number): number {
    address = address & 0xFFFF;

    // Main RAM ($0000-$3FFF)
    if (address <= MEM.RAM_END) {
      return this.ram[address];
    }

    // Video RAM ($4000-$47FF)
    if (address >= MEM.VIDEO_START && address <= MEM.VIDEO_END) {
      return this.videoRam[address - MEM.VIDEO_START];
    }

    // Disk Buffer ($4800-$4FFF)
    if (address >= MEM.DISK_BUFFER_START && address <= MEM.DISK_BUFFER_END) {
      return this.diskBuffer[address - MEM.DISK_BUFFER_START];
    }

    // Extended RAM ($5000-$7FFF)
    if (address >= MEM.EXT_RAM_START && address <= MEM.EXT_RAM_END) {
      return this.extRam[address - MEM.EXT_RAM_START];
    }

    // I/O Registers ($8000-$803F)
    if (address >= MEM.IO_START && address <= MEM.IO_END) {
      return this.readIO(address);
    }

    // ROM ($C000-$FFFF)
    if (address >= MEM.ROM_START) {
      return this.rom[address - MEM.ROM_START];
    }

    return 0xFF; // Unmapped memory reads as 0xFF
  }

  /**
   * Write a byte to the address space
   */
  write(address: number, value: number): void {
    address = address & 0xFFFF;
    value = value & 0xFF;

    // Main RAM ($0000-$3FFF)
    if (address <= MEM.RAM_END) {
      this.ram[address] = value;
      return;
    }

    // Video RAM ($4000-$47FF)
    if (address >= MEM.VIDEO_START && address <= MEM.VIDEO_END) {
      const offset = address - MEM.VIDEO_START;
      this.videoRam[offset] = value;
      if (this.handlers.onVideoWrite) {
        this.handlers.onVideoWrite(offset, value);
      }
      return;
    }

    // Disk Buffer ($4800-$4FFF)
    if (address >= MEM.DISK_BUFFER_START && address <= MEM.DISK_BUFFER_END) {
      this.diskBuffer[address - MEM.DISK_BUFFER_START] = value;
      return;
    }

    // Extended RAM ($5000-$7FFF)
    if (address >= MEM.EXT_RAM_START && address <= MEM.EXT_RAM_END) {
      this.extRam[address - MEM.EXT_RAM_START] = value;
      return;
    }

    // I/O Registers ($8000-$803F)
    if (address >= MEM.IO_START && address <= MEM.IO_END) {
      this.writeIO(address, value);
      return;
    }

    // ROM is not writable (silently ignored)
  }

  /**
   * Read from I/O register
   */
  private readIO(address: number): number {
    switch (address) {
      // Display
      case MEM.VID_STATUS:
        return 0; // No vsync for now
      case MEM.CURSOR_X:
        return this.cursorX;
      case MEM.CURSOR_Y:
        return this.cursorY;

      // Keyboard
      case MEM.KBD_STATUS:
        if (this.handlers.hasKeyAvailable?.()) {
          return 0x01; // Key available
        }
        return this.kbdStatus;
      case MEM.KBD_DATA:
        if (this.handlers.onKeyboardRead) {
          const key = this.handlers.onKeyboardRead();
          this.kbdStatus = 0; // Clear status after read
          return key;
        }
        const data = this.kbdData;
        this.kbdStatus = 0;
        return data;

      // Disk
      case MEM.DISK_STATUS:
        return this.handlers.getDiskStatus?.() ?? this.diskStatus;
      case MEM.DISK_SECTOR_LO:
        return this.diskSectorLo;
      case MEM.DISK_SECTOR_HI:
        return this.diskSectorHi;
      case MEM.DISK_BUFFER_LO:
        return this.diskBufferLo;
      case MEM.DISK_BUFFER_HI:
        return this.diskBufferHi;
      case MEM.DISK_COUNT:
        return this.diskCount;

      // Serial
      case MEM.SERIAL_STATUS:
        return this.serialStatus;
      case MEM.SERIAL_DATA:
        if (this.handlers.onSerialRead) {
          return this.handlers.onSerialRead();
        }
        return this.serialData;

      // System
      case MEM.SYS_TICKS_LO:
        return this.tickCounter & 0xFF;
      case MEM.SYS_TICKS_HI:
        return (this.tickCounter >> 8) & 0xFF;

      default:
        return 0;
    }
  }

  /**
   * Write to I/O register
   */
  private writeIO(address: number, value: number): void {
    switch (address) {
      // Display
      case MEM.CURSOR_X:
        this.cursorX = value % 80;
        break;
      case MEM.CURSOR_Y:
        this.cursorY = value % 25;
        break;
      case MEM.VID_CTRL:
        this.vidCtrl = value;
        if (value & 0x80) {
          // Clear screen
          this.videoRam.fill(0x20); // Fill with spaces
        }
        break;

      // Disk
      case MEM.DISK_CMD:
        this.diskCmd = value;
        if (this.handlers.onDiskCommand) {
          this.handlers.onDiskCommand(value);
        }
        break;
      case MEM.DISK_SECTOR_LO:
        this.diskSectorLo = value;
        break;
      case MEM.DISK_SECTOR_HI:
        this.diskSectorHi = value;
        break;
      case MEM.DISK_BUFFER_LO:
        this.diskBufferLo = value;
        break;
      case MEM.DISK_BUFFER_HI:
        this.diskBufferHi = value;
        break;
      case MEM.DISK_COUNT:
        this.diskCount = value;
        break;

      // Serial
      case MEM.SERIAL_DATA:
        if (this.handlers.onSerialWrite) {
          this.handlers.onSerialWrite(value);
        }
        this.serialData = value;
        break;
    }
  }

  /**
   * Queue a keyboard keypress
   */
  queueKey(ascii: number): void {
    this.kbdData = ascii & 0xFF;
    this.kbdStatus = 0x01; // Key available
  }

  /**
   * Get the current disk sector number
   */
  getDiskSector(): number {
    return this.diskSectorLo | (this.diskSectorHi << 8);
  }

  /**
   * Get the current disk buffer address
   */
  getDiskBufferAddress(): number {
    return this.diskBufferLo | (this.diskBufferHi << 8);
  }

  /**
   * Get the disk sector count
   */
  getDiskSectorCount(): number {
    return this.diskCount;
  }

  /**
   * Set disk status
   */
  setDiskStatus(status: number): void {
    this.diskStatus = status;
  }

  /**
   * Increment tick counter
   */
  tick(): void {
    this.tickCounter = (this.tickCounter + 1) & 0xFFFF;
  }

  /**
   * Reset memory and I/O state
   */
  reset(): void {
    this.ram.fill(0);
    this.videoRam.fill(0x20); // Fill with spaces
    this.diskBuffer.fill(0);
    this.extRam.fill(0);

    this.cursorX = 0;
    this.cursorY = 0;
    this.vidCtrl = 0;
    this.kbdData = 0;
    this.kbdStatus = 0;
    this.diskStatus = 0x01;
    this.tickCounter = 0;
  }

  /**
   * Get RAM contents for debugging
   */
  getRam(): Uint8Array {
    return this.ram;
  }

  /**
   * Get ROM contents
   */
  getRom(): Uint8Array {
    return this.rom;
  }

  /**
   * Copy data to RAM (for loading programs)
   */
  loadRam(data: Uint8Array, address: number): void {
    for (let i = 0; i < data.length && address + i < 0x8000; i++) {
      this.write(address + i, data[i]);
    }
  }
}
