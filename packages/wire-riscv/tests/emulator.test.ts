import { describe, it, expect, beforeEach } from 'vitest';
import { RiscVCpu } from '../src/emulator/cpu.js';

describe('RiscVCpu', () => {
  let cpu: RiscVCpu;

  beforeEach(() => {
    cpu = new RiscVCpu({ memorySize: 4096 });
  });

  describe('initialization', () => {
    it('should initialize with all registers at 0', () => {
      for (let i = 0; i < 32; i++) {
        expect(cpu.getReg(i)).toBe(0);
      }
    });

    it('should initialize PC at 0', () => {
      expect(cpu.pc).toBe(0);
    });

    it('should allow custom initial PC', () => {
      const cpu2 = new RiscVCpu({ initialPc: 0x1000 });
      expect(cpu2.pc).toBe(0x1000);
    });
  });

  describe('register x0', () => {
    it('should always read as 0', () => {
      cpu.setReg(0, 0xdeadbeef);
      expect(cpu.getReg(0)).toBe(0);
    });
  });

  describe('memory operations', () => {
    it('should read/write bytes', () => {
      cpu.writeByte(0x100, 0x42);
      expect(cpu.readByte(0x100)).toBe(0x42);
    });

    it('should read/write halfwords (little-endian)', () => {
      cpu.writeHalfword(0x100, 0x1234);
      expect(cpu.readHalfword(0x100)).toBe(0x1234);
      expect(cpu.readByte(0x100)).toBe(0x34);
      expect(cpu.readByte(0x101)).toBe(0x12);
    });

    it('should read/write words (little-endian)', () => {
      cpu.writeWord(0x100, 0x12345678);
      expect(cpu.readWord(0x100)).toBe(0x12345678);
      expect(cpu.readByte(0x100)).toBe(0x78);
      expect(cpu.readByte(0x101)).toBe(0x56);
      expect(cpu.readByte(0x102)).toBe(0x34);
      expect(cpu.readByte(0x103)).toBe(0x12);
    });
  });

  describe('LUI instruction', () => {
    it('should load upper immediate', () => {
      // LUI x1, 0x12345  -> x1 = 0x12345000
      // Encoding: imm[31:12] | rd | opcode
      // 0x12345 << 12 | 1 << 7 | 0b0110111
      const instruction = 0x12345_0b7; // LUI x1, 0x12345
      cpu.writeWord(0, instruction);
      cpu.step();
      expect(cpu.getReg(1)).toBe(0x12345000);
      expect(cpu.pc).toBe(4);
    });
  });

  describe('ADDI instruction', () => {
    it('should add immediate to register', () => {
      // ADDI x1, x0, 5  -> x1 = 0 + 5 = 5
      // Encoding: imm[11:0] | rs1 | funct3 | rd | opcode
      // 5 << 20 | 0 << 15 | 0 << 12 | 1 << 7 | 0b0010011
      const instruction = 0x00500093; // addi x1, x0, 5
      cpu.writeWord(0, instruction);
      cpu.step();
      expect(cpu.getReg(1)).toBe(5);
    });

    it('should handle negative immediates', () => {
      // ADDI x1, x0, -1  -> x1 = 0 + (-1) = 0xFFFFFFFF
      const instruction = 0xfff00093; // addi x1, x0, -1
      cpu.writeWord(0, instruction);
      cpu.step();
      expect(cpu.getReg(1)).toBe(0xffffffff);
    });
  });

  describe('ADD instruction', () => {
    it('should add two registers', () => {
      // Set up x1 = 5, x2 = 10
      cpu.setReg(1, 5);
      cpu.setReg(2, 10);
      // ADD x3, x1, x2  -> x3 = 5 + 10 = 15
      const instruction = 0x002081b3; // add x3, x1, x2
      cpu.writeWord(0, instruction);
      cpu.step();
      expect(cpu.getReg(3)).toBe(15);
    });
  });

  describe('SUB instruction', () => {
    it('should subtract two registers', () => {
      cpu.setReg(1, 20);
      cpu.setReg(2, 8);
      // SUB x3, x1, x2  -> x3 = 20 - 8 = 12
      const instruction = 0x402081b3; // sub x3, x1, x2
      cpu.writeWord(0, instruction);
      cpu.step();
      expect(cpu.getReg(3)).toBe(12);
    });
  });

  describe('AND/OR/XOR instructions', () => {
    beforeEach(() => {
      cpu.setReg(1, 0b1100);
      cpu.setReg(2, 0b1010);
    });

    it('should AND two registers', () => {
      const instruction = 0x0020f1b3; // and x3, x1, x2
      cpu.writeWord(0, instruction);
      cpu.step();
      expect(cpu.getReg(3)).toBe(0b1000);
    });

    it('should OR two registers', () => {
      const instruction = 0x0020e1b3; // or x3, x1, x2
      cpu.writeWord(0, instruction);
      cpu.step();
      expect(cpu.getReg(3)).toBe(0b1110);
    });

    it('should XOR two registers', () => {
      const instruction = 0x0020c1b3; // xor x3, x1, x2
      cpu.writeWord(0, instruction);
      cpu.step();
      expect(cpu.getReg(3)).toBe(0b0110);
    });
  });

  describe('shift instructions', () => {
    it('should shift left logical', () => {
      cpu.setReg(1, 0x1);
      // SLLI x2, x1, 4  -> x2 = 0x10
      const instruction = 0x00409113; // slli x2, x1, 4
      cpu.writeWord(0, instruction);
      cpu.step();
      expect(cpu.getReg(2)).toBe(0x10);
    });

    it('should shift right logical', () => {
      cpu.setReg(1, 0x80);
      // SRLI x2, x1, 4  -> x2 = 0x8
      const instruction = 0x0040d113; // srli x2, x1, 4
      cpu.writeWord(0, instruction);
      cpu.step();
      expect(cpu.getReg(2)).toBe(0x8);
    });

    it('should shift right arithmetic (preserving sign)', () => {
      cpu.setReg(1, 0x80000000); // Negative number
      // SRAI x2, x1, 4  -> x2 = 0xF8000000
      const instruction = 0x4040d113; // srai x2, x1, 4
      cpu.writeWord(0, instruction);
      cpu.step();
      expect(cpu.getReg(2)).toBe(0xf8000000);
    });
  });

  describe('comparison instructions', () => {
    it('should set less than (signed)', () => {
      cpu.setReg(1, -5 >>> 0); // 0xFFFFFFFB
      cpu.setReg(2, 5);
      // SLT x3, x1, x2  -> x3 = 1 (since -5 < 5)
      const instruction = 0x0020a1b3; // slt x3, x1, x2
      cpu.writeWord(0, instruction);
      cpu.step();
      expect(cpu.getReg(3)).toBe(1);
    });

    it('should set less than unsigned', () => {
      cpu.setReg(1, 5);
      cpu.setReg(2, -5 >>> 0); // Very large unsigned number
      // SLTU x3, x1, x2  -> x3 = 1 (since 5 < 0xFFFFFFFB unsigned)
      const instruction = 0x0020b1b3; // sltu x3, x1, x2
      cpu.writeWord(0, instruction);
      cpu.step();
      expect(cpu.getReg(3)).toBe(1);
    });
  });

  describe('load/store instructions', () => {
    it('should load word', () => {
      cpu.writeWord(0x100, 0x12345678);
      cpu.setReg(1, 0x100);
      // LW x2, 0(x1)
      const instruction = 0x0000a103; // lw x2, 0(x1)
      cpu.writeWord(0, instruction);
      cpu.step();
      expect(cpu.getReg(2)).toBe(0x12345678);
    });

    it('should store word', () => {
      cpu.setReg(1, 0x100);
      cpu.setReg(2, 0xdeadbeef);
      // SW x2, 0(x1)
      const instruction = 0x0020a023; // sw x2, 0(x1)
      cpu.writeWord(0, instruction);
      cpu.step();
      expect(cpu.readWord(0x100)).toBe(0xdeadbeef);
    });

    it('should load byte with sign extension', () => {
      cpu.writeByte(0x100, 0x80); // -128 as signed byte
      cpu.setReg(1, 0x100);
      // LB x2, 0(x1)
      const instruction = 0x00008103; // lb x2, 0(x1)
      cpu.writeWord(0, instruction);
      cpu.step();
      expect(cpu.getReg(2)).toBe(0xffffff80);
    });

    it('should load byte unsigned (no sign extension)', () => {
      cpu.writeByte(0x100, 0x80);
      cpu.setReg(1, 0x100);
      // LBU x2, 0(x1)
      const instruction = 0x0000c103; // lbu x2, 0(x1)
      cpu.writeWord(0, instruction);
      cpu.step();
      expect(cpu.getReg(2)).toBe(0x80);
    });
  });

  describe('branch instructions', () => {
    beforeEach(() => {
      cpu.setReg(1, 5);
      cpu.setReg(2, 5);
      cpu.setReg(3, 10);
    });

    it('should branch on equal', () => {
      // BEQ x1, x2, 8  -> branch forward 8 bytes
      const instruction = 0x00208463; // beq x1, x2, 8
      cpu.writeWord(0, instruction);
      cpu.step();
      expect(cpu.pc).toBe(8);
    });

    it('should not branch when not equal', () => {
      // BEQ x1, x3, 8  -> don't branch
      const instruction = 0x01308463; // beq x1, x3, 8
      cpu.writeWord(0, instruction);
      cpu.step();
      expect(cpu.pc).toBe(4);
    });

    it('should branch on not equal', () => {
      // BNE x1, x3, 8  -> branch forward 8 bytes
      const instruction = 0x01309463; // bne x1, x3, 8
      cpu.writeWord(0, instruction);
      cpu.step();
      expect(cpu.pc).toBe(8);
    });

    it('should branch on less than (signed)', () => {
      cpu.setReg(1, -5 >>> 0);
      cpu.setReg(2, 5);
      // BLT x1, x2, 8  -> branch (since -5 < 5)
      const instruction = 0x0020c463; // blt x1, x2, 8
      cpu.writeWord(0, instruction);
      cpu.step();
      expect(cpu.pc).toBe(8);
    });
  });

  describe('JAL instruction', () => {
    it('should jump and link', () => {
      // JAL x1, 100  -> x1 = PC+4, PC = PC+100
      const instruction = 0x064000ef; // jal x1, 100
      cpu.writeWord(0, instruction);
      cpu.step();
      expect(cpu.getReg(1)).toBe(4);
      expect(cpu.pc).toBe(100);
    });
  });

  describe('JALR instruction', () => {
    it('should jump and link register', () => {
      cpu.setReg(1, 0x100);
      // JALR x2, x1, 4  -> x2 = PC+4, PC = (x1+4) & ~1 = 0x104
      const instruction = 0x00408167; // jalr x2, 4(x1)
      cpu.writeWord(0, instruction);
      cpu.step();
      expect(cpu.getReg(2)).toBe(4);
      expect(cpu.pc).toBe(0x104);
    });
  });

  describe('AUIPC instruction', () => {
    it('should add upper immediate to PC', () => {
      // Use a larger memory CPU for this test
      const largeCpu = new RiscVCpu({ memorySize: 8192, initialPc: 0x1000 });
      // AUIPC x1, 0x12345  -> x1 = PC + 0x12345000 = 0x12346000
      const instruction = 0x12345097; // auipc x1, 0x12345
      largeCpu.writeWord(0x1000, instruction);
      largeCpu.step();
      expect(largeCpu.getReg(1)).toBe(0x12346000);
    });
  });

  describe('ECALL instruction', () => {
    it('should halt the CPU', () => {
      const instruction = 0x00000073; // ecall
      cpu.writeWord(0, instruction);
      cpu.step();
      expect(cpu.halted).toBe(true);
    });
  });

  describe('program execution', () => {
    it('should execute a simple program', () => {
      // Program: add 5 + 10
      const program = new Uint8Array([
        0x93, 0x00, 0x50, 0x00, // addi x1, x0, 5
        0x13, 0x01, 0xa0, 0x00, // addi x2, x0, 10
        0xb3, 0x81, 0x20, 0x00, // add x3, x1, x2
        0x73, 0x00, 0x00, 0x00, // ecall
      ]);
      cpu.loadProgram(program);
      cpu.run();
      expect(cpu.getReg(1)).toBe(5);
      expect(cpu.getReg(2)).toBe(10);
      expect(cpu.getReg(3)).toBe(15);
      expect(cpu.halted).toBe(true);
    });

    it('should count from 0 to 5', () => {
      // Program: count from 0 to 5 in x1
      const program = new Uint8Array([
        // 0x00: addi x2, x0, 5     ; x2 = 5 (limit)
        0x13, 0x01, 0x50, 0x00,
        // 0x04: addi x1, x0, 0     ; x1 = 0 (counter)
        0x93, 0x00, 0x00, 0x00,
        // 0x08: beq x1, x2, 12     ; if x1 == x2, jump to ecall (PC+12 = 0x14)
        0x63, 0x86, 0x20, 0x00,
        // 0x0c: addi x1, x1, 1     ; x1++
        0x93, 0x80, 0x10, 0x00,
        // 0x10: jal x0, -8         ; jump back to 0x08
        0x6f, 0xf0, 0x9f, 0xff,
        // 0x14: ecall              ; halt
        0x73, 0x00, 0x00, 0x00,
      ]);
      cpu.loadProgram(program);
      cpu.run(1000);
      expect(cpu.getReg(1)).toBe(5);
      expect(cpu.halted).toBe(true);
    });
  });
});
