// Browser Computer System
// Ties together CPU, memory, I/O, and persistent disk

import { CPU6502 } from '../emulator/cpu.js';
import { PersistentDisk } from './persistent-disk.js';
import { assembleHexLoader } from '../bootstrap/hex-loader.js';
import { assembleBios } from '../assembler/bios.js';

// Memory map
const MEM = {
  RAM_END: 0x7fff,
  IO_START: 0x8000,
  IO_END: 0x80ff,
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

  // Disk I/O
  DISK_STATUS: 0x8020, // bit 0 = ready, bit 1 = busy, bit 7 = error
  DISK_CMD: 0x8021, // 1 = read, 2 = write
  DISK_SEC_LO: 0x8022, // sector low byte
  DISK_SEC_HI: 0x8023, // sector high byte
  DISK_BUF_LO: 0x8024, // buffer address low
  DISK_BUF_HI: 0x8025, // buffer address high
  DISK_COUNT: 0x8026, // sector count
};

export interface ComputerCallbacks {
  onOutput: (char: number) => void;
  onDiskActivity: (reading: boolean) => void;
}

export class Computer {
  private cpu: CPU6502;
  private memory: Uint8Array;
  private disk: PersistentDisk;
  private callbacks: ComputerCallbacks;

  // Keyboard buffer
  private keyBuffer: number[] = [];

  // Disk state
  private diskSector = 0;
  private diskBuffer = 0;
  private diskCount = 0;
  private diskBusy = false;

  // Execution state
  private running = false;
  private animationFrame: number | null = null;


  constructor(disk: PersistentDisk, callbacks: ComputerCallbacks) {
    this.disk = disk;
    this.callbacks = callbacks;
    this.memory = new Uint8Array(65536);

    // Load ROM
    this.loadRom();

    // Create CPU with shared memory
    this.cpu = new CPU6502(this.memory);

    // Reset CPU to read reset vector and start at $F800
    this.cpu.reset();
  }

  private loadRom(): void {
    // Load BIOS (returns full 16KB ROM image)
    const bios = assembleBios();
    for (let i = 0; i < bios.length; i++) {
      this.memory[MEM.ROM_START + i] = bios[i];
    }

    // Load hex loader at $F800 (overwrite part of BIOS ROM)
    const hexLoader = assembleHexLoader();
    const hexOffset = 0xf800;
    for (let i = 0; i < hexLoader.bytes.length; i++) {
      this.memory[hexOffset + i] = hexLoader.bytes[i];
    }

    // Set reset vector to hex loader ($F800)
    this.memory[0xfffc] = 0x00; // low byte
    this.memory[0xfffd] = 0xf8; // high byte
  }

  // Process any pending I/O
  private processIO(): void {
    // Handle serial output - check if any character was written
    const serialData = this.memory[IO.SERIAL_DATA];
    if (serialData !== 0) {
      this.callbacks.onOutput(serialData);
      this.memory[IO.SERIAL_DATA] = 0; // Clear after output
    }

    // Handle keyboard status
    this.memory[IO.KBD_STATUS] = this.keyBuffer.length > 0 ? 0x01 : 0x00;

    // Handle keyboard data read
    if (this.memory[IO.KBD_DATA] === 0xff && this.keyBuffer.length > 0) {
      this.memory[IO.KBD_DATA] = this.keyBuffer.shift()!;
    }

    // Handle serial status (always ready)
    this.memory[IO.SERIAL_STATUS] = 0x02; // TX ready

    // Handle disk status
    this.memory[IO.DISK_STATUS] = this.diskBusy ? 0x02 : 0x01;

    // Handle disk command
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

  reset(): void {
    this.cpu.reset();
  }

  sendKey(key: number): void {
    this.keyBuffer.push(key & 0xff);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.runLoop();
  }

  stop(): void {
    this.running = false;
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
}
