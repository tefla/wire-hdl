/**
 * RISC-V RV32I CPU Emulator
 *
 * Implements the base 32-bit integer instruction set.
 * 32 general-purpose registers (x0 hardwired to 0)
 * 32-bit program counter
 */

import { GraphicsCard, GRAPHICS_BASE } from './graphics.js';
import { StorageController, STORAGE_BASE } from './storage-controller.js';
import { HardDiskDrive } from './hdd.js';
import { CDROMDrive } from './cdrom.js';
import { USBDrive } from './usb.js';
import { KeyboardController, KEYBOARD_BASE } from './keyboard.js';

// Instruction format opcodes
export const OPCODE = {
  LUI: 0b0110111, // Load Upper Immediate
  AUIPC: 0b0010111, // Add Upper Immediate to PC
  JAL: 0b1101111, // Jump And Link
  JALR: 0b1100111, // Jump And Link Register
  BRANCH: 0b1100011, // Branch instructions
  LOAD: 0b0000011, // Load instructions
  STORE: 0b0100011, // Store instructions
  OP_IMM: 0b0010011, // Integer Register-Immediate
  OP: 0b0110011, // Integer Register-Register
  SYSTEM: 0b1110011, // System instructions (ECALL, EBREAK)
  FENCE: 0b0001111, // Memory ordering
} as const;

// Branch function codes (funct3)
export const BRANCH_FUNCT3 = {
  BEQ: 0b000,
  BNE: 0b001,
  BLT: 0b100,
  BGE: 0b101,
  BLTU: 0b110,
  BGEU: 0b111,
} as const;

// Load function codes (funct3)
export const LOAD_FUNCT3 = {
  LB: 0b000,
  LH: 0b001,
  LW: 0b010,
  LBU: 0b100,
  LHU: 0b101,
} as const;

// Store function codes (funct3)
export const STORE_FUNCT3 = {
  SB: 0b000,
  SH: 0b001,
  SW: 0b010,
} as const;

// ALU immediate function codes (funct3)
export const ALU_IMM_FUNCT3 = {
  ADDI: 0b000,
  SLTI: 0b010,
  SLTIU: 0b011,
  XORI: 0b100,
  ORI: 0b110,
  ANDI: 0b111,
  SLLI: 0b001,
  SRLI_SRAI: 0b101,
} as const;

// ALU register function codes (funct3)
export const ALU_FUNCT3 = {
  ADD_SUB: 0b000,
  SLL: 0b001,
  SLT: 0b010,
  SLTU: 0b011,
  XOR: 0b100,
  SRL_SRA: 0b101,
  OR: 0b110,
  AND: 0b111,
} as const;

export interface RiscVState {
  /** 32 general-purpose registers */
  x: Uint32Array;
  /** Program counter */
  pc: number;
  /** Memory (RAM) */
  memory: Uint8Array;
  /** Halted flag */
  halted: boolean;
  /** Cycle count */
  cycles: number;
}

export interface RiscVConfig {
  /** Memory size in bytes (default 64KB) */
  memorySize?: number;
  /** Initial PC value (default 0x0) */
  initialPc?: number;
}

/**
 * Sign-extend a value from a given bit width to 32 bits
 */
function signExtend(value: number, bits: number): number {
  const shift = 32 - bits;
  return (value << shift) >> shift;
}

/**
 * RISC-V RV32I CPU Emulator
 */
// Syscall numbers
export const SYSCALL = {
  EXIT: 0,
  PUTCHAR: 1,
  GETCHAR: 2,
  PUTS: 3,
  READ_SECTOR: 4,
  WRITE_SECTOR: 5,
} as const;

export class RiscVCpu {
  public x: Uint32Array; // Registers
  public pc: number;
  public memory: Uint8Array;
  public halted: boolean = false;
  public cycles: number = 0;
  public gpu: GraphicsCard;
  public storage: StorageController;
  public keyboard: KeyboardController;

  // Syscall-related state
  public exitCode: number = 0;
  public consoleOutput: string = '';

