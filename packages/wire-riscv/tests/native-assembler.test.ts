import { describe, it, expect, beforeEach } from 'vitest';
import { RiscVCpu } from '../src/emulator/cpu.js';
import {
  NativeAssembler,
  AssemblerError,
  NATIVE_ASM_SYSCALLS,
} from '../src/emulator/native-assembler.js';
import { WireFS } from '../src/emulator/filesystem.js';

/**
 * Tests for Native (Self-Hosting) RISC-V Assembler
 */
describe('NativeAssembler', () => {
  let cpu: RiscVCpu;
  let fs: WireFS;
  let assembler: NativeAssembler;

  beforeEach(() => {
    cpu = new RiscVCpu({ memorySize: 0x10000 });
    fs = new WireFS();
    fs.format();
    assembler = new NativeAssembler(cpu, fs);
  });

  describe('basic instructions', () => {
    it('should assemble NOP (ADDI x0, x0, 0)', () => {
      const source = 'NOP';
      const binary = assembler.assemble(source);

      // NOP is encoded as ADDI x0, x0, 0 = 0x00000013
      expect(binary.length).toBe(4);
      expect(readWord(binary, 0)).toBe(0x00000013);
    });

    it('should assemble LUI', () => {
      const source = 'LUI x1, 0x12345';
      const binary = assembler.assemble(source);

      // LUI x1, 0x12345 = 0x123450B7
      expect(readWord(binary, 0)).toBe(0x123450B7);
    });

    it('should assemble ADDI', () => {
      const source = 'ADDI x1, x0, 42';
      const binary = assembler.assemble(source);

      // ADDI x1, x0, 42 = 0x02A00093
      expect(readWord(binary, 0)).toBe(0x02A00093);
    });

    it('should assemble ADD', () => {
      const source = 'ADD x3, x1, x2';
      const binary = assembler.assemble(source);

      // ADD x3, x1, x2 = 0x002081B3
      expect(readWord(binary, 0)).toBe(0x002081B3);
    });

    it('should assemble SUB', () => {
      const source = 'SUB x3, x1, x2';
      const binary = assembler.assemble(source);

      // SUB x3, x1, x2 = 0x402081B3
      expect(readWord(binary, 0)).toBe(0x402081B3);
    });

    it('should assemble LW', () => {
      const source = 'LW x1, 0(x2)';
      const binary = assembler.assemble(source);

      // LW x1, 0(x2) = 0x00012083
      expect(readWord(binary, 0)).toBe(0x00012083);
    });

    it('should assemble SW', () => {
      const source = 'SW x1, 0(x2)';
      const binary = assembler.assemble(source);

      // SW x1, 0(x2) = 0x00112023
      expect(readWord(binary, 0)).toBe(0x00112023);
    });

    it('should assemble JAL', () => {
      const source = 'JAL x1, 8';
      const binary = assembler.assemble(source);

      // JAL x1, 8 = 0x008000EF
      expect(readWord(binary, 0)).toBe(0x008000EF);
    });

    it('should assemble JALR', () => {
      const source = 'JALR x1, x2, 0';
      const binary = assembler.assemble(source);

      // JALR x1, x2, 0 = 0x000100E7
      expect(readWord(binary, 0)).toBe(0x000100E7);
    });

    it('should assemble BEQ', () => {
      const source = 'BEQ x1, x2, 8';
      const binary = assembler.assemble(source);

      // BEQ x1, x2, 8 = 0x00208463
      expect(readWord(binary, 0)).toBe(0x00208463);
    });

    it('should assemble ECALL', () => {
      const source = 'ECALL';
      const binary = assembler.assemble(source);

      expect(readWord(binary, 0)).toBe(0x00000073);
    });
  });

  describe('register aliases', () => {
    it('should accept x0-x31', () => {
      const source = 'ADDI x31, x0, 1';
      const binary = assembler.assemble(source);
      expect(binary.length).toBe(4);
    });

    it('should accept ABI register names', () => {
      const source = 'ADDI a0, zero, 1';
      const binary = assembler.assemble(source);

      // ADDI a0, zero, 1 = ADDI x10, x0, 1 = 0x00100513
      expect(readWord(binary, 0)).toBe(0x00100513);
    });

    it('should accept sp, ra, gp, tp', () => {
      const source = 'ADDI sp, sp, -16';
      const binary = assembler.assemble(source);
      // sp = x2
      expect(binary.length).toBe(4);
    });
  });

  describe('labels', () => {
    it('should resolve forward label', () => {
      const source = `
        JAL x0, end
        ADDI x1, x0, 1
end:    ECALL
`;
      const binary = assembler.assemble(source);

      // JAL x0, 8 (jump over ADDI to ECALL)
      expect(binary.length).toBe(12);
    });

    it('should resolve backward label', () => {
      const source = `
loop:   ADDI x1, x1, 1
        BEQ x0, x0, loop
`;
      const binary = assembler.assemble(source);

      // BEQ should jump back to loop (-4)
      expect(binary.length).toBe(8);
    });

    it('should handle multiple labels', () => {
      const source = `
start:  ADDI x1, x0, 1
mid:    ADDI x2, x0, 2
end:    ECALL
`;
      const binary = assembler.assemble(source);
      expect(binary.length).toBe(12);
    });
  });

  describe('directives', () => {
    it('should handle .byte directive', () => {
      const source = '.byte 0x42';
      const binary = assembler.assemble(source);

      expect(binary.length).toBe(1);
      expect(binary[0]).toBe(0x42);
    });

    it('should handle .word directive', () => {
      const source = '.word 0x12345678';
      const binary = assembler.assemble(source);

      expect(binary.length).toBe(4);
      expect(readWord(binary, 0)).toBe(0x12345678);
    });

    it('should handle .ascii directive', () => {
      const source = '.ascii "Hello"';
      const binary = assembler.assemble(source);

      expect(binary.length).toBe(5);
      expect(binary[0]).toBe(0x48); // 'H'
      expect(binary[4]).toBe(0x6F); // 'o'
    });

    it('should handle .asciiz directive', () => {
      const source = '.asciiz "Hi"';
      const binary = assembler.assemble(source);

      expect(binary.length).toBe(3);
      expect(binary[0]).toBe(0x48); // 'H'
      expect(binary[1]).toBe(0x69); // 'i'
      expect(binary[2]).toBe(0x00); // null
    });

    it('should handle .space directive', () => {
      const source = '.space 10';
      const binary = assembler.assemble(source);

      expect(binary.length).toBe(10);
      expect(binary.every((b) => b === 0)).toBe(true);
    });
  });

  describe('comments', () => {
    it('should ignore line comments', () => {
      const source = `
; This is a comment
ADDI x1, x0, 1  ; inline comment
`;
      const binary = assembler.assemble(source);
      expect(binary.length).toBe(4);
    });

    it('should handle # style comments', () => {
      const source = `
# Comment
ADDI x1, x0, 1 # another comment
`;
      const binary = assembler.assemble(source);
      expect(binary.length).toBe(4);
    });
  });

  describe('error handling', () => {
    it('should throw on unknown instruction', () => {
      expect(() => assembler.assemble('INVALID x1, x2')).toThrow(AssemblerError);
    });

    it('should throw on invalid register', () => {
      expect(() => assembler.assemble('ADDI x99, x0, 1')).toThrow(AssemblerError);
    });

    it('should throw on undefined label', () => {
      expect(() => assembler.assemble('JAL x0, undefined_label')).toThrow(AssemblerError);
    });
  });

  describe('multi-line programs', () => {
    it('should assemble complete program', () => {
      const source = `
; Sum numbers 1 to 10
        ADDI x1, x0, 0      ; sum = 0
        ADDI x2, x0, 1      ; i = 1
        ADDI x3, x0, 11     ; limit = 11
loop:   ADD x1, x1, x2      ; sum += i
        ADDI x2, x2, 1      ; i++
        BNE x2, x3, loop    ; if i != limit, loop
        ECALL               ; exit
`;
      const binary = assembler.assemble(source);

      // Should have 7 instructions = 28 bytes
      expect(binary.length).toBe(28);
    });

    it('should assemble and execute correctly', () => {
      const source = `
        ADDI x1, x0, 42
        ECALL
`;
      const binary = assembler.assemble(source);

      // Load and run the program
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000;
      cpu.run(100);

      expect(cpu.getReg(1)).toBe(42);
      expect(cpu.halted).toBe(true);
    });
  });

  describe('file operations', () => {
    it('should assemble from filesystem', () => {
      // Write source to filesystem
      fs.createFile('TEST', 'ASM');
      const source = 'ADDI x1, x0, 99\nECALL\n';
      fs.writeFile('TEST', 'ASM', new TextEncoder().encode(source));

      // Assemble from file
      const binary = assembler.assembleFile('TEST', 'ASM');

      expect(binary).not.toBeNull();
      expect(binary!.length).toBe(8);
    });

    it('should write output to filesystem', () => {
      const source = 'ADDI x1, x0, 1';

      assembler.assembleToFile(source, 'OUT', 'BIN');

      expect(fs.fileExists('OUT', 'BIN')).toBe(true);
      const data = fs.readFile('OUT', 'BIN');
      expect(data?.length).toBe(4);
    });

    it('should return null for non-existent file', () => {
      const binary = assembler.assembleFile('NOFILE', 'ASM');
      expect(binary).toBeNull();
    });
  });

  describe('integration', () => {
    it('should self-assemble simple program', () => {
      // This test verifies the assembler can assemble programs that run correctly
      const source = `
        ; Set x1 = 10, x2 = 5, x3 = x1 + x2
        ADDI x1, x0, 10
        ADDI x2, x0, 5
        ADD x3, x1, x2
        ECALL
`;
      const binary = assembler.assemble(source);

      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000;
      cpu.run(100);

      expect(cpu.getReg(3)).toBe(15);
    });
  });

  describe('EQU constants', () => {
    it('should define constant with EQU', () => {
      const source = `
BUFFER_SIZE EQU 1024
        ADDI a0, zero, BUFFER_SIZE
      `;
      const binary = assembler.assemble(source);

      // ADDI a0, zero, 1024 = 0x40000513
      expect(readWord(binary, 0)).toBe(0x40000513);
    });

    it('should use hex constants', () => {
      const source = `
BASE_ADDR EQU 0x1000
        LUI a1, BASE_ADDR
      `;
      const binary = assembler.assemble(source);

      // LUI a1, 0x1000 = 0x010005B7
      expect(readWord(binary, 0)).toBe(0x010005B7);
    });

    it('should use multiple constants', () => {
      const source = `
VALUE1 EQU 10
VALUE2 EQU 20
        ADDI a0, zero, VALUE1
        ADDI a1, zero, VALUE2
      `;
      const binary = assembler.assemble(source);

      expect(readWord(binary, 0)).toBe(0x00A00513);  // ADDI a0, zero, 10
      expect(readWord(binary, 4)).toBe(0x01400593);  // ADDI a1, zero, 20
    });

    it('should error on undefined constant', () => {
      const source = 'ADDI a0, zero, UNDEFINED_CONST';

      expect(() => assembler.assemble(source)).toThrow();
    });
  });

  describe('Enhanced data directives', () => {
    it('should support multiple .byte values', () => {
      const source = '.byte 0x12, 0x34, 0x56';
      const binary = assembler.assemble(source);

      expect(binary.length).toBe(3);
      expect(binary[0]).toBe(0x12);
      expect(binary[1]).toBe(0x34);
      expect(binary[2]).toBe(0x56);
    });

    it('should support multiple .word values', () => {
      const source = '.word 0x1000, 0x2000';
      const binary = assembler.assemble(source);

      expect(binary.length).toBe(8);
      expect(readWord(binary, 0)).toBe(0x1000);
      expect(readWord(binary, 4)).toBe(0x2000);
    });

    it('should support .string as alias for .asciiz', () => {
      const source = '.string "Hello"';
      const binary = assembler.assemble(source);

      expect(binary.length).toBe(6);  // "Hello" + null terminator
      expect(binary[0]).toBe(0x48);  // 'H'
      expect(binary[4]).toBe(0x6F);  // 'o'
      expect(binary[5]).toBe(0);     // null terminator
    });

    it('should process escape sequences in strings', () => {
      const source = '.string "Hello\\nWorld"';
      const binary = assembler.assemble(source);

      expect(binary.length).toBe(12);  // "Hello\nWorld" + null
      expect(binary[0]).toBe(0x48);    // 'H'
      expect(binary[5]).toBe(0x0A);    // '\n'
      expect(binary[6]).toBe(0x57);    // 'W'
      expect(binary[11]).toBe(0);      // null
    });

    it('should handle all escape sequences', () => {
      const source = '.ascii "tab\\there\\r\\nnull\\0quote\\"backslash\\\\"';
      const binary = assembler.assemble(source);

      const text = new TextDecoder().decode(binary);
      expect(text).toContain('\t');
      expect(text).toContain('\r');
      expect(text).toContain('\n');
      expect(text).toContain('\0');
      expect(text).toContain('"');
      expect(text).toContain('\\');
    });
  });

  describe('Error messages with context', () => {
    it('should show line number in error', () => {
      const source = `
        ADDI a0, zero, 10
        ADDX a1, a2, a3
        ADDI a2, zero, 20
      `;

      try {
        assembler.assemble(source);
        expect.fail('Should have thrown error');
      } catch (err) {
        expect(err).toBeInstanceOf(AssemblerError);
        const error = err as AssemblerError;
        expect(error.message).toContain('Line 3');
        expect(error.message).toContain('Unknown instruction: ADDX');
      }
    });

    it('should show context lines', () => {
      const source = `
        ADDI a0, zero, 10
        INVALID_INSTRUCTION
        ADDI a2, zero, 20
      `;

      try {
        assembler.assemble(source);
        expect.fail('Should have thrown error');
      } catch (err) {
        const error = err as AssemblerError;
        // Should show line before
        expect(error.message).toContain('2 |');
        expect(error.message).toContain('ADDI a0');
        // Should show error line
        expect(error.message).toContain('3 |');
        expect(error.message).toContain('INVALID_INSTRUCTION');
        // Should show line after
        expect(error.message).toContain('4 |');
        expect(error.message).toContain('ADDI a2');
      }
    });

    it('should show caret pointing to error', () => {
      const source = 'ADDX a1, a2, a3';

      try {
        assembler.assemble(source);
        expect.fail('Should have thrown error');
      } catch (err) {
        const error = err as AssemblerError;
        // Should have caret line
        expect(error.message).toContain('^');
      }
    });

    it('should work for undefined constant error', () => {
      const source = `
        BUFFER_SIZE EQU 1024
        ADDI a0, zero, UNDEFINED_CONST
      `;

      try {
        assembler.assemble(source);
        expect.fail('Should have thrown error');
      } catch (err) {
        const error = err as AssemblerError;
        expect(error.message).toContain('Line 3');
        expect(error.message).toContain('Undefined constant: UNDEFINED_CONST');
        expect(error.message).toContain('3 |');
      }
    });
  });
});

/**
 * Helper to read a 32-bit word from buffer
 */
function readWord(buffer: Uint8Array, offset: number): number {
  return (
    buffer[offset] |
    (buffer[offset + 1] << 8) |
    (buffer[offset + 2] << 16) |
    (buffer[offset + 3] << 24)
  ) >>> 0;
}
