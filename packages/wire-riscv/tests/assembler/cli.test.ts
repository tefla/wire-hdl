import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { main } from '../../src/assembler/cli.js';
import { tmpdir } from 'os';
import { join } from 'path';

describe('CLI', () => {
  const testDir = join(tmpdir(), 'riscv-asm-test-' + Date.now());
  let consoleLogs: string[] = [];
  let consoleErrors: string[] = [];
  let originalLog: typeof console.log;
  let originalError: typeof console.error;

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    consoleLogs = [];
    consoleErrors = [];
    originalLog = console.log;
    originalError = console.error;
    console.log = (...args) => consoleLogs.push(args.join(' '));
    console.error = (...args) => consoleErrors.push(args.join(' '));
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
    // Clean up test files
    try {
      const files = ['test.asm', 'test.bin', 'output.bin', 'error.asm'];
      for (const file of files) {
        const path = join(testDir, file);
        if (existsSync(path)) unlinkSync(path);
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('argument parsing', () => {
    it('should show help with no arguments', () => {
      const exitCode = main(['bun', 'cli.ts']);
      expect(exitCode).toBe(1);
      expect(consoleLogs.some(l => l.includes('Usage'))).toBe(true);
    });

    it('should show help with -h flag', () => {
      const exitCode = main(['bun', 'cli.ts', '-h']);
      expect(exitCode).toBe(0);
      expect(consoleLogs.some(l => l.includes('Usage'))).toBe(true);
    });

    it('should show help with --help flag', () => {
      const exitCode = main(['bun', 'cli.ts', '--help']);
      expect(exitCode).toBe(0);
      expect(consoleLogs.some(l => l.includes('Usage'))).toBe(true);
    });

    it('should error on unknown option', () => {
      const exitCode = main(['bun', 'cli.ts', '--unknown']);
      expect(exitCode).toBe(1);
      expect(consoleErrors.some(l => l.includes('Unknown option'))).toBe(true);
    });

    it('should error when -o is missing filename', () => {
      const exitCode = main(['bun', 'cli.ts', 'test.asm', '-o']);
      expect(exitCode).toBe(1);
      expect(consoleErrors.some(l => l.includes('-o requires'))).toBe(true);
    });
  });

  describe('file operations', () => {
    it('should error on missing input file', () => {
      const exitCode = main(['bun', 'cli.ts', join(testDir, 'nonexistent.asm')]);
      expect(exitCode).toBe(1);
      expect(consoleErrors.some(l => l.includes('File not found'))).toBe(true);
    });

    it('should assemble valid program', () => {
      const inputPath = join(testDir, 'test.asm');
      const outputPath = join(testDir, 'test.bin');

      writeFileSync(inputPath, 'ADDI x1, x0, 42\nEBREAK');

      const exitCode = main(['bun', 'cli.ts', inputPath]);

      expect(exitCode).toBe(0);
      expect(existsSync(outputPath)).toBe(true);

      const bytes = readFileSync(outputPath);
      expect(bytes.length).toBe(8); // 2 instructions
    });

    it('should use custom output file with -o', () => {
      const inputPath = join(testDir, 'test.asm');
      const outputPath = join(testDir, 'output.bin');

      writeFileSync(inputPath, 'NOP');

      const exitCode = main(['bun', 'cli.ts', inputPath, '-o', outputPath]);

      expect(exitCode).toBe(0);
      expect(existsSync(outputPath)).toBe(true);
    });

    it('should use custom output file with --output', () => {
      const inputPath = join(testDir, 'test.asm');
      const outputPath = join(testDir, 'output.bin');

      writeFileSync(inputPath, 'NOP');

      const exitCode = main(['bun', 'cli.ts', inputPath, '--output', outputPath]);

      expect(exitCode).toBe(0);
      expect(existsSync(outputPath)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should report assembly errors with line numbers', () => {
      const inputPath = join(testDir, 'error.asm');

      writeFileSync(inputPath, `NOP
JAL ra, undefined_label
NOP`);

      const exitCode = main(['bun', 'cli.ts', inputPath]);

      expect(exitCode).toBe(1);
      expect(consoleErrors.some(l => l.includes(':2:') && l.includes('undefined'))).toBe(true);
    });

    it('should report parse errors', () => {
      const inputPath = join(testDir, 'error.asm');

      writeFileSync(inputPath, 'ADD x1, x2');

      const exitCode = main(['bun', 'cli.ts', inputPath]);

      expect(exitCode).toBe(1);
      expect(consoleErrors.length).toBeGreaterThan(0);
    });
  });

  describe('hex dump', () => {
    it('should print hex dump with --hex flag', () => {
      const inputPath = join(testDir, 'test.asm');

      writeFileSync(inputPath, 'ADDI x1, x0, 0x42');

      const exitCode = main(['bun', 'cli.ts', inputPath, '--hex']);

      expect(exitCode).toBe(0);
      expect(consoleLogs.some(l => l.includes('Hex dump'))).toBe(true);
      expect(consoleLogs.some(l => l.includes('00000000'))).toBe(true);
    });
  });

  describe('output messages', () => {
    it('should print byte count on success', () => {
      const inputPath = join(testDir, 'test.asm');

      writeFileSync(inputPath, 'NOP\nNOP\nNOP');

      const exitCode = main(['bun', 'cli.ts', inputPath]);

      expect(exitCode).toBe(0);
      expect(consoleLogs.some(l => l.includes('12 bytes'))).toBe(true);
    });

    it('should print symbol count when symbols present', () => {
      const inputPath = join(testDir, 'test.asm');

      writeFileSync(inputPath, `
.equ VALUE, 42
main:
  NOP
loop:
  NOP`);

      const exitCode = main(['bun', 'cli.ts', inputPath]);

      expect(exitCode).toBe(0);
      expect(consoleLogs.some(l => l.includes('Symbols: 3'))).toBe(true);
    });
  });
});
