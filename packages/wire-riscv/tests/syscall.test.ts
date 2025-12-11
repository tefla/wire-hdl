import { describe, it, expect, beforeEach } from 'vitest';
import { RiscVCpu } from '../src/emulator/cpu.js';

/**
 * Tests for ECALL syscall handling
 *
 * Syscall convention (Linux-like):
 * - a7 (x17) = syscall number
 * - a0-a6 (x10-x16) = arguments
 * - a0 (x10) = return value
 */
describe('Syscall Handler', () => {
  let cpu: RiscVCpu;

  beforeEach(() => {
    cpu = new RiscVCpu({ memorySize: 0x10000 });
  });

  describe('syscall dispatcher', () => {
    it('should dispatch based on a7 register', () => {
      // Set a7 = 0 (exit syscall)
      // addi a7, x0, 0   ; syscall number
      // ecall
      const code = [
        0x00000893, // addi a7, x0, 0
        0x00000073, // ecall
      ];
      loadAndRun(cpu, code, 2);

      // CPU should be halted after exit syscall
      expect(cpu.halted).toBe(true);
    });

    it('should set exit code in a0 for exit syscall', () => {
      // addi a0, x0, 42  ; exit code
      // addi a7, x0, 0   ; syscall 0 = exit
      // ecall
      const code = [
        0x02A00513, // addi a0, x0, 42
        0x00000893, // addi a7, x0, 0
        0x00000073, // ecall
      ];
      loadAndRun(cpu, code, 3);

      expect(cpu.halted).toBe(true);
      expect(cpu.exitCode).toBe(42);
    });
  });

  describe('syscall 0: exit', () => {
    it('should halt CPU with exit code 0', () => {
      const code = [
        0x00000513, // addi a0, x0, 0  ; exit code = 0
        0x00000893, // addi a7, x0, 0  ; syscall = exit
        0x00000073, // ecall
      ];
      loadAndRun(cpu, code, 3);

      expect(cpu.halted).toBe(true);
      expect(cpu.exitCode).toBe(0);
    });

    it('should halt CPU with non-zero exit code', () => {
      const code = [
        0x00100513, // addi a0, x0, 1  ; exit code = 1
        0x00000893, // addi a7, x0, 0  ; syscall = exit
        0x00000073, // ecall
      ];
      loadAndRun(cpu, code, 3);

      expect(cpu.halted).toBe(true);
      expect(cpu.exitCode).toBe(1);
    });
  });

  describe('syscall 1: putchar', () => {
    it('should write character to console', () => {
      // addi a0, x0, 65  ; 'A'
      // addi a7, x0, 1   ; syscall = putchar
      // ecall
      const code = [
        0x04100513, // addi a0, x0, 65 ('A')
        0x00100893, // addi a7, x0, 1
        0x00000073, // ecall
      ];
      loadAndRun(cpu, code, 3);

      // Character should be written to console buffer
      expect(cpu.consoleOutput).toContain('A');
    });

    it('should advance cursor position', () => {
      const code = [
        0x04100513, // addi a0, x0, 65 ('A')
        0x00100893, // addi a7, x0, 1
        0x00000073, // ecall
      ];

      const initialCursor = cpu.gpu.getCursorPosition();
      loadAndRun(cpu, code, 3);
      const finalCursor = cpu.gpu.getCursorPosition();

      expect(finalCursor.x).toBe(initialCursor.x + 1);
    });

    it('should handle newline character', () => {
      // Write 'A', then newline
      const code = [
        0x04100513, // addi a0, x0, 65 ('A')
        0x00100893, // addi a7, x0, 1
        0x00000073, // ecall
        0x00D00513, // addi a0, x0, 0x0D (CR)
        0x00100893, // addi a7, x0, 1
        0x00000073, // ecall
      ];
      loadAndRun(cpu, code, 6);

      const cursor = cpu.gpu.getCursorPosition();
      expect(cursor.x).toBe(0);
      expect(cursor.y).toBeGreaterThan(0);
    });

    it('should return 0 on success', () => {
      const code = [
        0x04100513, // addi a0, x0, 65 ('A')
        0x00100893, // addi a7, x0, 1
        0x00000073, // ecall
      ];
      loadAndRun(cpu, code, 3);

      // a0 should be 0 (success)
      expect(cpu.getReg(10)).toBe(0);
    });
  });

  describe('syscall 2: getchar', () => {
    it('should return key from keyboard buffer', () => {
      cpu.keyboard.keyPress(65); // 'A'

      // addi a7, x0, 2  ; syscall = getchar
      // ecall
      const code = [
        0x00200893, // addi a7, x0, 2
        0x00000073, // ecall
      ];
      loadAndRun(cpu, code, 2);

      // a0 should contain 'A'
      expect(cpu.getReg(10)).toBe(65);
    });

    it('should return -1 when no key available (non-blocking)', () => {
      // No key pressed

      const code = [
        0x00200893, // addi a7, x0, 2
        0x00000073, // ecall
      ];
      loadAndRun(cpu, code, 2);

      // a0 should be -1 (0xFFFFFFFF as unsigned)
      expect(cpu.getReg(10)).toBe(0xFFFFFFFF);
    });

    it('should consume key from buffer', () => {
      cpu.keyboard.keyPress(65); // 'A'

      const code = [
        0x00200893, // addi a7, x0, 2
        0x00000073, // ecall
      ];
      loadAndRun(cpu, code, 2);

      // Key should be consumed
      expect(cpu.keyboard.hasKey()).toBe(false);
    });
  });

  describe('syscall 3: puts', () => {
    it('should print null-terminated string', () => {
      // Store "HI" at address 0x1000
      cpu.writeByte(0x1000, 0x48); // 'H'
      cpu.writeByte(0x1001, 0x49); // 'I'
      cpu.writeByte(0x1002, 0x00); // null terminator

      // lui a0, 0x1      ; a0 = 0x1000
      // addi a7, x0, 3   ; syscall = puts
      // ecall
      const code = [
        0x00001537, // lui a0, 0x1
        0x00300893, // addi a7, x0, 3
        0x00000073, // ecall
      ];
      loadAndRun(cpu, code, 3);

      expect(cpu.consoleOutput).toContain('HI');
    });

    it('should return number of characters printed', () => {
      // Store "ABC" at address 0x1000
      cpu.writeByte(0x1000, 0x41); // 'A'
      cpu.writeByte(0x1001, 0x42); // 'B'
      cpu.writeByte(0x1002, 0x43); // 'C'
      cpu.writeByte(0x1003, 0x00); // null terminator

      const code = [
        0x00001537, // lui a0, 0x1
        0x00300893, // addi a7, x0, 3
        0x00000073, // ecall
      ];
      loadAndRun(cpu, code, 3);

      expect(cpu.getReg(10)).toBe(3);
    });
  });

  describe('syscall 4: read_sector', () => {
    it('should read sector from disk to memory', () => {
      // Write test data to HDD sector 0
      const testData = new Uint8Array(512);
      testData[0] = 0xAA;
      testData[1] = 0xBB;
      testData[511] = 0xCC;
      cpu.storage.getHdd().write(0, testData);

      // lui a0, 0        ; a0 = sector 0
      // lui a1, 0x2      ; a1 = buffer at 0x2000
      // addi a7, x0, 4   ; syscall = read_sector
      // ecall
      const code = [
        0x00000537, // lui a0, 0
        0x000025B7, // lui a1, 0x2
        0x00400893, // addi a7, x0, 4
        0x00000073, // ecall
      ];
      loadAndRun(cpu, code, 4);

      // Data should be in memory at 0x2000
      expect(cpu.readByte(0x2000)).toBe(0xAA);
      expect(cpu.readByte(0x2001)).toBe(0xBB);
      expect(cpu.readByte(0x21FF)).toBe(0xCC);
    });

    it('should return 0 on success', () => {
      const code = [
        0x00000537, // lui a0, 0
        0x000025B7, // lui a1, 0x2
        0x00400893, // addi a7, x0, 4
        0x00000073, // ecall
      ];
      loadAndRun(cpu, code, 4);

      expect(cpu.getReg(10)).toBe(0);
    });
  });

  describe('syscall 5: write_sector', () => {
    it('should write memory to disk sector', () => {
      // Write test data to memory at 0x2000
      cpu.writeByte(0x2000, 0xDE);
      cpu.writeByte(0x2001, 0xAD);
      cpu.writeByte(0x21FF, 0xBE);

      // lui a0, 0        ; a0 = sector 0
      // lui a1, 0x2      ; a1 = buffer at 0x2000
      // addi a7, x0, 5   ; syscall = write_sector
      // ecall
      const code = [
        0x00000537, // lui a0, 0
        0x000025B7, // lui a1, 0x2
        0x00500893, // addi a7, x0, 5
        0x00000073, // ecall
      ];
      loadAndRun(cpu, code, 4);

      // Data should be on disk
      const sector = cpu.storage.getHdd().read(0, 1);
      expect(sector[0]).toBe(0xDE);
      expect(sector[1]).toBe(0xAD);
      expect(sector[511]).toBe(0xBE);
    });

    it('should return 0 on success', () => {
      const code = [
        0x00000537, // lui a0, 0
        0x000025B7, // lui a1, 0x2
        0x00500893, // addi a7, x0, 5
        0x00000073, // ecall
      ];
      loadAndRun(cpu, code, 4);

      expect(cpu.getReg(10)).toBe(0);
    });
  });

  describe('unknown syscall', () => {
    it('should return -1 for unknown syscall number', () => {
      // addi a7, x0, 99  ; unknown syscall
      // ecall
      const code = [
        0x06300893, // addi a7, x0, 99
        0x00000073, // ecall
      ];
      loadAndRun(cpu, code, 2);

      // Should return -1
      expect(cpu.getReg(10)).toBe(0xFFFFFFFF);
      // Should not halt
      expect(cpu.halted).toBe(false);
    });
  });
});

/**
 * Helper function to load machine code and run CPU
 */
function loadAndRun(cpu: RiscVCpu, code: number[], steps: number): void {
  // Load machine code at address 0
  for (let i = 0; i < code.length; i++) {
    cpu.writeWord(i * 4, code[i]);
  }

  // Run specified number of steps
  for (let i = 0; i < steps; i++) {
    if (cpu.halted) break;
    cpu.step();
  }
}
