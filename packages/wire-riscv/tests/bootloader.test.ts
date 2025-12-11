import { describe, it, expect, beforeEach } from 'vitest';
import { RiscVCpu } from '../src/emulator/cpu.js';
import { Bootloader, BOOT_CONFIG } from '../src/emulator/bootloader.js';

/**
 * Tests for the RISC-V Bootloader
 */
describe('Bootloader', () => {
  let cpu: RiscVCpu;
  let bootloader: Bootloader;

  beforeEach(() => {
    cpu = new RiscVCpu({ memorySize: 0x10000 }); // 64KB
    bootloader = new Bootloader();
  });

  describe('bootloader generation', () => {
    it('should generate valid machine code', () => {
      const code = bootloader.generate();
      expect(code).toBeInstanceOf(Uint8Array);
      expect(code.length).toBeGreaterThan(0);
    });

    it('should fit within bootloader area (4KB)', () => {
      const code = bootloader.generate();
      expect(code.length).toBeLessThanOrEqual(BOOT_CONFIG.BOOTLOADER_SIZE);
    });
  });

  describe('stack initialization', () => {
    it('should initialize stack pointer to top of memory', () => {
      const code = bootloader.generate();
      cpu.loadProgram(code, 0);

      // Run a few instructions (stack init should be first)
      for (let i = 0; i < 3; i++) {
        cpu.step();
      }

      // sp (x2) should be set to stack top
      expect(cpu.getReg(2)).toBe(BOOT_CONFIG.STACK_TOP);
    });
  });

  describe('boot message', () => {
    it('should print boot message', () => {
      const code = bootloader.generate();
      cpu.loadProgram(code, 0);

      // Run until boot message is printed (before disk load)
      cpu.run(1000);

      // Check console output contains boot message
      expect(cpu.consoleOutput).toContain('Boot');
    });
  });

  describe('program loading', () => {
    it('should load program from disk to memory', () => {
      // Write a simple program to disk sector 1
      const testProgram = new Uint8Array(512);
      testProgram[0] = 0x93; // addi x1, x0, 42
      testProgram[1] = 0x00;
      testProgram[2] = 0xa0;
      testProgram[3] = 0x02;
      cpu.storage.getHdd().write(1, testProgram);

      const code = bootloader.generate();
      cpu.loadProgram(code, 0);

      // Run bootloader
      cpu.run(5000);

      // Program should be loaded at PROGRAM_BASE
      expect(cpu.readByte(BOOT_CONFIG.PROGRAM_BASE)).toBe(0x93);
    });

    it('should jump to loaded program', () => {
      // Write a program that sets x1 = 99 and halts
      const testProgram = new Uint8Array(512);
      // addi x1, x0, 99 (0x06300093)
      testProgram[0] = 0x93;
      testProgram[1] = 0x00;
      testProgram[2] = 0x30;
      testProgram[3] = 0x06;
      // ecall (halt)
      testProgram[4] = 0x73;
      testProgram[5] = 0x00;
      testProgram[6] = 0x00;
      testProgram[7] = 0x00;
      cpu.storage.getHdd().write(1, testProgram);

      const code = bootloader.generate();
      cpu.loadProgram(code, 0);

      // Run until program halts
      cpu.run(10000);

      // x1 should be 99 (set by loaded program)
      expect(cpu.getReg(1)).toBe(99);
      expect(cpu.halted).toBe(true);
    });
  });

  describe('boot configuration', () => {
    it('should have correct memory layout constants', () => {
      expect(BOOT_CONFIG.BOOTLOADER_BASE).toBe(0x0000);
      expect(BOOT_CONFIG.BOOTLOADER_SIZE).toBe(0x1000);
      expect(BOOT_CONFIG.PROGRAM_BASE).toBe(0x1000);
      expect(BOOT_CONFIG.STACK_TOP).toBe(0xFFFF);
    });

    it('should have correct disk layout constants', () => {
      expect(BOOT_CONFIG.BOOT_SECTOR).toBe(0);
      expect(BOOT_CONFIG.PROGRAM_SECTOR).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should handle empty disk gracefully', () => {
      // Don't write anything to disk
      const code = bootloader.generate();
      cpu.loadProgram(code, 0);

      // Run bootloader - should not crash
      cpu.run(5000);

      // Should still have printed boot message
      expect(cpu.consoleOutput).toContain('Boot');
    });
  });

  describe('integration', () => {
    it('should complete boot in reasonable cycles', () => {
      // Write minimal program
      const testProgram = new Uint8Array(512);
      testProgram[0] = 0x73; // ecall (halt)
      cpu.storage.getHdd().write(1, testProgram);

      const code = bootloader.generate();
      cpu.loadProgram(code, 0);

      const startCycles = cpu.cycles;
      cpu.run(100000);
      const bootCycles = cpu.cycles - startCycles;

      // Boot should complete in reasonable number of cycles
      expect(bootCycles).toBeLessThan(50000);
      expect(cpu.halted).toBe(true);
    });

    it('should pass control to multi-sector program', () => {
      // Write program spanning 2 sectors
      const sector1 = new Uint8Array(512);
      const sector2 = new Uint8Array(512);

      // First sector: addi x1, x0, 10; jal x0, 512 (jump to next sector)
      sector1[0] = 0x93; sector1[1] = 0x00; sector1[2] = 0xa0; sector1[3] = 0x00; // addi x1, x0, 10
      // JAL to offset 512 (0x200) - encoded as J-type
      // jal x0, 508 (jump forward 508 bytes to reach sector 2 start at offset 512)
      sector1[4] = 0x6f; sector1[5] = 0x00; sector1[6] = 0xc0; sector1[7] = 0x1f; // jal x0, 508

      // Second sector at offset 512: addi x1, x1, 5; ecall
      sector2[0] = 0x93; sector2[1] = 0x80; sector2[2] = 0x50; sector2[3] = 0x00; // addi x1, x1, 5
      sector2[4] = 0x73; sector2[5] = 0x00; sector2[6] = 0x00; sector2[7] = 0x00; // ecall

      cpu.storage.getHdd().write(1, sector1);
      cpu.storage.getHdd().write(2, sector2);

      // Configure bootloader to load 2 sectors
      bootloader.setSectorCount(2);
      const code = bootloader.generate();
      cpu.loadProgram(code, 0);

      cpu.run(20000);

      // x1 should be 15 (10 + 5) if both sectors executed
      expect(cpu.getReg(1)).toBe(15);
    });
  });
});