  constructor(config: RiscVConfig = {}) {
    const memorySize = config.memorySize ?? 64 * 1024; // 64KB default
    this.memory = new Uint8Array(memorySize);
    this.x = new Uint32Array(32);
    this.pc = config.initialPc ?? 0;
    this.gpu = new GraphicsCard();

    // Initialize storage with default devices
    const hdd = new HardDiskDrive(1024 * 1024); // 1MB HDD
    const cdrom = new CDROMDrive();
    const usb = new USBDrive();
    this.storage = new StorageController(hdd, cdrom, usb);

    // Initialize keyboard controller
    this.keyboard = new KeyboardController();
  }

  /**
   * Get the attached graphics card
   */
  getGraphicsCard(): GraphicsCard {
    return this.gpu;
  }

  /**
   * Get the storage controller
   */
  getStorageController(): StorageController {
    return this.storage;
  }

  /**
   * Reset the CPU to initial state
   */
  reset(): void {
    this.x.fill(0);
    this.pc = 0;
    this.halted = false;
    this.cycles = 0;
  }

  /**
   * Load a program into memory
   */
  loadProgram(program: Uint8Array, address: number = 0): void {
    for (let i = 0; i < program.length; i++) {
      this.memory[address + i] = program[i];
    }
  }

  /**
   * Read a 32-bit word from memory (little-endian)
   */
  readWord(address: number): number {
    // Route to GPU if address is in graphics range
    if (address >= GRAPHICS_BASE && this.gpu.isInRange(address)) {
      return this.gpu.mmioRead(address);
    }
    // Route to storage if address is in storage range
    if (address >= STORAGE_BASE && this.storage.isInRange(address)) {
      return this.storage.mmioRead(address);
    }
    // Route to keyboard if address is in keyboard range
    if (address >= KEYBOARD_BASE && this.keyboard.isInRange(address)) {
      return this.keyboard.mmioRead(address);
    }
    return (
      (this.memory[address] |
        (this.memory[address + 1] << 8) |
        (this.memory[address + 2] << 16) |
        (this.memory[address + 3] << 24)) >>>
      0
    );
  }

  /**
   * Read a 16-bit halfword from memory (little-endian)
   */
  readHalfword(address: number): number {
    // Route to GPU if address is in graphics range
    if (address >= GRAPHICS_BASE && this.gpu.isInRange(address)) {
      return this.gpu.mmioReadHalfword(address);
    }
    // Route to storage if address is in storage range
    if (address >= STORAGE_BASE && this.storage.isInRange(address)) {
      return this.storage.mmioReadHalfword(address);
    }
    // Route to keyboard if address is in keyboard range
    if (address >= KEYBOARD_BASE && this.keyboard.isInRange(address)) {
      return this.keyboard.mmioReadHalfword(address);
    }
    return this.memory[address] | (this.memory[address + 1] << 8);
  }

  /**
   * Read a byte from memory
   */
  readByte(address: number): number {
    // Route to GPU if address is in graphics range
    if (address >= GRAPHICS_BASE && this.gpu.isInRange(address)) {
      return this.gpu.mmioReadByte(address);
    }
    // Route to storage if address is in storage range
    if (address >= STORAGE_BASE && this.storage.isInRange(address)) {
      return this.storage.mmioReadByte(address);
    }
    // Route to keyboard if address is in keyboard range
    if (address >= KEYBOARD_BASE && this.keyboard.isInRange(address)) {
      return this.keyboard.mmioReadByte(address);
    }
    return this.memory[address];
  }

  /**
   * Write a 32-bit word to memory (little-endian)
   */
  writeWord(address: number, value: number): void {
    // Route to GPU if address is in graphics range
    if (address >= GRAPHICS_BASE && this.gpu.isInRange(address)) {
      this.gpu.mmioWrite(address, value);
      return;
    }
    // Route to storage if address is in storage range
    if (address >= STORAGE_BASE && this.storage.isInRange(address)) {
      this.storage.mmioWrite(address, value);
      return;
    }
    // Route to keyboard if address is in keyboard range (read-only, but route anyway)
    if (address >= KEYBOARD_BASE && this.keyboard.isInRange(address)) {
      this.keyboard.mmioWrite(address, value);
      return;
    }
    this.memory[address] = value & 0xff;
    this.memory[address + 1] = (value >> 8) & 0xff;
    this.memory[address + 2] = (value >> 16) & 0xff;
    this.memory[address + 3] = (value >> 24) & 0xff;
  }

