import { describe, it, expect, beforeEach } from 'vitest';
import { RiscVCpu } from '../src/emulator/cpu.js';
import { NativeAssembler } from '../src/emulator/native-assembler.js';

describe('Terminal Control (task-31.1)', () => {
  let cpu: RiscVCpu;
  let assembler: NativeAssembler;

  beforeEach(() => {
    cpu = new RiscVCpu(64 * 1024);
    assembler = new NativeAssembler();
  });

  describe('ANSI escape sequences', () => {
    it('should correctly assemble clear screen sequence (ESC[2J)', () => {
      const source = `
        ; clearScreen() - ESC[2J
        STR_CLEAR: .string "\\x1b[2J"
      `;

      const binary = assembler.assemble(source);

      // Check that \x1b[2J (4 bytes + null) is in memory
      expect(binary[0]).toBe(0x1b); // ESC
      expect(binary[1]).toBe(0x5b); // [
      expect(binary[2]).toBe(0x32); // 2
      expect(binary[3]).toBe(0x4a); // J
      expect(binary[4]).toBe(0x00); // null terminator
    });

    it('should correctly assemble move cursor sequence (ESC[5;10H)', () => {
      const source = `
        ; moveCursor(5, 10) - ESC[5;10H
        STR_MOVE: .string "\\x1b[5;10H"
      `;

      const binary = assembler.assemble(source);

      const expected = [0x1b, 0x5b, 0x35, 0x3b, 0x31, 0x30, 0x48, 0x00]; // \x1b[5;10H\0
      for (let i = 0; i < expected.length; i++) {
        expect(binary[i]).toBe(expected[i]);
      }
    });

    it('should correctly assemble clear line sequence (ESC[K)', () => {
      const source = `
        ; clearLine() - ESC[K
        STR_CLEAR_LINE: .string "\\x1b[K"
      `;

      const binary = assembler.assemble(source);

      expect(binary[0]).toBe(0x1b); // ESC
      expect(binary[1]).toBe(0x5b); // [
      expect(binary[2]).toBe(0x4b); // K
      expect(binary[3]).toBe(0x00); // null
    });

    it('should correctly assemble hide cursor sequence (ESC[?25l)', () => {
      const source = `
        ; hideCursor() - ESC[?25l
        STR_HIDE: .string "\\x1b[?25l"
      `;

      const binary = assembler.assemble(source);

      const expected = [0x1b, 0x5b, 0x3f, 0x32, 0x35, 0x6c, 0x00]; // \x1b[?25l\0
      for (let i = 0; i < expected.length; i++) {
        expect(binary[i]).toBe(expected[i]);
      }
    });

    it('should correctly assemble show cursor sequence (ESC[?25h)', () => {
      const source = `
        ; showCursor() - ESC[?25h
        STR_SHOW: .string "\\x1b[?25h"
      `;

      const binary = assembler.assemble(source);

      const expected = [0x1b, 0x5b, 0x3f, 0x32, 0x35, 0x68, 0x00]; // \x1b[?25h\0
      for (let i = 0; i < expected.length; i++) {
        expect(binary[i]).toBe(expected[i]);
      }
    });

    it('should correctly assemble reverse video sequence (ESC[7m)', () => {
      const source = `
        ; setReverse() - ESC[7m
        STR_REVERSE: .string "\\x1b[7m"
      `;

      const binary = assembler.assemble(source);

      expect(binary[0]).toBe(0x1b); // ESC
      expect(binary[1]).toBe(0x5b); // [
      expect(binary[2]).toBe(0x37); // 7
      expect(binary[3]).toBe(0x6d); // m
      expect(binary[4]).toBe(0x00); // null
    });

    it('should correctly assemble reset attributes sequence (ESC[0m)', () => {
      const source = `
        ; resetAttrs() - ESC[0m
        STR_RESET: .string "\\x1b[0m"
      `;

      const binary = assembler.assemble(source);

      expect(binary[0]).toBe(0x1b); // ESC
      expect(binary[1]).toBe(0x5b); // [
      expect(binary[2]).toBe(0x30); // 0
      expect(binary[3]).toBe(0x6d); // m
      expect(binary[4]).toBe(0x00); // null
    });
  });
});
