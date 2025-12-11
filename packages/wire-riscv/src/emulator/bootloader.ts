/**
 * RISC-V Bootloader
 *
 * Generates machine code for a simple bootloader that:
 * 1. Initializes the stack pointer
 * 2. Prints boot message
 * 3. Loads program from disk to memory
 * 4. Jumps to loaded program
 */

import { SYSCALL } from './cpu.js';

/**
 * Boot configuration constants
 */
export const BOOT_CONFIG = {
  /** Base address for bootloader */
  BOOTLOADER_BASE: 0x0000,
  /** Size of bootloader area (4KB) */
  BOOTLOADER_SIZE: 0x1000,
  /** Base address for loaded programs */
  PROGRAM_BASE: 0x1000,
  /** Top of stack (stack grows down) */
  STACK_TOP: 0xFFFF,
  /** Boot sector on disk (unused) */
  BOOT_SECTOR: 0,
  /** First sector of program on disk */
  PROGRAM_SECTOR: 1,
  /** Sector size in bytes */
  SECTOR_SIZE: 512,
} as const;

/**
 * RISC-V instruction encoding helpers
 */
class RiscVEncoder {
  /**
   * Encode LUI instruction: rd = imm << 12
   */
  static lui(rd: number, imm: number): number {
    // U-type: imm[31:12] | rd | opcode
    return ((imm & 0xFFFFF) << 12) | (rd << 7) | 0x37;
  }

  /**
   * Encode ADDI instruction: rd = rs1 + imm
   */
  static addi(rd: number, rs1: number, imm: number): number {
    // I-type: imm[11:0] | rs1 | funct3 | rd | opcode
    return ((imm & 0xFFF) << 20) | (rs1 << 15) | (0 << 12) | (rd << 7) | 0x13;
  }

  /**
   * Encode ORI instruction: rd = rs1 | imm
   */
  static ori(rd: number, rs1: number, imm: number): number {
    // I-type: imm[11:0] | rs1 | funct3 | rd | opcode
    return ((imm & 0xFFF) << 20) | (rs1 << 15) | (6 << 12) | (rd << 7) | 0x13;
  }

  /**
   * Encode JAL instruction: rd = PC+4; PC = PC + imm
   */
  static jal(rd: number, imm: number): number {
    // J-type: imm[20|10:1|11|19:12] | rd | opcode
    const bit20 = (imm >> 20) & 1;
    const bits10_1 = (imm >> 1) & 0x3FF;
    const bit11 = (imm >> 11) & 1;
    const bits19_12 = (imm >> 12) & 0xFF;
    return (bit20 << 31) | (bits10_1 << 21) | (bit11 << 20) | (bits19_12 << 12) | (rd << 7) | 0x6F;
  }

  /**
   * Encode JALR instruction: rd = PC+4; PC = (rs1 + imm) & ~1
   */
  static jalr(rd: number, rs1: number, imm: number): number {
    // I-type: imm[11:0] | rs1 | funct3 | rd | opcode
    return ((imm & 0xFFF) << 20) | (rs1 << 15) | (0 << 12) | (rd << 7) | 0x67;
  }

  /**
   * Encode ECALL instruction
   */
  static ecall(): number {
    return 0x00000073;
  }

  /**
   * Encode SB instruction: M[rs1+imm] = rs2[7:0]
   */
  static sb(rs1: number, rs2: number, imm: number): number {
    // S-type: imm[11:5] | rs2 | rs1 | funct3 | imm[4:0] | opcode
    const imm11_5 = (imm >> 5) & 0x7F;
    const imm4_0 = imm & 0x1F;
    return (imm11_5 << 25) | (rs2 << 20) | (rs1 << 15) | (0 << 12) | (imm4_0 << 7) | 0x23;
  }

  /**
   * Encode LB instruction: rd = M[rs1+imm] (sign-extended)
   */
  static lb(rd: number, rs1: number, imm: number): number {
    // I-type: imm[11:0] | rs1 | funct3 | rd | opcode
    return ((imm & 0xFFF) << 20) | (rs1 << 15) | (0 << 12) | (rd << 7) | 0x03;
  }

  /**
   * Encode BNE instruction: if (rs1 != rs2) PC += imm
   */
  static bne(rs1: number, rs2: number, imm: number): number {
    // B-type: imm[12|10:5] | rs2 | rs1 | funct3 | imm[4:1|11] | opcode
    const bit12 = (imm >> 12) & 1;
    const bits10_5 = (imm >> 5) & 0x3F;
    const bits4_1 = (imm >> 1) & 0xF;
    const bit11 = (imm >> 11) & 1;
    return (bit12 << 31) | (bits10_5 << 25) | (rs2 << 20) | (rs1 << 15) | (1 << 12) | (bits4_1 << 8) | (bit11 << 7) | 0x63;
  }

  /**
   * Encode BEQ instruction: if (rs1 == rs2) PC += imm
   */
  static beq(rs1: number, rs2: number, imm: number): number {
    // B-type: imm[12|10:5] | rs2 | rs1 | funct3 | imm[4:1|11] | opcode
    const bit12 = (imm >> 12) & 1;
    const bits10_5 = (imm >> 5) & 0x3F;
    const bits4_1 = (imm >> 1) & 0xF;
    const bit11 = (imm >> 11) & 1;
    return (bit12 << 31) | (bits10_5 << 25) | (rs2 << 20) | (rs1 << 15) | (0 << 12) | (bits4_1 << 8) | (bit11 << 7) | 0x63;
  }

  /**
   * Encode ADD instruction: rd = rs1 + rs2
   */
  static add(rd: number, rs1: number, rs2: number): number {
    // R-type: funct7 | rs2 | rs1 | funct3 | rd | opcode
    return (0 << 25) | (rs2 << 20) | (rs1 << 15) | (0 << 12) | (rd << 7) | 0x33;
  }
}

