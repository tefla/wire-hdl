import { describe, it, expect, beforeEach } from 'vitest';
import { RiscVCpu } from '../src/emulator/cpu.js';
import { KEYBOARD_BASE, KEYBOARD_REGS, KeyModifier } from '../src/emulator/keyboard.js';

/**
 * Integration tests for CPU to Keyboard Controller communication
 *
 * Tests that the CPU can read keyboard status and data via memory-mapped I/O
 */
describe('CPU-Keyboard Integration', () => {
  let cpu: RiscVCpu;

  beforeEach(() => {
    cpu = new RiscVCpu({ memorySize: 0x10000 });
  });

  describe('keyboard controller availability', () => {
    it('should have keyboard controller instance', () => {
      expect(cpu.keyboard).toBeDefined();
    });
  });

  describe('read keyboard status via LW', () => {
    it('should read 0 when no key pressed', () => {
      // lui t0, 0x30000  ; t0 = 0x30000000 (keyboard base)
      // lw t1, 0(t0)     ; t1 = STATUS register
      const code = [
        0x300002B7, // lui t0, 0x30000
        0x0002A303, // lw t1, 0(t0)
      ];
      loadAndRun(cpu, code, 2);

      expect(cpu.getRegister(6)).toBe(0); // t1 = 0 (no key)
    });

    it('should read 1 when key is available', () => {
      cpu.keyboard.keyPress(65); // 'A'

      const code = [
        0x300002B7, // lui t0, 0x30000
        0x0002A303, // lw t1, 0(t0)
      ];
      loadAndRun(cpu, code, 2);

      expect(cpu.getRegister(6)).toBe(1); // t1 = 1 (key available)
    });
  });

  describe('read key data via LW', () => {
    it('should read ASCII code of pressed key', () => {
      cpu.keyboard.keyPress(65); // 'A'

      // lui t0, 0x30000  ; t0 = 0x30000000
      // lw t1, 4(t0)     ; t1 = DATA register (offset 4)
      const code = [
        0x300002B7, // lui t0, 0x30000
        0x0042A303, // lw t1, 4(t0)
      ];
      loadAndRun(cpu, code, 2);

      expect(cpu.getRegister(6)).toBe(65); // t1 = 65 ('A')
    });

    it('should consume key when read', () => {
      cpu.keyboard.keyPress(65); // 'A'
      cpu.keyboard.keyPress(66); // 'B'

      const code = [
        0x300002B7, // lui t0, 0x30000
        0x0042A303, // lw t1, 4(t0)  ; read first key
        0x0042A383, // lw t2, 4(t0)  ; read second key
      ];
      loadAndRun(cpu, code, 3);

      expect(cpu.getRegister(6)).toBe(65); // t1 = 'A'
      expect(cpu.getRegister(7)).toBe(66); // t2 = 'B'
    });

    it('should return 0 when no key available', () => {
      const code = [
        0x300002B7, // lui t0, 0x30000
        0x0042A303, // lw t1, 4(t0)
      ];
      loadAndRun(cpu, code, 2);

      expect(cpu.getRegister(6)).toBe(0); // t1 = 0 (no key)
    });
  });

  describe('read modifier keys via LW', () => {
    it('should read shift state', () => {
      cpu.keyboard.setModifier(KeyModifier.SHIFT, true);

      const code = [
        0x300002B7, // lui t0, 0x30000
        0x0082A303, // lw t1, 8(t0)  ; MODIFIER register (offset 8)
      ];
      loadAndRun(cpu, code, 2);

      expect(cpu.getRegister(6) & KeyModifier.SHIFT).toBe(KeyModifier.SHIFT);
    });

    it('should read ctrl+alt state', () => {
      cpu.keyboard.setModifier(KeyModifier.CTRL, true);
      cpu.keyboard.setModifier(KeyModifier.ALT, true);

      const code = [
        0x300002B7, // lui t0, 0x30000
        0x0082A303, // lw t1, 8(t0)
      ];
      loadAndRun(cpu, code, 2);

      const mod = cpu.getRegister(6);
      expect(mod & KeyModifier.CTRL).toBe(KeyModifier.CTRL);
      expect(mod & KeyModifier.ALT).toBe(KeyModifier.ALT);
    });
  });

  describe('read keyboard via LB (byte access)', () => {
    it('should read status byte', () => {
      cpu.keyboard.keyPress(65);

      // lui t0, 0x30000
      // lb t1, 0(t0)   ; load byte from STATUS
      const code = [
        0x300002B7, // lui t0, 0x30000
        0x00028303, // lb t1, 0(t0)
      ];
      loadAndRun(cpu, code, 2);

      expect(cpu.getRegister(6)).toBe(1);
    });

    it('should read data byte and consume key', () => {
      cpu.keyboard.keyPress(72); // 'H'

      const code = [
        0x300002B7, // lui t0, 0x30000
        0x00428303, // lb t1, 4(t0)
      ];
      loadAndRun(cpu, code, 2);

      expect(cpu.getRegister(6)).toBe(72);
      expect(cpu.keyboard.hasKey()).toBe(false);
    });
  });

  describe('read keyboard via LBU (unsigned byte access)', () => {
    it('should read status unsigned byte', () => {
      cpu.keyboard.keyPress(65);

      const code = [
        0x300002B7, // lui t0, 0x30000
        0x0002C303, // lbu t1, 0(t0)
      ];
      loadAndRun(cpu, code, 2);

      expect(cpu.getRegister(6)).toBe(1);
    });
  });

  describe('read keyboard via LH (halfword access)', () => {
    it('should read status halfword', () => {
      cpu.keyboard.keyPress(65);

      const code = [
        0x300002B7, // lui t0, 0x30000
        0x00029303, // lh t1, 0(t0)
      ];
      loadAndRun(cpu, code, 2);

      expect(cpu.getRegister(6)).toBe(1);
    });
  });

  describe('keyboard polling loop', () => {
    it('should detect key press in loop', () => {
      // Simulate a program that polls for a key:
      // loop:
      //   lw t1, STATUS
      //   beq t1, zero, loop
      //   lw t2, DATA
      //
      // For test, we press key after CPU construction
      cpu.keyboard.keyPress(88); // 'X'

      const code = [
        0x300002B7, // lui t0, 0x30000
        0x0002A303, // lw t1, 0(t0)     ; read STATUS
        0x0042A383, // lw t2, 4(t0)     ; read DATA (key value)
      ];
      loadAndRun(cpu, code, 3);

      expect(cpu.getRegister(6)).toBe(1);  // status was 1
      expect(cpu.getRegister(7)).toBe(88); // data = 'X'
    });
  });

  describe('multiple key buffer', () => {
    it('should read multiple buffered keys', () => {
      // Type "HI"
      cpu.keyboard.keyPress(72); // 'H'
      cpu.keyboard.keyPress(73); // 'I'

      const code = [
        0x300002B7, // lui t0, 0x30000
        0x0042A303, // lw t1, 4(t0)     ; read 'H'
        0x0042A383, // lw t2, 4(t0)     ; read 'I'
        0x0042AE03, // lw t3, 4(t0)     ; read nothing (0)
        0x0002A883, // lw s1, 0(t0)     ; read STATUS (should be 0)
      ];
      loadAndRun(cpu, code, 5);

      expect(cpu.getRegister(6)).toBe(72);  // t1 = 'H'
      expect(cpu.getRegister(7)).toBe(73);  // t2 = 'I'
      expect(cpu.getRegister(28)).toBe(0);  // t3 = 0
      expect(cpu.getRegister(9)).toBe(0);   // s1 = 0 (no more keys)
    });
  });

  describe('special keys', () => {
    it('should handle Enter key (0x0D)', () => {
      cpu.keyboard.keyPress(0x0D); // Enter

      const code = [
        0x300002B7, // lui t0, 0x30000
        0x0042A303, // lw t1, 4(t0)
      ];
      loadAndRun(cpu, code, 2);

      expect(cpu.getRegister(6)).toBe(0x0D);
    });

    it('should handle Backspace key (0x08)', () => {
      cpu.keyboard.keyPress(0x08); // Backspace

      const code = [
        0x300002B7, // lui t0, 0x30000
        0x0042A303, // lw t1, 4(t0)
      ];
      loadAndRun(cpu, code, 2);

      expect(cpu.getRegister(6)).toBe(0x08);
    });

    it('should handle Escape key (0x1B)', () => {
      cpu.keyboard.keyPress(0x1B); // Escape

      const code = [
        0x300002B7, // lui t0, 0x30000
        0x0042A303, // lw t1, 4(t0)
      ];
      loadAndRun(cpu, code, 2);

      expect(cpu.getRegister(6)).toBe(0x1B);
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
    cpu.step();
  }
}
