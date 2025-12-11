import { describe, it, expect, beforeEach } from 'vitest';
import {
  KeyboardController,
  KEYBOARD_BASE,
  KEYBOARD_REGS,
  KeyModifier,
} from '../src/emulator/keyboard.js';

describe('KeyboardController', () => {
  let keyboard: KeyboardController;

  beforeEach(() => {
    keyboard = new KeyboardController();
  });

  describe('initial state', () => {
    it('should start with status 0 (no key available)', () => {
      expect(keyboard.readRegister(KEYBOARD_REGS.STATUS)).toBe(0);
    });

    it('should start with data 0', () => {
      expect(keyboard.readRegister(KEYBOARD_REGS.DATA)).toBe(0);
    });

    it('should start with modifier 0', () => {
      expect(keyboard.readRegister(KEYBOARD_REGS.MODIFIER)).toBe(0);
    });

    it('should report no key available', () => {
      expect(keyboard.hasKey()).toBe(false);
    });
  });

  describe('keyPress', () => {
    it('should set status bit 0 when key is pressed', () => {
      keyboard.keyPress(65); // 'A'
      expect(keyboard.readRegister(KEYBOARD_REGS.STATUS) & 0x01).toBe(1);
    });

    it('should report key available after press', () => {
      keyboard.keyPress(65);
      expect(keyboard.hasKey()).toBe(true);
    });

    it('should store the ASCII code', () => {
      keyboard.keyPress(65); // 'A'
      expect(keyboard.readRegister(KEYBOARD_REGS.DATA)).toBe(65);
    });

    it('should buffer multiple keypresses', () => {
      keyboard.keyPress(65); // 'A'
      keyboard.keyPress(66); // 'B'
      keyboard.keyPress(67); // 'C'

      expect(keyboard.readRegister(KEYBOARD_REGS.DATA)).toBe(65);
      expect(keyboard.readRegister(KEYBOARD_REGS.DATA)).toBe(66);
      expect(keyboard.readRegister(KEYBOARD_REGS.DATA)).toBe(67);
    });

    it('should clear status when all keys consumed', () => {
      keyboard.keyPress(65);
      keyboard.readRegister(KEYBOARD_REGS.DATA); // consume key
      expect(keyboard.readRegister(KEYBOARD_REGS.STATUS) & 0x01).toBe(0);
    });

    it('should handle buffer overflow gracefully', () => {
      // Fill buffer beyond capacity (default 16)
      for (let i = 0; i < 20; i++) {
        keyboard.keyPress(65 + i);
      }
      // Should still be able to read the first 16 keys
      for (let i = 0; i < 16; i++) {
        expect(keyboard.hasKey()).toBe(true);
        keyboard.readRegister(KEYBOARD_REGS.DATA);
      }
      // Buffer should be empty after 16 reads
      expect(keyboard.hasKey()).toBe(false);
    });
  });

  describe('modifier keys', () => {
    it('should track shift state', () => {
      keyboard.setModifier(KeyModifier.SHIFT, true);
      expect(keyboard.readRegister(KEYBOARD_REGS.MODIFIER) & KeyModifier.SHIFT).toBe(KeyModifier.SHIFT);
    });

    it('should track ctrl state', () => {
      keyboard.setModifier(KeyModifier.CTRL, true);
      expect(keyboard.readRegister(KEYBOARD_REGS.MODIFIER) & KeyModifier.CTRL).toBe(KeyModifier.CTRL);
    });

    it('should track alt state', () => {
      keyboard.setModifier(KeyModifier.ALT, true);
      expect(keyboard.readRegister(KEYBOARD_REGS.MODIFIER) & KeyModifier.ALT).toBe(KeyModifier.ALT);
    });

    it('should track multiple modifiers', () => {
      keyboard.setModifier(KeyModifier.SHIFT, true);
      keyboard.setModifier(KeyModifier.CTRL, true);
      const mod = keyboard.readRegister(KEYBOARD_REGS.MODIFIER);
      expect(mod & KeyModifier.SHIFT).toBe(KeyModifier.SHIFT);
      expect(mod & KeyModifier.CTRL).toBe(KeyModifier.CTRL);
    });

    it('should clear modifier state', () => {
      keyboard.setModifier(KeyModifier.SHIFT, true);
      keyboard.setModifier(KeyModifier.SHIFT, false);
      expect(keyboard.readRegister(KEYBOARD_REGS.MODIFIER) & KeyModifier.SHIFT).toBe(0);
    });
  });

  describe('special keys', () => {
    it('should handle Enter key', () => {
      keyboard.keyPress(0x0D); // Enter
      expect(keyboard.readRegister(KEYBOARD_REGS.DATA)).toBe(0x0D);
    });

    it('should handle Backspace key', () => {
      keyboard.keyPress(0x08); // Backspace
      expect(keyboard.readRegister(KEYBOARD_REGS.DATA)).toBe(0x08);
    });

    it('should handle Escape key', () => {
      keyboard.keyPress(0x1B); // Escape
      expect(keyboard.readRegister(KEYBOARD_REGS.DATA)).toBe(0x1B);
    });

    it('should handle Tab key', () => {
      keyboard.keyPress(0x09); // Tab
      expect(keyboard.readRegister(KEYBOARD_REGS.DATA)).toBe(0x09);
    });
  });

  describe('isInRange', () => {
    it('should return true for STATUS register', () => {
      expect(keyboard.isInRange(KEYBOARD_BASE + KEYBOARD_REGS.STATUS)).toBe(true);
    });

    it('should return true for DATA register', () => {
      expect(keyboard.isInRange(KEYBOARD_BASE + KEYBOARD_REGS.DATA)).toBe(true);
    });

    it('should return true for MODIFIER register', () => {
      expect(keyboard.isInRange(KEYBOARD_BASE + KEYBOARD_REGS.MODIFIER)).toBe(true);
    });

    it('should return false for address before range', () => {
      expect(keyboard.isInRange(KEYBOARD_BASE - 1)).toBe(false);
    });

    it('should return false for address after range', () => {
      expect(keyboard.isInRange(KEYBOARD_BASE + 0x100)).toBe(false);
    });
  });

  describe('MMIO word access', () => {
    it('should read STATUS via mmioRead', () => {
      keyboard.keyPress(65);
      expect(keyboard.mmioRead(KEYBOARD_BASE + KEYBOARD_REGS.STATUS) & 0x01).toBe(1);
    });

    it('should read DATA via mmioRead and consume key', () => {
      keyboard.keyPress(65);
      expect(keyboard.mmioRead(KEYBOARD_BASE + KEYBOARD_REGS.DATA)).toBe(65);
      expect(keyboard.hasKey()).toBe(false);
    });

    it('should read MODIFIER via mmioRead', () => {
      keyboard.setModifier(KeyModifier.SHIFT, true);
      expect(keyboard.mmioRead(KEYBOARD_BASE + KEYBOARD_REGS.MODIFIER)).toBe(KeyModifier.SHIFT);
    });

    it('should ignore writes to STATUS (read-only)', () => {
      keyboard.mmioWrite(KEYBOARD_BASE + KEYBOARD_REGS.STATUS, 0xFF);
      expect(keyboard.readRegister(KEYBOARD_REGS.STATUS)).toBe(0);
    });

    it('should ignore writes to DATA (read-only)', () => {
      keyboard.mmioWrite(KEYBOARD_BASE + KEYBOARD_REGS.DATA, 0xFF);
      expect(keyboard.readRegister(KEYBOARD_REGS.DATA)).toBe(0);
    });

    it('should ignore writes to MODIFIER (read-only, set via setModifier)', () => {
      keyboard.mmioWrite(KEYBOARD_BASE + KEYBOARD_REGS.MODIFIER, 0xFF);
      expect(keyboard.readRegister(KEYBOARD_REGS.MODIFIER)).toBe(0);
    });
  });

  describe('MMIO byte access', () => {
    it('should read STATUS byte', () => {
      keyboard.keyPress(65);
      expect(keyboard.mmioReadByte(KEYBOARD_BASE + KEYBOARD_REGS.STATUS)).toBe(1);
    });

    it('should read DATA byte and consume key', () => {
      keyboard.keyPress(65);
      expect(keyboard.mmioReadByte(KEYBOARD_BASE + KEYBOARD_REGS.DATA)).toBe(65);
      expect(keyboard.hasKey()).toBe(false);
    });

    it('should read MODIFIER byte', () => {
      keyboard.setModifier(KeyModifier.SHIFT, true);
      expect(keyboard.mmioReadByte(KEYBOARD_BASE + KEYBOARD_REGS.MODIFIER)).toBe(KeyModifier.SHIFT);
    });
  });

  describe('MMIO halfword access', () => {
    it('should read STATUS halfword', () => {
      keyboard.keyPress(65);
      expect(keyboard.mmioReadHalfword(KEYBOARD_BASE + KEYBOARD_REGS.STATUS) & 0x01).toBe(1);
    });

    it('should read DATA halfword and consume key', () => {
      keyboard.keyPress(65);
      expect(keyboard.mmioReadHalfword(KEYBOARD_BASE + KEYBOARD_REGS.DATA)).toBe(65);
      expect(keyboard.hasKey()).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear key buffer', () => {
      keyboard.keyPress(65);
      keyboard.keyPress(66);
      keyboard.clear();
      expect(keyboard.hasKey()).toBe(false);
    });

    it('should reset status to 0', () => {
      keyboard.keyPress(65);
      keyboard.clear();
      expect(keyboard.readRegister(KEYBOARD_REGS.STATUS)).toBe(0);
    });
  });
});
