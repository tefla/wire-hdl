// Browser Computer System
// Ties together CPU, memory, I/O, and persistent disk

import { CPU6502 } from '../emulator/cpu.js';
import { PersistentDisk } from './persistent-disk.js';
import { assembleHexLoader } from '../bootstrap/hex-loader.js';
import { assembleBootLoader } from '../bootstrap/boot-loader.js';
import { assembleBios } from '../assembler/bios.js';
import { GraphicsCard, VIDEO_IO } from './graphics-card.js';
import { SoundChip } from './sound-chip.js';

// Memory map
const MEM = {
  RAM_END: 0x7fff,
  IO_START: 0x8000,
  IO_END: 0x80ff,
  VRAM_START: 0x8100,
  VRAM_END: 0x8fff,
  ROM_START: 0xc000,
};

// I/O registers
const IO = {
  // Serial I/O
  SERIAL_STATUS: 0x8030, // bit 0 = rx ready, bit 1 = tx ready
  SERIAL_DATA: 0x8031, // read = rx, write = tx

  // Keyboard
  KBD_STATUS: 0x8010, // bit 0 = key available
  KBD_DATA: 0x8011, // read = key code

  // HDD I/O
  DISK_STATUS: 0x8020, // bit 0 = ready, bit 1 = busy, bit 7 = error
  DISK_CMD: 0x8021, // 1 = read, 2 = write
  DISK_SEC_LO: 0x8022, // sector low byte
  DISK_SEC_HI: 0x8023, // sector high byte
  DISK_BUF_LO: 0x8024, // buffer address low
  DISK_BUF_HI: 0x8025, // buffer address high
  DISK_COUNT: 0x8026, // sector count

  // Floppy I/O (same layout, different base)
  FLOPPY_STATUS: 0x8040, // bit 0 = ready, bit 1 = busy, bit 7 = error, bit 6 = no disk
  FLOPPY_CMD: 0x8041, // 1 = read, 2 = write
  FLOPPY_SEC_LO: 0x8042, // sector low byte
  FLOPPY_SEC_HI: 0x8043, // sector high byte
  FLOPPY_BUF_LO: 0x8044, // buffer address low
  FLOPPY_BUF_HI: 0x8045, // buffer address high
  FLOPPY_COUNT: 0x8046, // sector count
};

export interface ComputerCallbacks {
  onOutput: (char: number) => void;
  onDiskActivity: (reading: boolean) => void;
  onFloppyActivity?: (reading: boolean) => void;
}

export class Computer {
  private cpu: CPU6502;
  private memory: Uint8Array;
  private disk: PersistentDisk;
  private floppy: Uint8Array[] | null = null; // Floppy disk sectors
  private callbacks: ComputerCallbacks;

  // Graphics card
  private graphics: GraphicsCard;

  // Sound chip
  private sound: SoundChip;

  // Keyboard buffer
  private keyBuffer: number[] = [];

  // HDD state
  private diskSector = 0;
  private diskBuffer = 0;
  private diskCount = 0;
  private diskBusy = false;

  // Floppy state
  private floppySector = 0;
  private floppyBuffer = 0;
  private floppyCount = 0;
  private floppyBusy = false;

  // Execution state
  private running = false;
  private animationFrame: number | null = null;


  constructor(disk: PersistentDisk, callbacks: ComputerCallbacks) {
    this.disk = disk;
    this.callbacks = callbacks;
    this.memory = new Uint8Array(65536);

    // Create graphics card
    this.graphics = new GraphicsCard();

    // Create sound chip
    this.sound = new SoundChip();

    // Initialize VIDEO_CTRL in memory to match graphics card default
    // (DISPLAY_ENABLE | CURSOR_VISIBLE = 0x21)
    // This prevents processIO from overwriting the graphics card's initial state
    this.memory[VIDEO_IO.VIDEO_CTRL] = 0x21;

    // Load ROM
    this.loadRom();

    // Create CPU with memory read/write handlers for I/O
    this.cpu = new CPU6502(this.memory);

    // Reset CPU to read reset vector and start at boot loader
    this.cpu.reset();
  }

