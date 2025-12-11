import { describe, it, expect } from 'vitest';
import { Encoder } from '../../src/assembler/encoder.js';

describe('Encoder', () => {
  describe('R-type instructions', () => {
    it('should encode ADD x1, x2, x3', () => {
      const encoded = Encoder.encodeR('ADD', 1, 2, 3);
      // ADD: funct7=0x00, funct3=0x0, opcode=0x33
      // Expected: 0x003100B3
      expect(encoded).toBe(0x003100b3);
    });

    it('should encode SUB x1, x2, x3', () => {
      const encoded = Encoder.encodeR('SUB', 1, 2, 3);
      // SUB: funct7=0x20, funct3=0x0, opcode=0x33
      // Expected: 0x403100B3
      expect(encoded).toBe(0x403100b3);
    });

    it('should encode AND x3, x1, x2', () => {
      const encoded = Encoder.encodeR('AND', 3, 1, 2);
      // AND: funct7=0x00, funct3=0x7, opcode=0x33
      expect(encoded).toBe(0x0020f1b3);
    });

    it('should encode OR x3, x1, x2', () => {
      const encoded = Encoder.encodeR('OR', 3, 1, 2);
      // OR: funct7=0x00, funct3=0x6, opcode=0x33
      expect(encoded).toBe(0x0020e1b3);
    });

    it('should encode XOR x3, x1, x2', () => {
      const encoded = Encoder.encodeR('XOR', 3, 1, 2);
      // XOR: funct7=0x00, funct3=0x4, opcode=0x33
      expect(encoded).toBe(0x0020c1b3);
    });

    it('should encode SLL x2, x1, x3', () => {
      const encoded = Encoder.encodeR('SLL', 2, 1, 3);
      // SLL: funct7=0x00, funct3=0x1, opcode=0x33
      expect((encoded & 0x7f)).toBe(0x33); // opcode
      expect(((encoded >> 12) & 0x7)).toBe(0x1); // funct3
    });

    it('should encode SRL x2, x1, x3', () => {
      const encoded = Encoder.encodeR('SRL', 2, 1, 3);
      // SRL: funct7=0x00, funct3=0x5, opcode=0x33
      expect(((encoded >> 12) & 0x7)).toBe(0x5);
      expect(((encoded >> 25) & 0x7f)).toBe(0x00);
    });

    it('should encode SRA x2, x1, x3', () => {
      const encoded = Encoder.encodeR('SRA', 2, 1, 3);
      // SRA: funct7=0x20, funct3=0x5, opcode=0x33
      expect(((encoded >> 12) & 0x7)).toBe(0x5);
      expect(((encoded >> 25) & 0x7f)).toBe(0x20);
    });

    it('should encode SLT x3, x1, x2', () => {
      const encoded = Encoder.encodeR('SLT', 3, 1, 2);
      // SLT: funct7=0x00, funct3=0x2, opcode=0x33
      expect(encoded).toBe(0x0020a1b3);
    });

    it('should encode SLTU x3, x1, x2', () => {
      const encoded = Encoder.encodeR('SLTU', 3, 1, 2);
      // SLTU: funct7=0x00, funct3=0x3, opcode=0x33
      expect(encoded).toBe(0x0020b1b3);
    });
  });

  describe('I-type ALU instructions', () => {
    it('should encode ADDI x1, x0, 5', () => {
      const encoded = Encoder.encodeI('ADDI', 1, 0, 5);
      // ADDI: funct3=0x0, opcode=0x13
      expect(encoded).toBe(0x00500093);
    });

    it('should encode ADDI x1, x0, -1', () => {
      const encoded = Encoder.encodeI('ADDI', 1, 0, -1);
      // -1 in 12-bit signed = 0xFFF
      expect(encoded).toBe(0xfff00093);
    });

    it('should encode SLTI x1, x2, 50', () => {
      const encoded = Encoder.encodeI('SLTI', 1, 2, 50);
      // SLTI: funct3=0x2, opcode=0x13
      expect((encoded & 0x7f)).toBe(0x13);
      expect(((encoded >> 12) & 0x7)).toBe(0x2);
    });

    it('should encode SLTIU x1, x2, 50', () => {
      const encoded = Encoder.encodeI('SLTIU', 1, 2, 50);
      // SLTIU: funct3=0x3, opcode=0x13
      expect(((encoded >> 12) & 0x7)).toBe(0x3);
    });

    it('should encode XORI x1, x2, 0xFF', () => {
      const encoded = Encoder.encodeI('XORI', 1, 2, 0xFF);
      // XORI: funct3=0x4, opcode=0x13
      expect(((encoded >> 12) & 0x7)).toBe(0x4);
      expect((encoded >> 20) & 0xfff).toBe(0xFF);
    });

    it('should encode ORI x1, x2, 0x0F', () => {
      const encoded = Encoder.encodeI('ORI', 1, 2, 0x0F);
      // ORI: funct3=0x6, opcode=0x13
      expect(((encoded >> 12) & 0x7)).toBe(0x6);
    });

    it('should encode ANDI x1, x2, 0xFF', () => {
      const encoded = Encoder.encodeI('ANDI', 1, 2, 0xFF);
      // ANDI: funct3=0x7, opcode=0x13
      expect(((encoded >> 12) & 0x7)).toBe(0x7);
    });

    it('should encode SLLI x2, x1, 4', () => {
      const encoded = Encoder.encodeI('SLLI', 2, 1, 4);
      // SLLI: funct3=0x1, opcode=0x13, funct7=0x00
      expect(encoded).toBe(0x00409113);
    });

    it('should encode SRLI x2, x1, 4', () => {
      const encoded = Encoder.encodeI('SRLI', 2, 1, 4);
      // SRLI: funct3=0x5, opcode=0x13, imm[11:5]=0x00
      expect(encoded).toBe(0x0040d113);
    });

    it('should encode SRAI x2, x1, 4', () => {
      const encoded = Encoder.encodeI('SRAI', 2, 1, 4);
      // SRAI: funct3=0x5, opcode=0x13, imm[11:5]=0x20
      expect(encoded).toBe(0x4040d113);
    });
  });

  describe('I-type Load instructions', () => {
    it('should encode LW x2, 0(x1)', () => {
      const encoded = Encoder.encodeI('LW', 2, 1, 0);
      // LW: funct3=0x2, opcode=0x03
      expect(encoded).toBe(0x0000a103);
    });

    it('should encode LW x1, 4(x2)', () => {
      const encoded = Encoder.encodeI('LW', 1, 2, 4);
      expect((encoded >> 20) & 0xfff).toBe(4);
    });

    it('should encode LB x2, 0(x1)', () => {
      const encoded = Encoder.encodeI('LB', 2, 1, 0);
      // LB: funct3=0x0, opcode=0x03
      expect((encoded & 0x7f)).toBe(0x03);
      expect(((encoded >> 12) & 0x7)).toBe(0x0);
    });

    it('should encode LH x2, 0(x1)', () => {
      const encoded = Encoder.encodeI('LH', 2, 1, 0);
      // LH: funct3=0x1, opcode=0x03
      expect(((encoded >> 12) & 0x7)).toBe(0x1);
    });

    it('should encode LBU x2, 0(x1)', () => {
      const encoded = Encoder.encodeI('LBU', 2, 1, 0);
      // LBU: funct3=0x4, opcode=0x03
      expect(((encoded >> 12) & 0x7)).toBe(0x4);
    });

    it('should encode LHU x2, 0(x1)', () => {
      const encoded = Encoder.encodeI('LHU', 2, 1, 0);
      // LHU: funct3=0x5, opcode=0x03
      expect(((encoded >> 12) & 0x7)).toBe(0x5);
    });

    it('should encode LW with negative offset', () => {
      const encoded = Encoder.encodeI('LW', 1, 2, -4);
      // -4 in 12-bit signed = 0xFFC
      const imm = (encoded >> 20) & 0xfff;
      expect(imm).toBe(0xffc);
    });
  });

  describe('I-type JALR instruction', () => {
    it('should encode JALR x2, 4(x1)', () => {
      const encoded = Encoder.encodeI('JALR', 2, 1, 4);
      // JALR: funct3=0x0, opcode=0x67
      expect((encoded & 0x7f)).toBe(0x67);
      expect(((encoded >> 12) & 0x7)).toBe(0x0);
    });
  });

  describe('S-type instructions', () => {
    it('should encode SW x2, 0(x1)', () => {
      const encoded = Encoder.encodeS('SW', 1, 2, 0);
      // SW: funct3=0x2, opcode=0x23
      expect(encoded).toBe(0x0020a023);
    });

    it('should encode SW with offset 4', () => {
      const encoded = Encoder.encodeS('SW', 1, 2, 4);
      // imm[4:0] = 4, imm[11:5] = 0
      expect(((encoded >> 7) & 0x1f)).toBe(4);
    });

    it('should encode SW with negative offset', () => {
      const encoded = Encoder.encodeS('SW', 2, 1, -8);
      // -8 in 12-bit: 0xFF8, split as imm[11:5]=0x7F, imm[4:0]=0x18
      const imm4_0 = (encoded >> 7) & 0x1f;
      const imm11_5 = (encoded >> 25) & 0x7f;
      const imm = (imm11_5 << 5) | imm4_0;
      // Sign extend
      const signedImm = imm >= 2048 ? imm - 4096 : imm;
      expect(signedImm).toBe(-8);
    });

    it('should encode SB x1, 0(x2)', () => {
      const encoded = Encoder.encodeS('SB', 2, 1, 0);
      // SB: funct3=0x0, opcode=0x23
      expect((encoded & 0x7f)).toBe(0x23);
      expect(((encoded >> 12) & 0x7)).toBe(0x0);
    });

    it('should encode SH x1, 0(x2)', () => {
      const encoded = Encoder.encodeS('SH', 2, 1, 0);
      // SH: funct3=0x1, opcode=0x23
      expect(((encoded >> 12) & 0x7)).toBe(0x1);
    });
  });

  describe('B-type instructions', () => {
    it('should encode BEQ x1, x2, 8', () => {
      const encoded = Encoder.encodeB('BEQ', 1, 2, 8);
      // BEQ: funct3=0x0, opcode=0x63
      expect(encoded).toBe(0x00208463);
    });

    it('should encode BNE x1, x3, 8', () => {
      const encoded = Encoder.encodeB('BNE', 1, 3, 8);
      // BNE: funct3=0x1, opcode=0x63
      // rs1=1, rs2=3, imm=8 -> imm[4:1]=4
      expect(encoded).toBe(0x00309463);
    });

    it('should encode BLT x1, x2, 8', () => {
      const encoded = Encoder.encodeB('BLT', 1, 2, 8);
      // BLT: funct3=0x4, opcode=0x63
      expect(encoded).toBe(0x0020c463);
    });

    it('should encode BGE x1, x2, 8', () => {
      const encoded = Encoder.encodeB('BGE', 1, 2, 8);
      // BGE: funct3=0x5, opcode=0x63
      expect(((encoded >> 12) & 0x7)).toBe(0x5);
    });

    it('should encode BLTU x1, x2, 8', () => {
      const encoded = Encoder.encodeB('BLTU', 1, 2, 8);
      // BLTU: funct3=0x6, opcode=0x63
      expect(((encoded >> 12) & 0x7)).toBe(0x6);
    });

    it('should encode BGEU x1, x2, 8', () => {
      const encoded = Encoder.encodeB('BGEU', 1, 2, 8);
      // BGEU: funct3=0x7, opcode=0x63
      expect(((encoded >> 12) & 0x7)).toBe(0x7);
    });

    it('should encode backward branch (negative offset)', () => {
      const encoded = Encoder.encodeB('BEQ', 1, 2, -8);
      // Decode the immediate to verify
      const imm11 = (encoded >> 7) & 0x1;
      const imm4_1 = (encoded >> 8) & 0xf;
      const imm10_5 = (encoded >> 25) & 0x3f;
      const imm12 = (encoded >> 31) & 0x1;
      const imm = (imm12 << 12) | (imm11 << 11) | (imm10_5 << 5) | (imm4_1 << 1);
      // Sign extend from 13 bits
      const signedImm = imm >= 4096 ? imm - 8192 : imm;
      expect(signedImm).toBe(-8);
    });
  });

  describe('U-type instructions', () => {
    it('should encode LUI x1, 0x12345', () => {
      const encoded = Encoder.encodeU('LUI', 1, 0x12345);
      // LUI: opcode=0x37
      expect(encoded).toBe(0x123450b7);
    });

    it('should encode AUIPC x1, 0x12345', () => {
      const encoded = Encoder.encodeU('AUIPC', 1, 0x12345);
      // AUIPC: opcode=0x17
      expect(encoded).toBe(0x12345097);
    });
  });

  describe('J-type instructions', () => {
    it('should encode JAL x1, 100', () => {
      const encoded = Encoder.encodeJ('JAL', 1, 100);
      // JAL: opcode=0x6F
      expect(encoded).toBe(0x064000ef);
    });

    it('should encode JAL with negative offset', () => {
      const encoded = Encoder.encodeJ('JAL', 0, -8);
      // Decode to verify
      const imm19_12 = (encoded >> 12) & 0xff;
      const imm11 = (encoded >> 20) & 0x1;
      const imm10_1 = (encoded >> 21) & 0x3ff;
      const imm20 = (encoded >> 31) & 0x1;
      const imm = (imm20 << 20) | (imm19_12 << 12) | (imm11 << 11) | (imm10_1 << 1);
      // Sign extend from 21 bits
      const signedImm = imm >= 1048576 ? imm - 2097152 : imm;
      expect(signedImm).toBe(-8);
    });
  });

  describe('System instructions', () => {
    it('should encode ECALL', () => {
      const encoded = Encoder.encodeI('ECALL', 0, 0, 0);
      expect(encoded).toBe(0x00000073);
    });

    it('should encode EBREAK', () => {
      const encoded = Encoder.encodeI('EBREAK', 0, 0, 1);
      expect(encoded).toBe(0x00100073);
    });
  });

  describe('Instruction bytes', () => {
    it('should convert to little-endian byte array', () => {
      const instruction = 0x00500093; // ADDI x1, x0, 5
      const bytes = Encoder.toBytes(instruction);
      expect(bytes).toEqual([0x93, 0x00, 0x50, 0x00]);
    });
  });
});
