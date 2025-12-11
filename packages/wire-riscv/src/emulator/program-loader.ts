/**
 * RISC-V Program Loader
 *
 * Loads and executes programs in a simple executable format.
 */

import { RiscVCpu } from './cpu.js';

/** Magic number for RISV executables (little-endian "RISV") */
export const EXECUTABLE_MAGIC = 0x56534952; // 'V' 'S' 'I' 'R' in little-endian

/** Size of executable header in bytes */
export const HEADER_SIZE = 0x18; // 24 bytes

/**
 * Executable header offsets
 */
const HEADER = {
  MAGIC: 0x00,        // 4 bytes
  ENTRY_POINT: 0x04,  // 4 bytes - offset from code start
  CODE_SIZE: 0x08,    // 4 bytes
  DATA_SIZE: 0x0C,    // 4 bytes
  BSS_SIZE: 0x10,     // 4 bytes
  STACK_SIZE: 0x14,   // 4 bytes
} as const;

/**
 * Information about a loaded program
 */
export interface LoadInfo {
  /** Absolute entry point address */
  entryPoint: number;
  /** Base address where code was loaded */
  codeBase: number;
  /** Base address of data section */
  dataBase: number;
  /** Base address of BSS section */
  bssBase: number;
  /** Top of stack (stack grows down) */
  stackTop: number;
  /** Total size of loaded program in memory */
  totalSize: number;
}

/**
 * Program loader for RISV executables
 */
export class ProgramLoader {
  constructor(private cpu: RiscVCpu) {}

  /**
   * Load an executable into memory
   *
   * @param executable The executable data (header + code + data)
   * @param baseAddress Base address to load at
   * @returns Information about the loaded program
   */
  load(executable: Uint8Array, baseAddress: number): LoadInfo {
    // Validate header
    if (executable.length < HEADER_SIZE) {
      throw new Error('Invalid executable: too small');
    }

    const magic = this.readWord(executable, HEADER.MAGIC);
    if (magic !== EXECUTABLE_MAGIC) {
      throw new Error('Invalid executable: bad magic number');
    }

    // Parse header
    const entryOffset = this.readWord(executable, HEADER.ENTRY_POINT);
    const codeSize = this.readWord(executable, HEADER.CODE_SIZE);
    const dataSize = this.readWord(executable, HEADER.DATA_SIZE);
    const bssSize = this.readWord(executable, HEADER.BSS_SIZE);
    const stackSize = this.readWord(executable, HEADER.STACK_SIZE);

    // Calculate addresses
    const codeBase = baseAddress;
    const dataBase = codeBase + codeSize;
    const bssBase = dataBase + dataSize;
    const stackBase = bssBase + bssSize;
    const stackTop = stackBase + stackSize;

    // Load code section
    for (let i = 0; i < codeSize; i++) {
      this.cpu.writeByte(codeBase + i, executable[HEADER_SIZE + i]);
    }

    // Load data section
    for (let i = 0; i < dataSize; i++) {
      this.cpu.writeByte(dataBase + i, executable[HEADER_SIZE + codeSize + i]);
    }

    // Zero BSS section
    for (let i = 0; i < bssSize; i++) {
      this.cpu.writeByte(bssBase + i, 0);
    }

    return {
      entryPoint: codeBase + entryOffset,
      codeBase,
      dataBase,
      bssBase,
      stackTop,
      totalSize: codeSize + dataSize + bssSize + stackSize,
    };
  }

  /**
   * Read a 32-bit word from buffer (little-endian)
   */
  private readWord(buffer: Uint8Array, offset: number): number {
    return (
      buffer[offset] |
      (buffer[offset + 1] << 8) |
      (buffer[offset + 2] << 16) |
      (buffer[offset + 3] << 24)
    ) >>> 0;
  }
}

/**
 * Builder for creating RISV executables
 */
export class ExecutableBuilder {
  private code: Uint8Array = new Uint8Array(0);
  private data: Uint8Array = new Uint8Array(0);
  private bssSize: number = 0;
  private stackSize: number = 256; // Default stack
  private entryPoint: number = 0;

  /**
   * Set the code section
   */
  setCode(code: Uint8Array): this {
    this.code = code;
    return this;
  }

  /**
   * Set the data section
   */
  setData(data: Uint8Array): this {
    this.data = data;
    return this;
  }

  /**
   * Set the BSS (zero-initialized) section size
   */
  setBssSize(size: number): this {
    this.bssSize = size;
    return this;
  }

  /**
   * Set the stack size
   */
  setStackSize(size: number): this {
    this.stackSize = size;
    return this;
  }

  /**
   * Set the entry point offset (relative to code start)
   */
  setEntryPoint(offset: number): this {
    this.entryPoint = offset;
    return this;
  }

  /**
   * Build the executable
   */
  build(): Uint8Array {
    const totalSize = HEADER_SIZE + this.code.length + this.data.length;
    const exe = new Uint8Array(totalSize);

    // Write header
    this.writeWord(exe, HEADER.MAGIC, EXECUTABLE_MAGIC);
    this.writeWord(exe, HEADER.ENTRY_POINT, this.entryPoint);
    this.writeWord(exe, HEADER.CODE_SIZE, this.code.length);
    this.writeWord(exe, HEADER.DATA_SIZE, this.data.length);
    this.writeWord(exe, HEADER.BSS_SIZE, this.bssSize);
    this.writeWord(exe, HEADER.STACK_SIZE, this.stackSize);

    // Write code section
    exe.set(this.code, HEADER_SIZE);

    // Write data section
    exe.set(this.data, HEADER_SIZE + this.code.length);

    return exe;
  }

  /**
   * Write a 32-bit word to buffer (little-endian)
   */
  private writeWord(buffer: Uint8Array, offset: number, value: number): void {
    buffer[offset] = value & 0xFF;
    buffer[offset + 1] = (value >> 8) & 0xFF;
    buffer[offset + 2] = (value >> 16) & 0xFF;
    buffer[offset + 3] = (value >> 24) & 0xFF;
  }
}