// Register aliases
const REG = {
  ZERO: 0,  // x0 - hardwired zero
  RA: 1,    // x1 - return address
  SP: 2,    // x2 - stack pointer
  GP: 3,    // x3 - global pointer
  TP: 4,    // x4 - thread pointer
  T0: 5,    // x5 - temporary 0
  T1: 6,    // x6 - temporary 1
  T2: 7,    // x7 - temporary 2
  S0: 8,    // x8 - saved register 0 / frame pointer
  S1: 9,    // x9 - saved register 1
  A0: 10,   // x10 - argument 0 / return value
  A1: 11,   // x11 - argument 1
  A2: 12,   // x12 - argument 2
  A3: 13,   // x13 - argument 3
  A4: 14,   // x14 - argument 4
  A5: 15,   // x15 - argument 5
  A6: 16,   // x16 - argument 6
  A7: 17,   // x17 - syscall number
} as const;

/**
 * Bootloader generator
 */
export class Bootloader {
  private sectorCount: number = 1;

  /**
   * Set the number of sectors to load for the program
   */
  setSectorCount(count: number): void {
    this.sectorCount = count;
  }

  /**
   * Generate bootloader machine code
   */
  generate(): Uint8Array {
    const instructions: number[] = [];

    // === Step 1: Initialize stack pointer ===
    // sp = 0xFFFF (lui + ori to load full 16-bit value)
    // lui sp, 0x10 (sp = 0x10000 = 65536)
    instructions.push(RiscVEncoder.lui(REG.SP, 0x10));
    // addi sp, sp, -1 (sp = 0xFFFF)
    instructions.push(RiscVEncoder.addi(REG.SP, REG.SP, -1));

    // === Step 2: Print boot message ===
    // Store boot message in memory and print using puts syscall
    // We'll use putchar syscalls instead for simplicity
    const bootMessage = 'Booting...\n';
    for (const char of bootMessage) {
      // a0 = char
      instructions.push(RiscVEncoder.addi(REG.A0, REG.ZERO, char.charCodeAt(0)));
      // a7 = SYSCALL.PUTCHAR (1)
      instructions.push(RiscVEncoder.addi(REG.A7, REG.ZERO, SYSCALL.PUTCHAR));
      // ecall
      instructions.push(RiscVEncoder.ecall());
    }

    // === Step 3: Load program from disk ===
    // For each sector, call read_sector syscall
    // Initialize loop counter in t0
    instructions.push(RiscVEncoder.addi(REG.T0, REG.ZERO, 0)); // t0 = sector offset (0, 1, 2...)

    // Load destination address into t1 = PROGRAM_BASE
    instructions.push(RiscVEncoder.lui(REG.T1, BOOT_CONFIG.PROGRAM_BASE >> 12));
    if ((BOOT_CONFIG.PROGRAM_BASE & 0xFFF) !== 0) {
      instructions.push(RiscVEncoder.addi(REG.T1, REG.T1, BOOT_CONFIG.PROGRAM_BASE & 0xFFF));
    }

    // Load sector count into t2
    instructions.push(RiscVEncoder.addi(REG.T2, REG.ZERO, this.sectorCount));

    // Loop start (mark current position for branch calculation)
    const loopStartIndex = instructions.length;

    // a0 = PROGRAM_SECTOR + t0 (sector number)
    instructions.push(RiscVEncoder.addi(REG.A0, REG.T0, BOOT_CONFIG.PROGRAM_SECTOR));
    // a1 = t1 (buffer address)
    instructions.push(RiscVEncoder.add(REG.A1, REG.T1, REG.ZERO));
    // a7 = SYSCALL.READ_SECTOR (4)
    instructions.push(RiscVEncoder.addi(REG.A7, REG.ZERO, SYSCALL.READ_SECTOR));
    // ecall
    instructions.push(RiscVEncoder.ecall());

    // Advance buffer: t1 += SECTOR_SIZE (512)
    instructions.push(RiscVEncoder.addi(REG.T1, REG.T1, BOOT_CONFIG.SECTOR_SIZE));

    // Increment sector counter: t0 += 1
    instructions.push(RiscVEncoder.addi(REG.T0, REG.T0, 1));

    // Loop if t0 < t2: bne t0, t2, loop_start
    const loopEndIndex = instructions.length;
    const branchOffset = (loopStartIndex - loopEndIndex) * 4; // Each instruction is 4 bytes
    instructions.push(RiscVEncoder.bne(REG.T0, REG.T2, branchOffset));

    // === Step 4: Jump to loaded program ===
    // Load PROGRAM_BASE into t0
    instructions.push(RiscVEncoder.lui(REG.T0, BOOT_CONFIG.PROGRAM_BASE >> 12));
    if ((BOOT_CONFIG.PROGRAM_BASE & 0xFFF) !== 0) {
      instructions.push(RiscVEncoder.addi(REG.T0, REG.T0, BOOT_CONFIG.PROGRAM_BASE & 0xFFF));
    }
    // jalr x0, t0, 0 (jump to program, don't save return address)
    instructions.push(RiscVEncoder.jalr(REG.ZERO, REG.T0, 0));

    // Convert instructions to byte array (little-endian)
    const bytes = new Uint8Array(instructions.length * 4);
    for (let i = 0; i < instructions.length; i++) {
      const inst = instructions[i];
      bytes[i * 4 + 0] = inst & 0xFF;
      bytes[i * 4 + 1] = (inst >> 8) & 0xFF;
      bytes[i * 4 + 2] = (inst >> 16) & 0xFF;
      bytes[i * 4 + 3] = (inst >> 24) & 0xFF;
    }

    return bytes;
  }
}
