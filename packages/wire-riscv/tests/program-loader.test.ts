import { describe, it, expect, beforeEach } from 'vitest';
import { RiscVCpu } from '../src/emulator/cpu.js';
import {
  ProgramLoader,
  ExecutableBuilder,
  EXECUTABLE_MAGIC,
  HEADER_SIZE,
} from '../src/emulator/program-loader.js';

/**
 * Tests for the Program Loader
 */
describe('ProgramLoader', () => {
  let cpu: RiscVCpu;
  let loader: ProgramLoader;

  beforeEach(() => {
    cpu = new RiscVCpu({ memorySize: 0x10000 }); // 64KB
    loader = new ProgramLoader(cpu);
  });

  describe('executable format constants', () => {
    it('should have correct magic number', () => {
      // "RISV" in little-endian
      expect(EXECUTABLE_MAGIC).toBe(0x56534952);
    });

    it('should have correct header size', () => {
      expect(HEADER_SIZE).toBe(0x18); // 24 bytes
    });
  });

  describe('header validation', () => {
    it('should reject invalid magic number', () => {
      const badExe = new Uint8Array(HEADER_SIZE);
      badExe[0] = 0x00; // Invalid magic

      expect(() => loader.load(badExe, 0x1000)).toThrow('Invalid executable');
    });

    it('should accept valid magic number', () => {
      const exe = new ExecutableBuilder()
        .setCode(new Uint8Array([0x73, 0x00, 0x00, 0x00])) // ecall (halt)
        .build();

      expect(() => loader.load(exe, 0x1000)).not.toThrow();
    });

    it('should parse entry point from header', () => {
      const exe = new ExecutableBuilder()
        .setEntryPoint(0x100)
        .setCode(new Uint8Array([0x73, 0x00, 0x00, 0x00]))
        .build();

      const info = loader.load(exe, 0x1000);
      expect(info.entryPoint).toBe(0x1100); // base + offset
    });
  });

  describe('code loading', () => {
    it('should load code section to memory', () => {
      // addi x1, x0, 42 (0x02a00093)
      const code = new Uint8Array([0x93, 0x00, 0xa0, 0x02]);
      const exe = new ExecutableBuilder().setCode(code).build();

      loader.load(exe, 0x1000);

      // Verify code is at base address
      expect(cpu.readByte(0x1000)).toBe(0x93);
      expect(cpu.readByte(0x1001)).toBe(0x00);
      expect(cpu.readByte(0x1002)).toBe(0xa0);
      expect(cpu.readByte(0x1003)).toBe(0x02);
    });

    it('should load multi-instruction code', () => {
      const code = new Uint8Array([
        0x93, 0x00, 0xa0, 0x02, // addi x1, x0, 42
        0x13, 0x01, 0x50, 0x00, // addi x2, x0, 5
        0x73, 0x00, 0x00, 0x00, // ecall
      ]);
      const exe = new ExecutableBuilder().setCode(code).build();

      loader.load(exe, 0x1000);

      // Verify all instructions
      expect(cpu.readWord(0x1000)).toBe(0x02a00093);
      expect(cpu.readWord(0x1004)).toBe(0x00500113);
      expect(cpu.readWord(0x1008)).toBe(0x00000073);
    });
  });

  describe('data loading', () => {
    it('should load data section after code', () => {
      const code = new Uint8Array([0x73, 0x00, 0x00, 0x00]); // 4 bytes
      const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"

      const exe = new ExecutableBuilder().setCode(code).setData(data).build();

      loader.load(exe, 0x1000);

      // Data should be after code
      expect(cpu.readByte(0x1004)).toBe(0x48); // 'H'
      expect(cpu.readByte(0x1005)).toBe(0x65); // 'e'
      expect(cpu.readByte(0x1008)).toBe(0x6f); // 'o'
    });
  });

  describe('BSS section', () => {
    it('should zero BSS section after data', () => {
      const code = new Uint8Array([0x73, 0x00, 0x00, 0x00]); // 4 bytes
      const bssSize = 16;

      // Pre-fill memory with non-zero values
      for (let i = 0; i < 32; i++) {
        cpu.writeByte(0x1004 + i, 0xFF);
      }

      const exe = new ExecutableBuilder().setCode(code).setBssSize(bssSize).build();

      loader.load(exe, 0x1000);

      // BSS should be zeroed
      for (let i = 0; i < bssSize; i++) {
        expect(cpu.readByte(0x1004 + i)).toBe(0);
      }
    });
  });

  describe('stack setup', () => {
    it('should set up stack pointer', () => {
      const code = new Uint8Array([0x73, 0x00, 0x00, 0x00]);
      const exe = new ExecutableBuilder().setCode(code).setStackSize(256).build();

      const info = loader.load(exe, 0x1000);

      // Stack top should be returned
      expect(info.stackTop).toBeGreaterThan(0x1000);
    });
  });

  describe('program execution', () => {
    it('should execute loaded program', () => {
      // Program: addi x1, x0, 99; ecall
      const code = new Uint8Array([
        0x93, 0x00, 0x30, 0x06, // addi x1, x0, 99
        0x73, 0x00, 0x00, 0x00, // ecall (exit)
      ]);
      const exe = new ExecutableBuilder().setCode(code).build();

      const info = loader.load(exe, 0x1000);
      cpu.setReg(2, info.stackTop); // Set stack pointer
      cpu.pc = info.entryPoint;
      cpu.run(100);

      expect(cpu.getReg(1)).toBe(99);
      expect(cpu.halted).toBe(true);
    });

    it('should execute program with entry point offset', () => {
      // Program with entry at offset 4
      const code = new Uint8Array([
        0x93, 0x00, 0xa0, 0x00, // addi x1, x0, 10 (skipped)
        0x93, 0x00, 0x40, 0x06, // addi x1, x0, 100 (entry)
        0x73, 0x00, 0x00, 0x00, // ecall
      ]);
      const exe = new ExecutableBuilder().setEntryPoint(4).setCode(code).build();

      const info = loader.load(exe, 0x1000);
      cpu.pc = info.entryPoint;
      cpu.run(100);

      expect(cpu.getReg(1)).toBe(100);
    });

    it('should access data section from code', () => {
      // Program that loads from data section
      // Code is 12 bytes, so data is at base + 12 = 0x100C
      // lui t0, 0x1 (t0 = 0x1000) - 0x000012B7
      // lbu a1, 12(t0) (load byte at 0x100C where data starts) - 0x00C2C583
      // ecall - 0x00000073
      const code = new Uint8Array([
        0xb7, 0x12, 0x00, 0x00, // lui t0, 0x1 (t0 = 0x1000)
        0x83, 0xc5, 0xc2, 0x00, // lbu a1, 12(t0)
        0x73, 0x00, 0x00, 0x00, // ecall
      ]);
      const data = new Uint8Array([0x42]); // 'B' = 66

      const exe = new ExecutableBuilder().setCode(code).setData(data).build();

      loader.load(exe, 0x1000);
      cpu.pc = 0x1000;
      cpu.run(100);

      expect(cpu.getReg(11)).toBe(0x42);
    });
  });

  describe('ExecutableBuilder', () => {
    it('should build valid executable', () => {
      const exe = new ExecutableBuilder()
        .setCode(new Uint8Array([0x73, 0x00, 0x00, 0x00]))
        .build();

      expect(exe.length).toBeGreaterThanOrEqual(HEADER_SIZE);

      // Check magic
      const magic =
        exe[0] | (exe[1] << 8) | (exe[2] << 16) | (exe[3] << 24);
      expect(magic).toBe(EXECUTABLE_MAGIC);
    });

    it('should set code size in header', () => {
      const code = new Uint8Array(100);
      const exe = new ExecutableBuilder().setCode(code).build();

      // Code size at offset 0x08
      const codeSize =
        exe[8] | (exe[9] << 8) | (exe[10] << 16) | (exe[11] << 24);
      expect(codeSize).toBe(100);
    });

    it('should set data size in header', () => {
      const code = new Uint8Array([0x73, 0x00, 0x00, 0x00]);
      const data = new Uint8Array(50);
      const exe = new ExecutableBuilder().setCode(code).setData(data).build();

      // Data size at offset 0x0C
      const dataSize =
        exe[12] | (exe[13] << 8) | (exe[14] << 16) | (exe[15] << 24);
      expect(dataSize).toBe(50);
    });
  });

  describe('integration', () => {
    it('should load from disk and execute', () => {
      // Write executable to disk
      const code = new Uint8Array([
        0x93, 0x00, 0x70, 0x07, // addi x1, x0, 119
        0x73, 0x00, 0x00, 0x00, // ecall
      ]);
      const exe = new ExecutableBuilder().setCode(code).build();

      // Write to disk sector
      const sector = new Uint8Array(512);
      sector.set(exe);
      cpu.storage.getHdd().write(10, sector);

      // Load from disk - read(sector, count) returns Uint8Array
      const buffer = cpu.storage.getHdd().read(10, 1);

      const info = loader.load(buffer.subarray(0, exe.length), 0x2000);
      cpu.pc = info.entryPoint;
      cpu.run(100);

      expect(cpu.getReg(1)).toBe(119);
    });
  });
});
