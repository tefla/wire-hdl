import { describe, it, expect, beforeEach } from 'vitest';
import { RiscVCpu } from '../src/emulator/cpu.js';
import { Assembler } from '../src/assembler/assembler.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Hello World Program', () => {
  let cpu: RiscVCpu;

  beforeEach(() => {
    cpu = new RiscVCpu({ memorySize: 64 * 1024 });
  });

  describe('manual hello world', () => {
    it('should write "HELLO" to VRAM using inline assembly', () => {
      // Hand-assembled program to write "HELLO" to VRAM
      const program = new Uint8Array([
        // lui a0, 0x10001  ; a0 = 0x10001000 (VRAM base)
        0x37, 0x15, 0x00, 0x10,

        // Write 'H' (0x48)
        0x93, 0x02, 0x80, 0x04, // addi t0, x0, 0x48 ('H')
        0x23, 0x00, 0x55, 0x00, // sb t0, 0(a0)
        0x93, 0x02, 0xf0, 0x00, // addi t0, x0, 0x0F (white on black)
        0xa3, 0x00, 0x55, 0x00, // sb t0, 1(a0)

        // Write 'E' (0x45)
        0x93, 0x02, 0x50, 0x04, // addi t0, x0, 0x45 ('E')
        0x23, 0x01, 0x55, 0x00, // sb t0, 2(a0)
        0x93, 0x02, 0xf0, 0x00, // addi t0, x0, 0x0F
        0xa3, 0x01, 0x55, 0x00, // sb t0, 3(a0)

        // Write 'L' (0x4C)
        0x93, 0x02, 0xc0, 0x04, // addi t0, x0, 0x4C ('L')
        0x23, 0x02, 0x55, 0x00, // sb t0, 4(a0)
        0x93, 0x02, 0xf0, 0x00, // addi t0, x0, 0x0F
        0xa3, 0x02, 0x55, 0x00, // sb t0, 5(a0)

        // Write 'L' (0x4C)
        0x93, 0x02, 0xc0, 0x04, // addi t0, x0, 0x4C ('L')
        0x23, 0x03, 0x55, 0x00, // sb t0, 6(a0)
        0x93, 0x02, 0xf0, 0x00, // addi t0, x0, 0x0F
        0xa3, 0x03, 0x55, 0x00, // sb t0, 7(a0)

        // Write 'O' (0x4F)
        0x93, 0x02, 0xf0, 0x04, // addi t0, x0, 0x4F ('O')
        0x23, 0x04, 0x55, 0x00, // sb t0, 8(a0)
        0x93, 0x02, 0xf0, 0x00, // addi t0, x0, 0x0F
        0xa3, 0x04, 0x55, 0x00, // sb t0, 9(a0)

        // ecall (halt)
        0x73, 0x00, 0x00, 0x00,
      ]);

      cpu.loadProgram(program);
      cpu.run();

      // Verify HELLO was written to VRAM
      expect(cpu.gpu.readTextVram(0, 0).char).toBe(0x48); // 'H'
      expect(cpu.gpu.readTextVram(1, 0).char).toBe(0x45); // 'E'
      expect(cpu.gpu.readTextVram(2, 0).char).toBe(0x4c); // 'L'
      expect(cpu.gpu.readTextVram(3, 0).char).toBe(0x4c); // 'L'
      expect(cpu.gpu.readTextVram(4, 0).char).toBe(0x4f); // 'O'

      // Verify attributes (white on black)
      expect(cpu.gpu.readTextVram(0, 0).attr).toBe(0x0f);
      expect(cpu.gpu.readTextVram(1, 0).attr).toBe(0x0f);
    });

    it('should write text with colors', () => {
      // Write 'A' with different colors
      const program = new Uint8Array([
        // lui a0, 0x10001  ; a0 = 0x10001000 (VRAM base)
        0x37, 0x15, 0x00, 0x10,

        // 'A' with white on black (0x0F)
        0x93, 0x02, 0x10, 0x04, // addi t0, x0, 0x41 ('A')
        0x23, 0x00, 0x55, 0x00, // sb t0, 0(a0)
        0x93, 0x02, 0xf0, 0x00, // addi t0, x0, 0x0F (white on black)
        0xa3, 0x00, 0x55, 0x00, // sb t0, 1(a0)

        // 'B' with yellow on blue (0x1E)
        0x93, 0x02, 0x20, 0x04, // addi t0, x0, 0x42 ('B')
        0x23, 0x01, 0x55, 0x00, // sb t0, 2(a0)
        0x93, 0x02, 0xe0, 0x01, // addi t0, x0, 0x1E (yellow on blue)
        0xa3, 0x01, 0x55, 0x00, // sb t0, 3(a0)

        // ecall
        0x73, 0x00, 0x00, 0x00,
      ]);

      cpu.loadProgram(program);
      cpu.run();

      expect(cpu.gpu.readTextVram(0, 0).char).toBe(0x41); // 'A'
      expect(cpu.gpu.readTextVram(0, 0).attr).toBe(0x0f); // white on black
      expect(cpu.gpu.readTextVram(1, 0).char).toBe(0x42); // 'B'
      expect(cpu.gpu.readTextVram(1, 0).attr).toBe(0x1e); // yellow on blue
    });
  });

  describe('assembled hello world', () => {
    it('should assemble and run hello-world.asm', () => {
      const source = readFileSync(
        join(__dirname, '../examples/hello-world.asm'),
        'utf-8'
      );

      const assembler = new Assembler(source);
      const result = assembler.assemble();
      expect(result.errors).toHaveLength(0);

      cpu.loadProgram(result.bytes);
      cpu.run();

      // Verify "Hello, World!" was written to VRAM
      const expectedText = 'Hello, World!';
      for (let i = 0; i < expectedText.length; i++) {
        const cell = cpu.gpu.readTextVram(i, 0);
        expect(cell.char).toBe(expectedText.charCodeAt(i));
      }

      // Verify CPU halted cleanly
      expect(cpu.halted).toBe(true);
    });

    it('should have colorful output', () => {
      const source = readFileSync(
        join(__dirname, '../examples/hello-world.asm'),
        'utf-8'
      );

      const assembler = new Assembler(source);
      const result = assembler.assemble();
      cpu.loadProgram(result.bytes);
      cpu.run();

      // "Hello, " is white on black (0x0F)
      expect(cpu.gpu.readTextVram(0, 0).attr).toBe(0x0f); // H
      expect(cpu.gpu.readTextVram(1, 0).attr).toBe(0x0f); // e
      expect(cpu.gpu.readTextVram(6, 0).attr).toBe(0x0f); // space

      // "World" is yellow on black (0x0E)
      expect(cpu.gpu.readTextVram(7, 0).attr).toBe(0x0e); // W

      // "!" is light red on black (0x0C)
      expect(cpu.gpu.readTextVram(12, 0).attr).toBe(0x0c); // !
    });
  });
});
