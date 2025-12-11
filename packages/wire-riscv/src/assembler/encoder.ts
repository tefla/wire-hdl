/**
 * RISC-V Instruction Encoder
 *
 * Encodes RISC-V instructions into 32-bit machine code.
 */

// Opcodes
const OPCODE_LUI = 0b0110111;
const OPCODE_AUIPC = 0b0010111;
const OPCODE_JAL = 0b1101111;
const OPCODE_JALR = 0b1100111;
const OPCODE_BRANCH = 0b1100011;
const OPCODE_LOAD = 0b0000011;
const OPCODE_STORE = 0b0100011;
const OPCODE_OP_IMM = 0b0010011;
const OPCODE_OP = 0b0110011;
const OPCODE_SYSTEM = 0b1110011;

// funct3 codes for R-type and I-type ALU
const FUNCT3_ADD_SUB = 0b000;
const FUNCT3_SLL = 0b001;
const FUNCT3_SLT = 0b010;
const FUNCT3_SLTU = 0b011;
const FUNCT3_XOR = 0b100;
const FUNCT3_SRL_SRA = 0b101;
const FUNCT3_OR = 0b110;
const FUNCT3_AND = 0b111;

// funct3 codes for branches
const FUNCT3_BEQ = 0b000;
const FUNCT3_BNE = 0b001;
const FUNCT3_BLT = 0b100;
const FUNCT3_BGE = 0b101;
const FUNCT3_BLTU = 0b110;
const FUNCT3_BGEU = 0b111;

// funct3 codes for loads
const FUNCT3_LB = 0b000;
const FUNCT3_LH = 0b001;
const FUNCT3_LW = 0b010;
const FUNCT3_LBU = 0b100;
const FUNCT3_LHU = 0b101;

// funct3 codes for stores
const FUNCT3_SB = 0b000;
const FUNCT3_SH = 0b001;
const FUNCT3_SW = 0b010;

// funct7 codes
const FUNCT7_NORMAL = 0b0000000;
const FUNCT7_ALT = 0b0100000;

export class Encoder {
  /**
   * Encode R-type instruction
   * Format: funct7[6:0] | rs2[4:0] | rs1[4:0] | funct3[2:0] | rd[4:0] | opcode[6:0]
   */
  static encodeR(mnemonic: string, rd: number, rs1: number, rs2: number): number {
    let funct3 = 0;
    let funct7 = FUNCT7_NORMAL;

    switch (mnemonic) {
      case 'ADD':
        funct3 = FUNCT3_ADD_SUB;
        break;
      case 'SUB':
        funct3 = FUNCT3_ADD_SUB;
        funct7 = FUNCT7_ALT;
        break;
      case 'SLL':
        funct3 = FUNCT3_SLL;
        break;
      case 'SLT':
        funct3 = FUNCT3_SLT;
        break;
      case 'SLTU':
        funct3 = FUNCT3_SLTU;
        break;
      case 'XOR':
        funct3 = FUNCT3_XOR;
        break;
      case 'SRL':
        funct3 = FUNCT3_SRL_SRA;
        break;
      case 'SRA':
        funct3 = FUNCT3_SRL_SRA;
        funct7 = FUNCT7_ALT;
        break;
      case 'OR':
        funct3 = FUNCT3_OR;
        break;
      case 'AND':
        funct3 = FUNCT3_AND;
        break;
      default:
        throw new Error(`Unknown R-type instruction: ${mnemonic}`);
    }

    return (
      ((funct7 & 0x7f) << 25) |
      ((rs2 & 0x1f) << 20) |
      ((rs1 & 0x1f) << 15) |
      ((funct3 & 0x7) << 12) |
      ((rd & 0x1f) << 7) |
      OPCODE_OP
    ) >>> 0;
  }

  /**
   * Encode I-type instruction
   * Format: imm[11:0] | rs1[4:0] | funct3[2:0] | rd[4:0] | opcode[6:0]
   */
  static encodeI(mnemonic: string, rd: number, rs1: number, imm: number): number {
    let funct3 = 0;
    let opcode = OPCODE_OP_IMM;
    let encodedImm = imm & 0xfff;

    switch (mnemonic) {
      // ALU immediates
      case 'ADDI':
        funct3 = FUNCT3_ADD_SUB;
        break;
      case 'SLTI':
        funct3 = FUNCT3_SLT;
        break;
      case 'SLTIU':
        funct3 = FUNCT3_SLTU;
        break;
      case 'XORI':
        funct3 = FUNCT3_XOR;
        break;
      case 'ORI':
        funct3 = FUNCT3_OR;
        break;
      case 'ANDI':
        funct3 = FUNCT3_AND;
        break;
      case 'SLLI':
        funct3 = FUNCT3_SLL;
        encodedImm = imm & 0x1f; // shamt is only 5 bits
        break;
      case 'SRLI':
        funct3 = FUNCT3_SRL_SRA;
        encodedImm = imm & 0x1f;
        break;
      case 'SRAI':
        funct3 = FUNCT3_SRL_SRA;
        encodedImm = (0x400 | (imm & 0x1f)); // Set bit 10 for arithmetic shift
        break;

      // Loads
      case 'LB':
        funct3 = FUNCT3_LB;
        opcode = OPCODE_LOAD;
        break;
      case 'LH':
        funct3 = FUNCT3_LH;
        opcode = OPCODE_LOAD;
        break;
      case 'LW':
        funct3 = FUNCT3_LW;
        opcode = OPCODE_LOAD;
        break;
      case 'LBU':
        funct3 = FUNCT3_LBU;
        opcode = OPCODE_LOAD;
        break;
      case 'LHU':
        funct3 = FUNCT3_LHU;
        opcode = OPCODE_LOAD;
        break;

      // JALR
      case 'JALR':
        funct3 = 0;
        opcode = OPCODE_JALR;
        break;

      // System
      case 'ECALL':
      case 'EBREAK':
        funct3 = 0;
        opcode = OPCODE_SYSTEM;
        break;

      default:
        throw new Error(`Unknown I-type instruction: ${mnemonic}`);
    }

    return (
      ((encodedImm & 0xfff) << 20) |
      ((rs1 & 0x1f) << 15) |
      ((funct3 & 0x7) << 12) |
      ((rd & 0x1f) << 7) |
      opcode
    ) >>> 0;
  }