  /**
   * Write a 16-bit halfword to memory (little-endian)
   */
  writeHalfword(address: number, value: number): void {
    // Route to GPU if address is in graphics range
    if (address >= GRAPHICS_BASE && this.gpu.isInRange(address)) {
      this.gpu.mmioWriteHalfword(address, value);
      return;
    }
    // Route to storage if address is in storage range
    if (address >= STORAGE_BASE && this.storage.isInRange(address)) {
      this.storage.mmioWriteHalfword(address, value);
      return;
    }
    // Route to keyboard if address is in keyboard range (read-only, but route anyway)
    if (address >= KEYBOARD_BASE && this.keyboard.isInRange(address)) {
      this.keyboard.mmioWriteHalfword(address, value);
      return;
    }
    this.memory[address] = value & 0xff;
    this.memory[address + 1] = (value >> 8) & 0xff;
  }

  /**
   * Write a byte to memory
   */
  writeByte(address: number, value: number): void {
    // Route to GPU if address is in graphics range
    if (address >= GRAPHICS_BASE && this.gpu.isInRange(address)) {
      this.gpu.mmioWriteByte(address, value);
      return;
    }
    // Route to storage if address is in storage range
    if (address >= STORAGE_BASE && this.storage.isInRange(address)) {
      this.storage.mmioWriteByte(address, value);
      return;
    }
    // Route to keyboard if address is in keyboard range (read-only, but route anyway)
    if (address >= KEYBOARD_BASE && this.keyboard.isInRange(address)) {
      this.keyboard.mmioWriteByte(address, value);
      return;
    }
    this.memory[address] = value & 0xff;
  }

  /**
   * Get register value (x0 always returns 0)
   */
  getReg(index: number): number {
    return index === 0 ? 0 : this.x[index];
  }

  /**
   * Get register value (alias for getReg)
   */
  getRegister(index: number): number {
    return this.getReg(index);
  }

  /**
   * Set register value (writes to x0 are ignored)
   */
  setReg(index: number, value: number): void {
    if (index !== 0) {
      this.x[index] = value >>> 0; // Ensure unsigned 32-bit
    }
  }

  /**
   * Decode R-type instruction
   */
  private decodeR(instruction: number): {
    rd: number;
    funct3: number;
    rs1: number;
    rs2: number;
    funct7: number;
  } {
    return {
      rd: (instruction >> 7) & 0x1f,
      funct3: (instruction >> 12) & 0x7,
      rs1: (instruction >> 15) & 0x1f,
      rs2: (instruction >> 20) & 0x1f,
      funct7: (instruction >> 25) & 0x7f,
    };
  }

  /**
   * Decode I-type instruction
   */
  private decodeI(instruction: number): {
    rd: number;
    funct3: number;
    rs1: number;
    imm: number;
  } {
    return {
      rd: (instruction >> 7) & 0x1f,
      funct3: (instruction >> 12) & 0x7,
      rs1: (instruction >> 15) & 0x1f,
      imm: signExtend(instruction >> 20, 12),
    };
  }

  /**
   * Decode S-type instruction
   */
  private decodeS(instruction: number): {
    funct3: number;
    rs1: number;
    rs2: number;
    imm: number;
  } {
    const imm4_0 = (instruction >> 7) & 0x1f;
    const imm11_5 = (instruction >> 25) & 0x7f;
    return {
      funct3: (instruction >> 12) & 0x7,
      rs1: (instruction >> 15) & 0x1f,
      rs2: (instruction >> 20) & 0x1f,
      imm: signExtend((imm11_5 << 5) | imm4_0, 12),
    };
  }

  /**
   * Decode B-type instruction
   */
  private decodeB(instruction: number): {
    funct3: number;
    rs1: number;
    rs2: number;
    imm: number;
  } {
    const imm11 = (instruction >> 7) & 0x1;
    const imm4_1 = (instruction >> 8) & 0xf;
    const imm10_5 = (instruction >> 25) & 0x3f;
    const imm12 = (instruction >> 31) & 0x1;
    return {
      funct3: (instruction >> 12) & 0x7,
      rs1: (instruction >> 15) & 0x1f,
      rs2: (instruction >> 20) & 0x1f,
      imm: signExtend(
        (imm12 << 12) | (imm11 << 11) | (imm10_5 << 5) | (imm4_1 << 1),
        13
      ),
    };
  }

