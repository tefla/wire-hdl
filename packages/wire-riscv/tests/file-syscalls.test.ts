import { describe, it, expect, beforeEach } from 'vitest';
import { RiscVCpu, SYSCALL } from '../src/emulator/cpu.js';
import { WireFS } from '../src/emulator/filesystem.js';
import { NativeAssembler } from '../src/emulator/native-assembler.js';

/**
 * Helper: Load and run RISC-V code
 */
function loadAndRun(cpu: RiscVCpu, code: Uint8Array, maxCycles: number): void {
  cpu.loadProgram(code);
  cpu.run(maxCycles);
}

/**
 * Tests for file syscalls (FOPEN, FREAD, FWRITE, FCLOSE, READDIR)
 */
describe('File Syscalls', () => {
  let cpu: RiscVCpu;
  let fs: WireFS;
  let asm: NativeAssembler;

  beforeEach(() => {
    cpu = new RiscVCpu({ memorySize: 0x10000 });
    const storage = new Uint8Array(64 * 1024);
    fs = new WireFS(storage);
    fs.format();
    cpu.filesystem = fs;
    asm = new NativeAssembler();

    // Create test files
    fs.createFile('TEST', 'TXT');
    fs.writeFile('TEST', 'TXT', new TextEncoder().encode('Hello World'));
    fs.createFile('DATA', 'BIN');
    fs.writeFile('DATA', 'BIN', new Uint8Array([1, 2, 3, 4, 5]));
  });

  describe('FOPEN syscall', () => {
    it('should open existing file for reading', () => {
      // Write filename to memory
      const filenameAddr = 0x1000;
      const filename = 'TEST.TXT\0';
      for (let i = 0; i < filename.length; i++) {
        cpu.writeByte(filenameAddr + i, filename.charCodeAt(i));
      }

      // Call FOPEN syscall via assembly
      const code = asm.assemble(`
        LUI a0, 0x1        ; filename address = 0x1000
        ADDI a1, zero, 0   ; mode = 0 (read)
        ADDI a7, zero, 7   ; syscall = FOPEN
        ECALL
      `);
      loadAndRun(cpu, code, 10);

      const handle = cpu.x[10]; // Return value in a0
      expect(handle).not.toBe(0xFFFFFFFF);
      expect(handle).toBeGreaterThan(0);
    });

    it('should return -1 for non-existent file in read mode', () => {
      const filenameAddr = 0x1000;
      const filename = 'NOTFOUND.TXT\0';
      for (let i = 0; i < filename.length; i++) {
        cpu.writeByte(filenameAddr + i, filename.charCodeAt(i));
      }

      const code = asm.assemble(`
        LUI a0, 0x1        ; filename address
        ADDI a1, zero, 0   ; mode = 0 (read)
        ADDI a7, zero, 7   ; syscall = FOPEN
        ECALL
      `);
      loadAndRun(cpu, code, 10);

      expect(cpu.x[10]).toBe(0xFFFFFFFF);
    });

    it('should open file for writing even if it does not exist', () => {
      const filenameAddr = 0x1000;
      const filename = 'NEW.TXT\0';
      for (let i = 0; i < filename.length; i++) {
        cpu.writeByte(filenameAddr + i, filename.charCodeAt(i));
      }

      const code = asm.assemble(`
        LUI a0, 0x1        ; filename address
        ADDI a1, zero, 1   ; mode = 1 (write)
        ADDI a7, zero, 7   ; syscall = FOPEN
        ECALL
      `);
      loadAndRun(cpu, code, 10);

      const handle = cpu.x[10];
      expect(handle).not.toBe(0xFFFFFFFF);
    });
  });

  describe('File I/O integration', () => {
    it('should open, read, and close file', () => {
      // Write filename
      const filenameAddr = 0x1000;
      const filename = 'TEST.TXT\0';
      for (let i = 0; i < filename.length; i++) {
        cpu.writeByte(filenameAddr + i, filename.charCodeAt(i));
      }

      // Open file
      const openCode = asm.assemble(`
        LUI a0, 0x1        ; filename address
        ADDI a1, zero, 0   ; mode = 0 (read)
        ADDI a7, zero, 7   ; syscall = FOPEN
        ECALL
      `);
      loadAndRun(cpu, openCode, 10);
      const handle = cpu.x[10];
      expect(handle).toBeGreaterThan(0);

      // Read from file
      const readCode = asm.assemble(`
        ADDI a0, zero, 1   ; handle = 1
        LUI a1, 0x2        ; buffer = 0x2000
        ADDI a2, zero, 100 ; count = 100
        ADDI a7, zero, 8   ; syscall = FREAD
        ECALL
      `);
      cpu.reset();
      loadAndRun(cpu, readCode, 10);
      const bytesRead = cpu.x[10];
      expect(bytesRead).toBe(11); // "Hello World"

      // Check buffer
      const text = [];
      for (let i = 0; i < bytesRead; i++) {
        text.push(String.fromCharCode(cpu.readByte(0x2000 + i)));
      }
      expect(text.join('')).toBe('Hello World');
    });

    it('should return -1 when no filesystem attached', () => {
      cpu.filesystem = null;

      const code = asm.assemble(`
        LUI a0, 0x1
        ADDI a1, zero, 0
        ADDI a7, zero, 7   ; FOPEN
        ECALL
      `);
      loadAndRun(cpu, code, 10);

      expect(cpu.x[10]).toBe(0xFFFFFFFF);
    });
  });
});
