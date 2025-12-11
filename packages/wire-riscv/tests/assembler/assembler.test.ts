import { describe, it, expect } from 'vitest';
import { Assembler } from '../../src/assembler/assembler.js';
import { RiscVCpu } from '../../src/emulator/cpu.js';

describe('Assembler', () => {
  describe('basic assembly', () => {
    it('should assemble empty source', () => {
      const asm = new Assembler('');
      const result = asm.assemble();
      expect(result.bytes).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should assemble single instruction', () => {
      const asm = new Assembler('ADDI x1, x0, 5');
      const result = asm.assemble();
      expect(result.bytes).toHaveLength(4);
      expect(result.errors).toHaveLength(0);
      // 0x00500093 in little-endian
      expect(result.bytes).toEqual(new Uint8Array([0x93, 0x00, 0x50, 0x00]));
    });

    it('should assemble multiple instructions', () => {
      const asm = new Assembler(`
        ADDI x1, x0, 5
        ADDI x2, x0, 10
        ADD x3, x1, x2
      `);
      const result = asm.assemble();
      expect(result.bytes).toHaveLength(12); // 3 instructions * 4 bytes
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('label resolution', () => {
    it('should resolve forward label reference', () => {
      const asm = new Assembler(`
        JAL ra, main
        NOP
main:
        ADDI x1, x0, 42
      `);
      const result = asm.assemble();
      expect(result.errors).toHaveLength(0);
      // Verify the JAL instruction has correct offset (8 bytes forward)
      const jalInstruction = (result.bytes[0] | (result.bytes[1] << 8) | (result.bytes[2] << 16) | (result.bytes[3] << 24)) >>> 0;
      // Extract offset from J-type encoding
      const imm19_12 = (jalInstruction >> 12) & 0xff;
      const imm11 = (jalInstruction >> 20) & 0x1;
      const imm10_1 = (jalInstruction >> 21) & 0x3ff;
      const imm20 = (jalInstruction >> 31) & 0x1;
      const imm = (imm20 << 20) | (imm19_12 << 12) | (imm11 << 11) | (imm10_1 << 1);
      const signedImm = imm >= 1048576 ? imm - 2097152 : imm;
      expect(signedImm).toBe(8); // Jump 8 bytes (2 instructions)
    });

    it('should resolve backward label reference', () => {
      const asm = new Assembler(`
loop:
        ADDI x1, x1, -1
        BNE x1, x0, loop
      `);
      const result = asm.assemble();
      expect(result.errors).toHaveLength(0);
      // The BNE should jump back 4 bytes
      const bneInstruction = (result.bytes[4] | (result.bytes[5] << 8) | (result.bytes[6] << 16) | (result.bytes[7] << 24)) >>> 0;
      // Extract offset from B-type encoding
      const imm12 = (bneInstruction >> 31) & 0x1;
      const imm11 = (bneInstruction >> 7) & 0x1;
      const imm10_5 = (bneInstruction >> 25) & 0x3f;
      const imm4_1 = (bneInstruction >> 8) & 0xf;
      const imm = (imm12 << 12) | (imm11 << 11) | (imm10_5 << 5) | (imm4_1 << 1);
      const signedImm = imm >= 4096 ? imm - 8192 : imm;
      expect(signedImm).toBe(-4); // Jump back 4 bytes
    });

    it('should error on undefined label', () => {
      const asm = new Assembler(`
        JAL ra, undefined_label
      `);
      const result = asm.assemble();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toMatch(/undefined.*label/i);
    });

    it('should error on duplicate label', () => {
      const asm = new Assembler(`
main:
        NOP
main:
        NOP
      `);
      const result = asm.assemble();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toMatch(/duplicate.*label/i);
    });
  });

  describe('.org directive', () => {
    it('should set origin address', () => {
      const asm = new Assembler(`
.org 0x100
        ADDI x1, x0, 5
      `);
      const result = asm.assemble();
      expect(result.errors).toHaveLength(0);
      // Output starts at 0x100, so first 256 bytes should be padding
      expect(result.bytes.length).toBe(0x104);
    });

    it('should handle multiple .org directives', () => {
      const asm = new Assembler(`
.org 0x0
        NOP
.org 0x100
        ADDI x1, x0, 5
      `);
      const result = asm.assemble();
      expect(result.errors).toHaveLength(0);
      expect(result.bytes.length).toBe(0x104);
    });
  });

  describe('.equ constants', () => {
    it('should define and use constant', () => {
      const asm = new Assembler(`
.equ VALUE, 42
        ADDI x1, x0, VALUE
      `);
      const result = asm.assemble();
      expect(result.errors).toHaveLength(0);
      // Verify immediate is 42
      const instruction = (result.bytes[0] | (result.bytes[1] << 8) | (result.bytes[2] << 16) | (result.bytes[3] << 24)) >>> 0;
      const imm = (instruction >> 20) & 0xfff;
      expect(imm).toBe(42);
    });
  });

  describe('data directives', () => {
    it('should emit .byte values', () => {
      const asm = new Assembler(`
.byte 0x01, 0x02, 0x03, 0x04
      `);
      const result = asm.assemble();
      expect(result.errors).toHaveLength(0);
      expect(result.bytes).toEqual(new Uint8Array([0x01, 0x02, 0x03, 0x04]));
    });

    it('should emit .half values', () => {
      const asm = new Assembler(`
.half 0x1234, 0x5678
      `);
      const result = asm.assemble();
      expect(result.errors).toHaveLength(0);
      // Little-endian
      expect(result.bytes).toEqual(new Uint8Array([0x34, 0x12, 0x78, 0x56]));
    });

    it('should emit .word values', () => {
      const asm = new Assembler(`
.word 0xDEADBEEF
      `);
      const result = asm.assemble();
      expect(result.errors).toHaveLength(0);
      expect(result.bytes).toEqual(new Uint8Array([0xEF, 0xBE, 0xAD, 0xDE]));
    });

    it('should emit .ascii string', () => {
      const asm = new Assembler(`
.ascii "Hi"
      `);
      const result = asm.assemble();
      expect(result.errors).toHaveLength(0);
      expect(result.bytes).toEqual(new Uint8Array([0x48, 0x69])); // 'H', 'i'
    });

    it('should emit .asciiz string with null terminator', () => {
      const asm = new Assembler(`
.asciiz "Hi"
      `);
      const result = asm.assemble();
      expect(result.errors).toHaveLength(0);
      expect(result.bytes).toEqual(new Uint8Array([0x48, 0x69, 0x00])); // 'H', 'i', NUL
    });

    it('should emit .space as zeros', () => {
      const asm = new Assembler(`
.space 4
      `);
      const result = asm.assemble();
      expect(result.errors).toHaveLength(0);
      expect(result.bytes).toEqual(new Uint8Array([0, 0, 0, 0]));
    });

    it('should align with .align', () => {
      const asm = new Assembler(`
.byte 0x01
.align 2
.word 0x12345678
      `);
      const result = asm.assemble();
      expect(result.errors).toHaveLength(0);
      // .align 2 means align to 4-byte boundary
      // After 1 byte, need 3 padding bytes
      expect(result.bytes.length).toBe(8);
      expect(result.bytes[0]).toBe(0x01);
      expect(result.bytes[4]).toBe(0x78); // Start of word
    });
  });

  describe('pseudo-instructions', () => {
    it('should expand NOP to ADDI x0, x0, 0', () => {
      const asm = new Assembler('NOP');
      const result = asm.assemble();
      expect(result.errors).toHaveLength(0);
      const instruction = (result.bytes[0] | (result.bytes[1] << 8) | (result.bytes[2] << 16) | (result.bytes[3] << 24)) >>> 0;
      expect(instruction).toBe(0x00000013); // addi x0, x0, 0
    });

    it('should expand LI with small immediate to ADDI', () => {
      const asm = new Assembler('LI x1, 42');
      const result = asm.assemble();
      expect(result.errors).toHaveLength(0);
      expect(result.bytes).toHaveLength(4); // Single instruction
    });

    it('should expand LI with large immediate to LUI + ADDI', () => {
      const asm = new Assembler('LI x1, 0x12345678');
      const result = asm.assemble();
      expect(result.errors).toHaveLength(0);
      expect(result.bytes).toHaveLength(8); // Two instructions
    });

    it('should expand MV to ADDI rd, rs1, 0', () => {
      const asm = new Assembler('MV x1, x2');
      const result = asm.assemble();
      expect(result.errors).toHaveLength(0);
      const instruction = (result.bytes[0] | (result.bytes[1] << 8) | (result.bytes[2] << 16) | (result.bytes[3] << 24)) >>> 0;
      // ADDI x1, x2, 0
      expect((instruction & 0x7f)).toBe(0x13); // opcode
      expect(((instruction >> 7) & 0x1f)).toBe(1); // rd
      expect(((instruction >> 15) & 0x1f)).toBe(2); // rs1
    });

    it('should expand J to JAL x0, offset', () => {
      const asm = new Assembler(`
        J target
        NOP
target:
        NOP
      `);
      const result = asm.assemble();
      expect(result.errors).toHaveLength(0);
      const instruction = (result.bytes[0] | (result.bytes[1] << 8) | (result.bytes[2] << 16) | (result.bytes[3] << 24)) >>> 0;
      expect((instruction & 0x7f)).toBe(0x6f); // JAL opcode
      expect(((instruction >> 7) & 0x1f)).toBe(0); // rd = x0
    });

    it('should expand RET to JALR x0, 0(ra)', () => {
      const asm = new Assembler('RET');
      const result = asm.assemble();
      expect(result.errors).toHaveLength(0);
      const instruction = (result.bytes[0] | (result.bytes[1] << 8) | (result.bytes[2] << 16) | (result.bytes[3] << 24)) >>> 0;
      expect((instruction & 0x7f)).toBe(0x67); // JALR opcode
      expect(((instruction >> 7) & 0x1f)).toBe(0); // rd = x0
      expect(((instruction >> 15) & 0x1f)).toBe(1); // rs1 = ra
    });
  });

  describe('symbol table', () => {
    it('should return symbol table with labels', () => {
      const asm = new Assembler(`
main:
        NOP
loop:
        NOP
      `);
      const result = asm.assemble();
      expect(result.symbols.get('main')).toBe(0);
      expect(result.symbols.get('loop')).toBe(4);
    });

    it('should include .equ constants in symbol table', () => {
      const asm = new Assembler(`
.equ CONST, 100
      `);
      const result = asm.assemble();
      expect(result.symbols.get('CONST')).toBe(100);
    });
  });

  describe('integration with emulator', () => {
    it('should assemble and run add program', () => {
      const asm = new Assembler(`
        ADDI x1, x0, 5
        ADDI x2, x0, 10
        ADD x3, x1, x2
        ECALL
      `);
      const result = asm.assemble();
      expect(result.errors).toHaveLength(0);

      const cpu = new RiscVCpu();
      cpu.loadProgram(result.bytes);
      cpu.run();

      expect(cpu.getReg(1)).toBe(5);
      expect(cpu.getReg(2)).toBe(10);
      expect(cpu.getReg(3)).toBe(15);
    });

    it('should assemble and run loop program', () => {
      const asm = new Assembler(`
        LI x1, 5       ; counter
loop:
        ADDI x1, x1, -1
        BNE x1, x0, loop
        EBREAK
      `);
      const result = asm.assemble();
      expect(result.errors).toHaveLength(0);

      const cpu = new RiscVCpu();
      cpu.loadProgram(result.bytes);
      cpu.run(100);

      expect(cpu.getReg(1)).toBe(0);
      expect(cpu.halted).toBe(true);
    });

    it('should assemble and run subroutine call', () => {
      const asm = new Assembler(`
        LI a0, 5
        JAL ra, double
        EBREAK

double:
        ADD a0, a0, a0
        RET
      `);
      const result = asm.assemble();
      expect(result.errors).toHaveLength(0);

      const cpu = new RiscVCpu();
      cpu.loadProgram(result.bytes);
      cpu.run(100);

      expect(cpu.getReg(10)).toBe(10); // a0 = 5 * 2
    });

    it('should assemble and run with data section', () => {
      const asm = new Assembler(`
.org 0x0000
        LA x1, value
        LW x2, 0(x1)
        EBREAK

.org 0x0100
value:
        .word 42
      `);
      const result = asm.assemble();
      expect(result.errors).toHaveLength(0);

      const cpu = new RiscVCpu({ memorySize: 0x200 });
      cpu.loadProgram(result.bytes);
      cpu.run(100);

      expect(cpu.getReg(2)).toBe(42);
    });
  });

  describe('error messages', () => {
    it('should include line numbers in errors', () => {
      const asm = new Assembler(`
NOP
ADD x1, x2
      `);
      const result = asm.assemble();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].line).toBe(3);
    });
  });
});