  /**
   * Decode U-type instruction
   */
  private decodeU(instruction: number): { rd: number; imm: number } {
    return {
      rd: (instruction >> 7) & 0x1f,
      imm: instruction & 0xfffff000,
    };
  }

  /**
   * Decode J-type instruction
   */
  private decodeJ(instruction: number): { rd: number; imm: number } {
    const imm19_12 = (instruction >> 12) & 0xff;
    const imm11 = (instruction >> 20) & 0x1;
    const imm10_1 = (instruction >> 21) & 0x3ff;
    const imm20 = (instruction >> 31) & 0x1;
    return {
      rd: (instruction >> 7) & 0x1f,
      imm: signExtend(
        (imm20 << 20) | (imm19_12 << 12) | (imm11 << 11) | (imm10_1 << 1),
        21
      ),
    };
  }

  /**
   * Execute one instruction
   * Returns true if execution should continue, false if halted
   */
  step(): boolean {
    if (this.halted) {
      return false;
    }

    // Fetch instruction
    const instruction = this.readWord(this.pc);
    const opcode = instruction & 0x7f;

    // Default next PC
    let nextPc = this.pc + 4;

    switch (opcode) {
      case OPCODE.LUI: {
        // Load Upper Immediate
        const { rd, imm } = this.decodeU(instruction);
        this.setReg(rd, imm);
        break;
      }

      case OPCODE.AUIPC: {
        // Add Upper Immediate to PC
        const { rd, imm } = this.decodeU(instruction);
        this.setReg(rd, (this.pc + imm) >>> 0);
        break;
      }

      case OPCODE.JAL: {
        // Jump And Link
        const { rd, imm } = this.decodeJ(instruction);
        this.setReg(rd, this.pc + 4);
        nextPc = (this.pc + imm) >>> 0;
        break;
      }

      case OPCODE.JALR: {
        // Jump And Link Register
        const { rd, rs1, imm } = this.decodeI(instruction);
        const target = ((this.getReg(rs1) + imm) & ~1) >>> 0;
        this.setReg(rd, this.pc + 4);
        nextPc = target;
        break;
      }

      case OPCODE.BRANCH: {
        // Branch instructions
        const { funct3, rs1, rs2, imm } = this.decodeB(instruction);
        const a = this.getReg(rs1);
        const b = this.getReg(rs2);
        let takeBranch = false;

        switch (funct3) {
          case BRANCH_FUNCT3.BEQ:
            takeBranch = a === b;
            break;
          case BRANCH_FUNCT3.BNE:
            takeBranch = a !== b;
            break;
          case BRANCH_FUNCT3.BLT:
            takeBranch = (a | 0) < (b | 0);
            break;
          case BRANCH_FUNCT3.BGE:
            takeBranch = (a | 0) >= (b | 0);
            break;
          case BRANCH_FUNCT3.BLTU:
            takeBranch = a < b;
            break;
          case BRANCH_FUNCT3.BGEU:
            takeBranch = a >= b;
            break;
        }

        if (takeBranch) {
          nextPc = (this.pc + imm) >>> 0;
        }
        break;
      }

      case OPCODE.LOAD: {
        // Load instructions
        const { rd, funct3, rs1, imm } = this.decodeI(instruction);
        const address = (this.getReg(rs1) + imm) >>> 0;

        switch (funct3) {
          case LOAD_FUNCT3.LB:
            this.setReg(rd, signExtend(this.readByte(address), 8));
            break;
          case LOAD_FUNCT3.LH:
            this.setReg(rd, signExtend(this.readHalfword(address), 16));
            break;
          case LOAD_FUNCT3.LW:
            this.setReg(rd, this.readWord(address));
            break;
          case LOAD_FUNCT3.LBU:
            this.setReg(rd, this.readByte(address));
            break;
          case LOAD_FUNCT3.LHU:
            this.setReg(rd, this.readHalfword(address));
            break;
        }
        break;
      }

      case OPCODE.STORE: {
        // Store instructions
        const { funct3, rs1, rs2, imm } = this.decodeS(instruction);
        const address = (this.getReg(rs1) + imm) >>> 0;
        const value = this.getReg(rs2);

        switch (funct3) {
          case STORE_FUNCT3.SB:
            this.writeByte(address, value);
            break;
          case STORE_FUNCT3.SH:
            this.writeHalfword(address, value);
            break;
          case STORE_FUNCT3.SW:
            this.writeWord(address, value);
            break;
        }
        break;
      }

      case OPCODE.OP_IMM: {
        // Integer Register-Immediate operations
        const { rd, funct3, rs1, imm } = this.decodeI(instruction);
        const a = this.getReg(rs1);
        let result = 0;

        switch (funct3) {
          case ALU_IMM_FUNCT3.ADDI:
            result = (a + imm) >>> 0;
            break;
          case ALU_IMM_FUNCT3.SLTI:
            result = (a | 0) < imm ? 1 : 0;
            break;
          case ALU_IMM_FUNCT3.SLTIU:
            result = a < (imm >>> 0) ? 1 : 0;
            break;
          case ALU_IMM_FUNCT3.XORI:
            result = (a ^ imm) >>> 0;
            break;
          case ALU_IMM_FUNCT3.ORI:
            result = (a | imm) >>> 0;
            break;
          case ALU_IMM_FUNCT3.ANDI:
            result = (a & imm) >>> 0;
            break;
          case ALU_IMM_FUNCT3.SLLI: {
            const shamt = imm & 0x1f;
            result = (a << shamt) >>> 0;
            break;
          }
          case ALU_IMM_FUNCT3.SRLI_SRAI: {
            const shamt = imm & 0x1f;
            const isArithmetic = (instruction >> 30) & 0x1;
            if (isArithmetic) {
              result = (a >> shamt) >>> 0; // SRAI (arithmetic)
            } else {
              result = a >>> shamt; // SRLI (logical)
            }
            break;
          }
        }

        this.setReg(rd, result);
        break;
      }

      case OPCODE.OP: {
        // Integer Register-Register operations
        const { rd, funct3, rs1, rs2, funct7 } = this.decodeR(instruction);
        const a = this.getReg(rs1);
        const b = this.getReg(rs2);
        let result = 0;

        switch (funct3) {
          case ALU_FUNCT3.ADD_SUB:
            if (funct7 === 0x20) {
              result = (a - b) >>> 0; // SUB
            } else {
              result = (a + b) >>> 0; // ADD
            }
            break;
          case ALU_FUNCT3.SLL:
            result = (a << (b & 0x1f)) >>> 0;
            break;
          case ALU_FUNCT3.SLT:
            result = (a | 0) < (b | 0) ? 1 : 0;
            break;
          case ALU_FUNCT3.SLTU:
            result = a < b ? 1 : 0;
            break;
          case ALU_FUNCT3.XOR:
            result = (a ^ b) >>> 0;
            break;
          case ALU_FUNCT3.SRL_SRA:
            if (funct7 === 0x20) {
              result = (a >> (b & 0x1f)) >>> 0; // SRA (arithmetic)
            } else {
              result = a >>> (b & 0x1f); // SRL (logical)
            }
            break;
          case ALU_FUNCT3.OR:
            result = (a | b) >>> 0;
            break;
          case ALU_FUNCT3.AND:
            result = (a & b) >>> 0;
            break;
        }

        this.setReg(rd, result);
        break;
      }

      case OPCODE.FENCE: {
        // Memory fence - no-op in single-threaded emulator
        break;
      }

      case OPCODE.SYSTEM: {
        // System instructions
        const { imm } = this.decodeI(instruction);

        if (imm === 0) {
          // ECALL - environment call (dispatch to syscall handler)
          const result = this.handleSyscall();
          if (result === false) {
            return false; // CPU halted
          }
        } else if (imm === 1) {
          // EBREAK - breakpoint
          this.halted = true;
          return false;
        }
        break;
      }

      default:
        // Unknown opcode - halt
        this.halted = true;
        return false;
    }

    this.pc = nextPc;
    this.cycles++;
    return true;
  }