  private loadRom(): void {
    // Load BIOS (returns full 16KB ROM image)
    const bios = assembleBios();
    for (let i = 0; i < bios.length; i++) {
      this.memory[MEM.ROM_START + i] = bios[i];
    }

    // Load hex loader at $F800
    const hexLoader = assembleHexLoader();
    const hexOffset = 0xf800;
    for (let i = 0; i < hexLoader.bytes.length; i++) {
      this.memory[hexOffset + i] = hexLoader.bytes[i];
    }

    // Load boot loader at $FC00
    const bootLoader = assembleBootLoader();
    const bootOffset = 0xfc00;
    for (let i = 0; i < bootLoader.bytes.length; i++) {
      this.memory[bootOffset + i] = bootLoader.bytes[i];
    }

    // Set reset vector to boot loader ($FC00)
    this.memory[0xfffc] = 0x00; // low byte
    this.memory[0xfffd] = 0xfc; // high byte
  }

  // Process any pending I/O
  private processIO(): void {
    // Handle serial output - write to graphics card VRAM
    const serialData = this.memory[IO.SERIAL_DATA];
    if (serialData !== 0) {
      // Write to graphics card (text mode)
      this.graphics.putChar(serialData);
      // Also call callback for legacy terminal support
      this.callbacks.onOutput(serialData);
      this.memory[IO.SERIAL_DATA] = 0; // Clear after output
    }

    // Handle graphics card I/O reads/writes
    // Video registers $8050-$806F
    for (let addr = 0x8050; addr <= 0x806f; addr++) {
      const val = this.memory[addr];
      if (val !== 0 || addr === VIDEO_IO.VIDEO_CTRL) {
        // Sync register changes to graphics card
        this.graphics.write(addr, val);
      }
    }

    // VRAM access is handled directly in memory, but we sync on read
    // The graphics card reads from its own VRAM copy

    // Handle sound chip I/O ($8070-$8080)
    for (let addr = 0x8070; addr <= 0x8080; addr++) {
      const val = this.memory[addr];
      if (val !== 0) {
        this.sound.write(addr, val);
        this.memory[addr] = 0; // Clear after write (write-only behavior)
      }
    }

    // Handle keyboard - deliver one key at a time
    // When a key is available, put it in KBD_DATA and set status
    // Clear the key from buffer once delivered (CPU reads it on next instruction)
    if (this.keyBuffer.length > 0 && this.memory[IO.KBD_DATA] === 0) {
      // Deliver next key
      this.memory[IO.KBD_DATA] = this.keyBuffer.shift()!;
      this.memory[IO.KBD_STATUS] = 0x01; // Key available
    } else if (this.memory[IO.KBD_DATA] !== 0) {
      // Key is waiting to be read
      this.memory[IO.KBD_STATUS] = 0x01;
    } else {
      // No key available
      this.memory[IO.KBD_STATUS] = 0x00;
    }

    // Handle serial status (always ready)
    this.memory[IO.SERIAL_STATUS] = 0x02; // TX ready

    // Handle HDD command before updating status so the busy bit is visible immediately
    const diskCmd = this.memory[IO.DISK_CMD];
    if (diskCmd !== 0) {
      this.diskSector = this.memory[IO.DISK_SEC_LO] | (this.memory[IO.DISK_SEC_HI] << 8);
      this.diskBuffer = this.memory[IO.DISK_BUF_LO] | (this.memory[IO.DISK_BUF_HI] << 8);
      this.diskCount = this.memory[IO.DISK_COUNT];

      if (diskCmd === 1) {
        this.diskRead();
      } else if (diskCmd === 2) {
        this.diskWrite();
      }

      this.memory[IO.DISK_CMD] = 0; // Clear command
    }

    // Handle floppy command before updating status so the busy bit is visible immediately
    const floppyCmd = this.memory[IO.FLOPPY_CMD];
    if (floppyCmd !== 0 && this.floppy !== null) {
      this.floppySector = this.memory[IO.FLOPPY_SEC_LO] | (this.memory[IO.FLOPPY_SEC_HI] << 8);
      this.floppyBuffer = this.memory[IO.FLOPPY_BUF_LO] | (this.memory[IO.FLOPPY_BUF_HI] << 8);
      this.floppyCount = this.memory[IO.FLOPPY_COUNT];

      if (floppyCmd === 1) {
        this.floppyRead();
      } else if (floppyCmd === 2) {
        this.floppyWrite();
      }

      this.memory[IO.FLOPPY_CMD] = 0; // Clear command
    }

    // Update disk status after commands have been processed
    this.memory[IO.DISK_STATUS] = this.diskBusy ? 0x02 : 0x01;

    // Update floppy status after commands have been processed
    if (this.floppy === null) {
      this.memory[IO.FLOPPY_STATUS] = 0x40; // No disk
    } else {
      this.memory[IO.FLOPPY_STATUS] = this.floppyBusy ? 0x02 : 0x01;
    }
  }

