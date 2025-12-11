import { describe, it, expect, beforeEach } from 'vitest';
import { RiscVCpu } from '../src/emulator/cpu.js';
import { TEXT_COLS, TEXT_ROWS } from '../src/emulator/graphics.js';

/**
 * Tests for Console Driver functionality
 *
 * The console driver provides terminal-like behavior on top of
 * the graphics card and keyboard, including:
 * - Cursor management
 * - Line wrapping
 * - Screen scrolling
 * - Line input (getline)
 */
describe('Console Driver', () => {
  let cpu: RiscVCpu;

  beforeEach(() => {
    cpu = new RiscVCpu({ memorySize: 0x10000 });
  });

  describe('cursor management', () => {
    it('should start cursor at position (0,0)', () => {
      const cursor = cpu.gpu.getCursorPosition();
      expect(cursor.x).toBe(0);
      expect(cursor.y).toBe(0);
    });

    it('should advance cursor after putchar', () => {
      // putchar('A')
      cpu.keyboard.keyPress(0); // Not used, just setup
      syscallPutchar(cpu, 65); // 'A'

      const cursor = cpu.gpu.getCursorPosition();
      expect(cursor.x).toBe(1);
      expect(cursor.y).toBe(0);
    });

    it('should advance cursor for multiple characters', () => {
      syscallPutchar(cpu, 65); // 'A'
      syscallPutchar(cpu, 66); // 'B'
      syscallPutchar(cpu, 67); // 'C'

      const cursor = cpu.gpu.getCursorPosition();
      expect(cursor.x).toBe(3);
      expect(cursor.y).toBe(0);
    });
  });

  describe('line wrapping', () => {
    it('should wrap to next line at column 80', () => {
      // Write 80 characters to fill line
      for (let i = 0; i < 80; i++) {
        syscallPutchar(cpu, 65 + (i % 26));
      }

      const cursor = cpu.gpu.getCursorPosition();
      expect(cursor.x).toBe(0);
      expect(cursor.y).toBe(1);
    });

    it('should write character at correct position after wrap', () => {
      // Fill first line
      for (let i = 0; i < 80; i++) {
        syscallPutchar(cpu, 46); // '.'
      }
      // Write on second line
      syscallPutchar(cpu, 88); // 'X'

      const { char } = cpu.gpu.readTextVram(0, 1);
      expect(char).toBe(88); // 'X'
    });
  });

  describe('newline handling', () => {
    it('should move to start of next line on LF (0x0A)', () => {
      syscallPutchar(cpu, 65); // 'A'
      syscallPutchar(cpu, 0x0A); // LF

      const cursor = cpu.gpu.getCursorPosition();
      expect(cursor.x).toBe(0);
      expect(cursor.y).toBe(1);
    });

    it('should move to start of next line on CR (0x0D)', () => {
      syscallPutchar(cpu, 65); // 'A'
      syscallPutchar(cpu, 0x0D); // CR

      const cursor = cpu.gpu.getCursorPosition();
      expect(cursor.x).toBe(0);
      expect(cursor.y).toBe(1);
    });

    it('should handle CRLF sequence', () => {
      syscallPutchar(cpu, 65); // 'A'
      syscallPutchar(cpu, 0x0D); // CR
      syscallPutchar(cpu, 0x0A); // LF

      const cursor = cpu.gpu.getCursorPosition();
      expect(cursor.x).toBe(0);
      expect(cursor.y).toBe(2);
    });
  });

  describe('backspace handling', () => {
    it('should move cursor back on backspace', () => {
      syscallPutchar(cpu, 65); // 'A'
      syscallPutchar(cpu, 66); // 'B'
      syscallPutchar(cpu, 0x08); // Backspace

      const cursor = cpu.gpu.getCursorPosition();
      expect(cursor.x).toBe(1);
    });

    it('should clear character at cursor position', () => {
      syscallPutchar(cpu, 65); // 'A'
      syscallPutchar(cpu, 66); // 'B'
      syscallPutchar(cpu, 0x08); // Backspace

      const { char } = cpu.gpu.readTextVram(1, 0);
      expect(char).toBe(0x20); // Space (cleared)
    });

    it('should not go past column 0', () => {
      syscallPutchar(cpu, 0x08); // Backspace at start

      const cursor = cpu.gpu.getCursorPosition();
      expect(cursor.x).toBe(0);
      expect(cursor.y).toBe(0);
    });
  });

  describe('screen scrolling', () => {
    it('should scroll when cursor reaches line 25', () => {
      // Fill 25 lines
      for (let line = 0; line < 25; line++) {
        syscallPutchar(cpu, 65 + line); // A, B, C, ...
        syscallPutchar(cpu, 0x0A); // newline
      }

      // Cursor should be at line 24 (last line), not 25
      const cursor = cpu.gpu.getCursorPosition();
      expect(cursor.y).toBe(24);
    });

    it('should move content up when scrolling', () => {
      // Write 'A' on first line
      syscallPutchar(cpu, 65); // 'A'

      // Move to line 25 (triggers scroll)
      for (let i = 0; i < 25; i++) {
        syscallPutchar(cpu, 0x0A);
      }

      // 'A' should now be gone (scrolled off top)
      const { char } = cpu.gpu.readTextVram(0, 0);
      expect(char).not.toBe(65);
    });

    it('should clear last line after scroll', () => {
      // Fill all lines with 'X'
      for (let line = 0; line < 25; line++) {
        syscallPutchar(cpu, 88); // 'X'
        if (line < 24) syscallPutchar(cpu, 0x0A);
      }

      // Trigger scroll
      syscallPutchar(cpu, 0x0A);

      // Last line should be clear (spaces)
      const { char } = cpu.gpu.readTextVram(0, 24);
      expect(char).toBe(0x20); // Space
    });
  });

  describe('tab handling', () => {
    it('should advance to next tab stop (every 8 columns)', () => {
      syscallPutchar(cpu, 0x09); // Tab

      const cursor = cpu.gpu.getCursorPosition();
      expect(cursor.x).toBe(8);
    });

    it('should advance from column 5 to column 8', () => {
      for (let i = 0; i < 5; i++) {
        syscallPutchar(cpu, 65); // 'A'
      }
      syscallPutchar(cpu, 0x09); // Tab

      const cursor = cpu.gpu.getCursorPosition();
      expect(cursor.x).toBe(8);
    });

    it('should advance from column 8 to column 16', () => {
      for (let i = 0; i < 8; i++) {
        syscallPutchar(cpu, 65);
      }
      syscallPutchar(cpu, 0x09); // Tab

      const cursor = cpu.gpu.getCursorPosition();
      expect(cursor.x).toBe(16);
    });
  });

  describe('syscall 6: getline', () => {
    it('should read line into buffer', () => {
      // Type "HI" + Enter
      cpu.keyboard.keyPress(72); // 'H'
      cpu.keyboard.keyPress(73); // 'I'
      cpu.keyboard.keyPress(0x0D); // Enter

      // getline(buffer=0x1000, maxlen=80)
      const result = syscallGetline(cpu, 0x1000, 80);

      expect(result).toBe(2); // 2 characters read
      expect(cpu.readByte(0x1000)).toBe(72); // 'H'
      expect(cpu.readByte(0x1001)).toBe(73); // 'I'
      expect(cpu.readByte(0x1002)).toBe(0);  // null terminator
    });

    it('should echo characters to screen', () => {
      cpu.keyboard.keyPress(65); // 'A'
      cpu.keyboard.keyPress(0x0D); // Enter

      syscallGetline(cpu, 0x1000, 80);

      // 'A' should be on screen
      const { char } = cpu.gpu.readTextVram(0, 0);
      expect(char).toBe(65);
    });

    it('should handle backspace during input', () => {
      cpu.keyboard.keyPress(65); // 'A'
      cpu.keyboard.keyPress(66); // 'B'
      cpu.keyboard.keyPress(0x08); // Backspace
      cpu.keyboard.keyPress(67); // 'C'
      cpu.keyboard.keyPress(0x0D); // Enter

      const result = syscallGetline(cpu, 0x1000, 80);

      expect(result).toBe(2); // "AC"
      expect(cpu.readByte(0x1000)).toBe(65); // 'A'
      expect(cpu.readByte(0x1001)).toBe(67); // 'C'
    });

    it('should respect maxlen limit', () => {
      // Type more than maxlen characters
      for (let i = 0; i < 10; i++) {
        cpu.keyboard.keyPress(65 + i);
      }
      cpu.keyboard.keyPress(0x0D);

      const result = syscallGetline(cpu, 0x1000, 5);

      expect(result).toBe(5); // Only 5 characters read
      expect(cpu.readByte(0x1005)).toBe(0); // null terminator
    });

    it('should return -1 if no Enter pressed (non-blocking check)', () => {
      // No keys pressed
      const result = syscallGetlineNonBlocking(cpu, 0x1000, 80);

      expect(result).toBe(-1);
    });
  });

  describe('puts with console features', () => {
    it('should handle embedded newlines in string', () => {
      // Store "A\nB" at 0x1000
      cpu.writeByte(0x1000, 65);  // 'A'
      cpu.writeByte(0x1001, 0x0A); // LF
      cpu.writeByte(0x1002, 66);  // 'B'
      cpu.writeByte(0x1003, 0);   // null

      syscallPuts(cpu, 0x1000);

      // Check cursor moved correctly
      const cursor = cpu.gpu.getCursorPosition();
      expect(cursor.x).toBe(1); // After 'B'
      expect(cursor.y).toBe(1); // On second line
    });

    it('should scroll if string causes overflow', () => {
      // Position cursor near bottom
      for (let i = 0; i < 24; i++) {
        syscallPutchar(cpu, 0x0A);
      }

      // Store multi-line string
      cpu.writeByte(0x1000, 65);  // 'A'
      cpu.writeByte(0x1001, 0x0A);
      cpu.writeByte(0x1002, 66);  // 'B'
      cpu.writeByte(0x1003, 0x0A);
      cpu.writeByte(0x1004, 67);  // 'C'
      cpu.writeByte(0x1005, 0);

      syscallPuts(cpu, 0x1000);

      // Should have scrolled
      const cursor = cpu.gpu.getCursorPosition();
      expect(cursor.y).toBe(24);
    });
  });
});