  /**
   * Encode S-type instruction
   * Format: imm[11:5] | rs2[4:0] | rs1[4:0] | funct3[2:0] | imm[4:0] | opcode[6:0]
   */
  static encodeS(mnemonic: string, rs1: number, rs2: number, imm: number): number {
    let funct3 = 0;

    switch (mnemonic) {
      case 'SB':
        funct3 = FUNCT3_SB;
        break;
      case 'SH':
        funct3 = FUNCT3_SH;
        break;
      case 'SW':
        funct3 = FUNCT3_SW;
        break;
      default:
        throw new Error(`Unknown S-type instruction: ${mnemonic}`);
    }

    const imm11_5 = (imm >> 5) & 0x7f;
    const imm4_0 = imm & 0x1f;

    return (
      ((imm11_5 & 0x7f) << 25) |
      ((rs2 & 0x1f) << 20) |
      ((rs1 & 0x1f) << 15) |
      ((funct3 & 0x7) << 12) |
      ((imm4_0 & 0x1f) << 7) |
      OPCODE_STORE
    ) >>> 0;
  }

  /**
   * Encode B-type instruction
   * Format: imm[12|10:5] | rs2[4:0] | rs1[4:0] | funct3[2:0] | imm[4:1|11] | opcode[6:0]
   */
  static encodeB(mnemonic: string, rs1: number, rs2: number, imm: number): number {
    let funct3 = 0;

    switch (mnemonic) {
      case 'BEQ':
        funct3 = FUNCT3_BEQ;
        break;
      case 'BNE':
        funct3 = FUNCT3_BNE;
        break;
      case 'BLT':
        funct3 = FUNCT3_BLT;
        break;
      case 'BGE':
        funct3 = FUNCT3_BGE;
        break;
      case 'BLTU':
        funct3 = FUNCT3_BLTU;
        break;
      case 'BGEU':
        funct3 = FUNCT3_BGEU;
        break;
      default:
        throw new Error(`Unknown B-type instruction: ${mnemonic}`);
    }

    // B-type immediate encoding (scrambled bits)
    const imm12 = (imm >> 12) & 0x1;
    const imm11 = (imm >> 11) & 0x1;
    const imm10_5 = (imm >> 5) & 0x3f;
    const imm4_1 = (imm >> 1) & 0xf;

    return (
      ((imm12 & 0x1) << 31) |
      ((imm10_5 & 0x3f) << 25) |
      ((rs2 & 0x1f) << 20) |
      ((rs1 & 0x1f) << 15) |
      ((funct3 & 0x7) << 12) |
      ((imm4_1 & 0xf) << 8) |
      ((imm11 & 0x1) << 7) |
      OPCODE_BRANCH
    ) >>> 0;
  }

  /**
   * Encode U-type instruction
   * Format: imm[31:12] | rd[4:0] | opcode[6:0]
   */
  static encodeU(mnemonic: string, rd: number, imm: number): number {
    let opcode = 0;

    switch (mnemonic) {
      case 'LUI':
        opcode = OPCODE_LUI;
        break;
      case 'AUIPC':
        opcode = OPCODE_AUIPC;
        break;
      default:
        throw new Error(`Unknown U-type instruction: ${mnemonic}`);
    }

    // U-type immediate is the upper 20 bits
    return (
      ((imm & 0xfffff) << 12) |
      ((rd & 0x1f) << 7) |
      opcode
    ) >>> 0;
  }

  /**
   * Encode J-type instruction
   * Format: imm[20|10:1|11|19:12] | rd[4:0] | opcode[6:0]
   */
  static encodeJ(mnemonic: string, rd: number, imm: number): number {
    if (mnemonic !== 'JAL') {
      throw new Error(`Unknown J-type instruction: ${mnemonic}`);
    }

    // J-type immediate encoding (scrambled bits)
    const imm20 = (imm >> 20) & 0x1;
    const imm19_12 = (imm >> 12) & 0xff;
    const imm11 = (imm >> 11) & 0x1;
    const imm10_1 = (imm >> 1) & 0x3ff;

    return (
      ((imm20 & 0x1) << 31) |
      ((imm10_1 & 0x3ff) << 21) |
      ((imm11 & 0x1) << 20) |
      ((imm19_12 & 0xff) << 12) |
      ((rd & 0x1f) << 7) |
      OPCODE_JAL
    ) >>> 0;
  }

  /**
   * Convert 32-bit instruction to little-endian byte array
   */
  static toBytes(instruction: number): number[] {
    return [
      instruction & 0xff,
      (instruction >> 8) & 0xff,
      (instruction >> 16) & 0xff,
      (instruction >> 24) & 0xff,
    ];
  }
}