  private async diskRead(): Promise<void> {
    this.diskBusy = true;
    this.callbacks.onDiskActivity(true);

    for (let i = 0; i < this.diskCount; i++) {
      const sector = await this.disk.getSector(this.diskSector + i);
      const bufAddr = this.diskBuffer + i * 512;

      for (let j = 0; j < 512 && bufAddr + j <= MEM.RAM_END; j++) {
        this.memory[bufAddr + j] = sector[j];
      }
    }

    this.diskBusy = false;
    this.callbacks.onDiskActivity(false);
  }

  private async diskWrite(): Promise<void> {
    this.diskBusy = true;
    this.callbacks.onDiskActivity(false);

    for (let i = 0; i < this.diskCount; i++) {
      const sector = new Uint8Array(512);
      const bufAddr = this.diskBuffer + i * 512;

      for (let j = 0; j < 512 && bufAddr + j <= MEM.RAM_END; j++) {
        sector[j] = this.memory[bufAddr + j];
      }

      this.disk.loadSector(this.diskSector + i, sector);
    }

    this.diskBusy = false;
    this.callbacks.onDiskActivity(false);
  }

  private floppyRead(): void {
    if (!this.floppy) return;

    this.floppyBusy = true;
    this.callbacks.onFloppyActivity?.(true);

    for (let i = 0; i < this.floppyCount; i++) {
      const sectorNum = this.floppySector + i;
      const sector = this.floppy[sectorNum] || new Uint8Array(512);
      const bufAddr = this.floppyBuffer + i * 512;

      for (let j = 0; j < 512 && bufAddr + j <= MEM.RAM_END; j++) {
        this.memory[bufAddr + j] = sector[j];
      }
    }

    this.floppyBusy = false;
    this.callbacks.onFloppyActivity?.(false);
  }

  private floppyWrite(): void {
    if (!this.floppy) return;

    this.floppyBusy = true;
    this.callbacks.onFloppyActivity?.(false);

    for (let i = 0; i < this.floppyCount; i++) {
      const sector = new Uint8Array(512);
      const bufAddr = this.floppyBuffer + i * 512;

      for (let j = 0; j < 512 && bufAddr + j <= MEM.RAM_END; j++) {
        sector[j] = this.memory[bufAddr + j];
      }

      this.floppy[this.floppySector + i] = sector;
    }

    this.floppyBusy = false;
    this.callbacks.onFloppyActivity?.(false);
  }

  // Insert a floppy disk (array of sectors)
  insertFloppy(sectors: Uint8Array[]): void {
    this.floppy = sectors;
  }

  // Eject the floppy disk
  ejectFloppy(): void {
    this.floppy = null;
  }

  // Check if floppy is inserted
  hasFloppyInserted(): boolean {
    return this.floppy !== null;
  }

  reset(): void {
    this.cpu.reset();
  }

  sendKey(key: number): void {
    this.keyBuffer.push(key & 0xff);
  }

  start(): void {
    if (this.running) return;
    // Initialize audio context (requires user gesture)
    this.sound.init();
    this.sound.resume();
    this.running = true;
    this.runLoop();
  }

  stop(): void {
    this.running = false;
    this.sound.stop();
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  private runLoop = (): void => {
    if (!this.running) return;

    // Run ~50,000 instructions per frame (~3MHz at 60fps)
    const cyclesPerFrame = 50000;
    for (let i = 0; i < cyclesPerFrame && this.running; i++) {
      this.cpu.step();

      // Check I/O every instruction to catch all serial output
      this.processIO();
    }

    this.animationFrame = requestAnimationFrame(this.runLoop);
  };

  // Get CPU state for debugging
  getState(): { pc: number; a: number; x: number; y: number; sp: number; p: number } {
    // Build P register from individual flags
    let p = 0x20; // Bit 5 is always 1
    if (this.cpu.carry) p |= 0x01;
    if (this.cpu.zero) p |= 0x02;
    if (this.cpu.interruptDisable) p |= 0x04;
    // Decimal mode not tracked
    // Break flag not tracked
    if (this.cpu.overflow) p |= 0x40;
    if (this.cpu.negative) p |= 0x80;

    return {
      pc: this.cpu.pc,
      a: this.cpu.a,
      x: this.cpu.x,
      y: this.cpu.y,
      sp: this.cpu.sp,
      p,
    };
  }

  // Read memory for debugging
  readMemory(addr: number, length: number): Uint8Array {
    const data = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      data[i] = this.memory[(addr + i) & 0xffff];
    }
    return data;
  }

  // Get graphics card for display component
  getGraphics(): GraphicsCard {
    return this.graphics;
  }
}
