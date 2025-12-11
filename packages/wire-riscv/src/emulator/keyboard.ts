/**
 * RISC-V Keyboard Controller
 *
 * Memory-mapped keyboard controller with key buffer.
 *
 * Memory Map:
 * - 0x30000000: Keyboard registers base
 *
 * Registers:
 * - 0x00: STATUS (bit 0 = key available, read-only)
 * - 0x04: DATA (ASCII code, reading consumes key, read-only)
 * - 0x08: MODIFIER (shift/ctrl/alt state, read-only)
 */

export const KEYBOARD_BASE = 0x30000000;
export const KEYBOARD_REGS_SIZE = 0x10; // 16 bytes for registers

export const KEYBOARD_REGS = {
  STATUS: 0x00,
  DATA: 0x04,
  MODIFIER: 0x08,
} as const;

export enum KeyModifier {
  SHIFT = 0x01,
  CTRL = 0x02,
  ALT = 0x04,
}

const DEFAULT_BUFFER_SIZE = 16;

export class KeyboardController {
  private buffer: number[];
  private modifiers: number = 0;
  private readonly bufferSize: number;

  constructor(bufferSize: number = DEFAULT_BUFFER_SIZE) {
    this.buffer = [];
    this.bufferSize = bufferSize;
  }

  /**
   * Press a key - add to buffer
   */
  keyPress(ascii: number): void {
    if (this.buffer.length < this.bufferSize) {
      this.buffer.push(ascii & 0xFF);
    }
    // Overflow: key is dropped (could also emit warning)
  }

  /**
   * Check if there's a key available
   */
  hasKey(): boolean {
    return this.buffer.length > 0;
  }

  /**
   * Read and consume a key from the buffer
   * Returns 0 if buffer is empty
   */
  readKey(): number {
    if (this.buffer.length > 0) {
      return this.buffer.shift()!;
    }
    return 0;
  }

  /**
   * Set or clear a modifier key state
   */
  setModifier(modifier: KeyModifier, pressed: boolean): void {
    if (pressed) {
      this.modifiers |= modifier;
    } else {
      this.modifiers &= ~modifier;
    }
  }

  /**
   * Get current modifier state
   */
  getModifiers(): number {
    return this.modifiers;
  }

  /**
   * Clear the key buffer
   */
  clear(): void {
    this.buffer = [];
  }

  /**
   * Read a register value
   * Reading DATA consumes the key from buffer
   */
  readRegister(offset: number): number {
    switch (offset) {
      case KEYBOARD_REGS.STATUS:
        return this.buffer.length > 0 ? 1 : 0;

      case KEYBOARD_REGS.DATA:
        if (this.buffer.length > 0) {
          return this.buffer.shift()!;
        }
        return 0;

      case KEYBOARD_REGS.MODIFIER:
        return this.modifiers;

      default:
        return 0;
    }
  }

  /**
   * Write to a register (all registers are read-only)
   */
  writeRegister(_offset: number, _value: number): void {
    // All registers are read-only
  }

  // Memory-mapped I/O interface

  /**
   * Check if address is in keyboard memory range
   */
  isInRange(address: number): boolean {
    const offset = address - KEYBOARD_BASE;
    return offset >= 0 && offset < KEYBOARD_REGS_SIZE;
  }

  /**
   * Read a 32-bit word from MMIO
   */
  mmioRead(address: number): number {
    const offset = address - KEYBOARD_BASE;
    if (offset >= 0 && offset < KEYBOARD_REGS_SIZE) {
      const regOffset = offset & ~0x3; // Align to 4 bytes
      return this.readRegister(regOffset);
    }
    return 0;
  }

  /**
   * Write a 32-bit word to MMIO (registers are read-only)
   */
  mmioWrite(address: number, value: number): void {
    const offset = address - KEYBOARD_BASE;
    if (offset >= 0 && offset < KEYBOARD_REGS_SIZE) {
      const regOffset = offset & ~0x3;
      this.writeRegister(regOffset, value);
    }
  }

  /**
   * Read a byte from MMIO
   */
  mmioReadByte(address: number): number {
    const offset = address - KEYBOARD_BASE;
    if (offset >= 0 && offset < KEYBOARD_REGS_SIZE) {
      const regOffset = offset & ~0x3;
      const byteOffset = offset & 0x3;
      const value = this.readRegister(regOffset);
      return (value >> (byteOffset * 8)) & 0xFF;
    }
    return 0;
  }

  /**
   * Write a byte to MMIO (registers are read-only)
   */
  mmioWriteByte(address: number, value: number): void {
    const offset = address - KEYBOARD_BASE;
    if (offset >= 0 && offset < KEYBOARD_REGS_SIZE) {
      const regOffset = offset & ~0x3;
      this.writeRegister(regOffset, value);
    }
  }

  /**
   * Read a halfword from MMIO
   */
  mmioReadHalfword(address: number): number {
    const offset = address - KEYBOARD_BASE;
    if (offset >= 0 && offset < KEYBOARD_REGS_SIZE) {
      const regOffset = offset & ~0x3;
      const value = this.readRegister(regOffset);
      return value & 0xFFFF;
    }
    return 0;
  }

  /**
   * Write a halfword to MMIO (registers are read-only)
   */
  mmioWriteHalfword(address: number, value: number): void {
    const offset = address - KEYBOARD_BASE;
    if (offset >= 0 && offset < KEYBOARD_REGS_SIZE) {
      const regOffset = offset & ~0x3;
      this.writeRegister(regOffset, value);
    }
  }
}