  /**
   * Run until halted or max cycles reached
   */
  run(maxCycles: number = 1000000): number {
    let executed = 0;
    while (!this.halted && executed < maxCycles) {
      this.step();
      executed++;
    }
    return executed;
  }

  /**
   * Get current CPU state
   */
  getState(): RiscVState {
    return {
      x: new Uint32Array(this.x),
      pc: this.pc,
      memory: new Uint8Array(this.memory),
      halted: this.halted,
      cycles: this.cycles,
    };
  }

  /**
   * Handle ECALL syscall
   * Returns false if CPU should halt, true to continue
   */
  private handleSyscall(): boolean {
    const syscallNum = this.getReg(17); // a7
    const a0 = this.getReg(10);
    const a1 = this.getReg(11);

    switch (syscallNum) {
      case SYSCALL.EXIT:
        // Exit with code in a0
        this.exitCode = a0;
        this.halted = true;
        return false;

      case SYSCALL.PUTCHAR:
        // Write character in a0 to console
        this.syscallPutchar(a0);
        this.setReg(10, 0); // Return 0 (success)
        return true;

      case SYSCALL.GETCHAR:
        // Read character from keyboard
        this.setReg(10, this.syscallGetchar());
        return true;

      case SYSCALL.PUTS:
        // Print null-terminated string at address a0
        this.setReg(10, this.syscallPuts(a0));
        return true;

      case SYSCALL.READ_SECTOR:
        // Read sector a0 to buffer at a1
        this.setReg(10, this.syscallReadSector(a0, a1));
        return true;

      case SYSCALL.WRITE_SECTOR:
        // Write buffer at a1 to sector a0
        this.setReg(10, this.syscallWriteSector(a0, a1));
        return true;

      default:
        // Unknown syscall - return -1
        this.setReg(10, 0xFFFFFFFF);
        return true;
    }
  }