/**
 * Helper: Execute putchar syscall
 */
function syscallPutchar(cpu: RiscVCpu, char: number): void {
  cpu.setReg(10, char);  // a0 = char
  cpu.setReg(17, 1);     // a7 = 1 (putchar)

  // Execute ECALL
  cpu.writeWord(cpu.pc, 0x00000073);
  cpu.step();
}

/**
 * Helper: Execute puts syscall
 */
function syscallPuts(cpu: RiscVCpu, address: number): number {
  cpu.setReg(10, address); // a0 = address
  cpu.setReg(17, 3);       // a7 = 3 (puts)

  cpu.writeWord(cpu.pc, 0x00000073);
  cpu.step();

  return cpu.getReg(10);
}

/**
 * Helper: Execute getline syscall (blocking simulation)
 */
function syscallGetline(cpu: RiscVCpu, buffer: number, maxlen: number): number {
  cpu.setReg(10, buffer);  // a0 = buffer
  cpu.setReg(11, maxlen);  // a1 = maxlen
  cpu.setReg(17, 6);       // a7 = 6 (getline)

  cpu.writeWord(cpu.pc, 0x00000073);
  cpu.step();

  return cpu.getReg(10);
}

/**
 * Helper: Execute getline syscall (non-blocking check)
 */
function syscallGetlineNonBlocking(cpu: RiscVCpu, buffer: number, maxlen: number): number {
  // For non-blocking, we check if there's input ready
  // If no Enter key in buffer, returns -1
  cpu.setReg(10, buffer);
  cpu.setReg(11, maxlen);
  cpu.setReg(17, 6);

  cpu.writeWord(cpu.pc, 0x00000073);
  cpu.step();

  return cpu.getReg(10) | 0; // Signed interpretation
}