  /**
   * Syscall: putchar - write character to console
   */
  private syscallPutchar(char: number): void {
    const ch = char & 0xFF;
    this.consoleOutput += String.fromCharCode(ch);

    // Also write to screen VRAM if it's a printable character
    const cursor = this.gpu.getCursorPosition();

    if (ch === 0x0D || ch === 0x0A) {
      // Carriage return or newline - move to start of next line
      this.gpu.writeRegister(0x04, 0); // CURSOR_X = 0
      this.gpu.writeRegister(0x08, Math.min(cursor.y + 1, 24)); // CURSOR_Y++
    } else if (ch === 0x08) {
      // Backspace - move cursor back
      if (cursor.x > 0) {
        this.gpu.writeRegister(0x04, cursor.x - 1);
        this.gpu.writeTextVram(cursor.x - 1, cursor.y, 0x20, 0x07);
      }
    } else if (ch >= 0x20) {
      // Printable character - write to VRAM and advance cursor
      this.gpu.writeTextVram(cursor.x, cursor.y, ch, 0x07);
      const newX = cursor.x + 1;
      if (newX >= 80) {
        // Line wrap
        this.gpu.writeRegister(0x04, 0);
        this.gpu.writeRegister(0x08, Math.min(cursor.y + 1, 24));
      } else {
        this.gpu.writeRegister(0x04, newX);
      }
    }
  }

  /**
   * Syscall: getchar - read character from keyboard (non-blocking)
   */
  private syscallGetchar(): number {
    if (this.keyboard.hasKey()) {
      return this.keyboard.readRegister(0x04); // Read DATA register
    }
    return 0xFFFFFFFF; // -1 (no key available)
  }

  /**
   * Syscall: puts - print null-terminated string
   */
  private syscallPuts(address: number): number {
    let count = 0;
    let addr = address;
    while (true) {
      const ch = this.readByte(addr);
      if (ch === 0) break;
      this.syscallPutchar(ch);
      addr++;
      count++;
      // Safety limit
      if (count > 10000) break;
    }
    return count;
  }

  /**
   * Syscall: read_sector - read disk sector to memory
   */
  private syscallReadSector(sector: number, buffer: number): number {
    try {
      const data = this.storage.getHdd().read(sector, 1); // Read 1 sector
      for (let i = 0; i < data.length; i++) {
        this.writeByte(buffer + i, data[i]);
      }
      return 0; // Success
    } catch {
      return 0xFFFFFFFF; // Error
    }
  }

  /**
   * Syscall: write_sector - write memory to disk sector
   */
  private syscallWriteSector(sector: number, buffer: number): number {
    try {
      const data = new Uint8Array(512);
      for (let i = 0; i < 512; i++) {
        data[i] = this.readByte(buffer + i);
      }
      this.storage.getHdd().write(sector, data);
      return 0; // Success
    } catch {
      return 0xFFFFFFFF; // Error
    }
  }
}
