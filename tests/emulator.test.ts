// Tests for behavioral CPU emulator

import { describe, it, expect } from 'vitest';
import { CPU6502 } from '../src/emulator/cpu.js';

describe('CPU6502', () => {
  describe('basic instructions', () => {
    it('should execute LDA immediate', () => {
      const cpu = new CPU6502();
      // LDA #$42, HLT
      cpu.memory[0x8000] = 0xa9; // LDA #
      cpu.memory[0x8001] = 0x42;
      cpu.memory[0x8002] = 0x02; // HLT
      // Reset vector points to $8000
      cpu.memory[0xfffc] = 0x00;
      cpu.memory[0xfffd] = 0x80;
      cpu.reset();

      cpu.run(2); // LDA + HLT

      expect(cpu.a).toBe(0x42);
      expect(cpu.halted).toBe(true);
      expect(cpu.zero).toBe(false);
      expect(cpu.negative).toBe(false);
    });

    it('should set zero flag on LDA #0', () => {
      const cpu = new CPU6502();
      cpu.memory[0x8000] = 0xa9; // LDA #
      cpu.memory[0x8001] = 0x00;
      cpu.memory[0x8002] = 0x02; // HLT
      cpu.memory[0xfffc] = 0x00;
      cpu.memory[0xfffd] = 0x80;
      cpu.reset();

      cpu.run(2);

      expect(cpu.a).toBe(0);
      expect(cpu.zero).toBe(true);
      expect(cpu.negative).toBe(false);
    });

    it('should set negative flag on LDA #$80', () => {
      const cpu = new CPU6502();
      cpu.memory[0x8000] = 0xa9; // LDA #
      cpu.memory[0x8001] = 0x80;
      cpu.memory[0x8002] = 0x02; // HLT
      cpu.memory[0xfffc] = 0x00;
      cpu.memory[0xfffd] = 0x80;
      cpu.reset();

      cpu.run(2);

      expect(cpu.a).toBe(0x80);
      expect(cpu.zero).toBe(false);
      expect(cpu.negative).toBe(true);
    });

    it('should execute STA absolute', () => {
      const cpu = new CPU6502();
      // LDA #$FF, STA $1234, HLT
      cpu.memory[0x8000] = 0xa9; // LDA #
      cpu.memory[0x8001] = 0xff;
      cpu.memory[0x8002] = 0x8d; // STA abs
      cpu.memory[0x8003] = 0x34; // lo
      cpu.memory[0x8004] = 0x12; // hi
      cpu.memory[0x8005] = 0x02; // HLT
      cpu.memory[0xfffc] = 0x00;
      cpu.memory[0xfffd] = 0x80;
      cpu.reset();

      cpu.run(3);

      expect(cpu.memory[0x1234]).toBe(0xff);
    });
  });

  describe('arithmetic', () => {
    it('should add with ADC', () => {
      const cpu = new CPU6502();
      // CLC, LDA #$10, ADC #$20, HLT
      cpu.memory[0x8000] = 0x18; // CLC
      cpu.memory[0x8001] = 0xa9; // LDA #
      cpu.memory[0x8002] = 0x10;
      cpu.memory[0x8003] = 0x69; // ADC #
      cpu.memory[0x8004] = 0x20;
      cpu.memory[0x8005] = 0x02; // HLT
      cpu.memory[0xfffc] = 0x00;
      cpu.memory[0xfffd] = 0x80;
      cpu.reset();

      cpu.run(4);

      expect(cpu.a).toBe(0x30);
      expect(cpu.carry).toBe(false);
    });

    it('should set carry on overflow', () => {
      const cpu = new CPU6502();
      // CLC, LDA #$FF, ADC #$02, HLT
      cpu.memory[0x8000] = 0x18; // CLC
      cpu.memory[0x8001] = 0xa9; // LDA #
      cpu.memory[0x8002] = 0xff;
      cpu.memory[0x8003] = 0x69; // ADC #
      cpu.memory[0x8004] = 0x02;
      cpu.memory[0x8005] = 0x02; // HLT
      cpu.memory[0xfffc] = 0x00;
      cpu.memory[0xfffd] = 0x80;
      cpu.reset();

      cpu.run(4);

      expect(cpu.a).toBe(0x01); // $FF + $02 = $101, wraps to $01
      expect(cpu.carry).toBe(true);
    });

    it('should subtract with SBC', () => {
      const cpu = new CPU6502();
      // SEC, LDA #$30, SBC #$10, HLT
      cpu.memory[0x8000] = 0x38; // SEC
      cpu.memory[0x8001] = 0xa9; // LDA #
      cpu.memory[0x8002] = 0x30;
      cpu.memory[0x8003] = 0xe9; // SBC #
      cpu.memory[0x8004] = 0x10;
      cpu.memory[0x8005] = 0x02; // HLT
      cpu.memory[0xfffc] = 0x00;
      cpu.memory[0xfffd] = 0x80;
      cpu.reset();

      cpu.run(4);

      expect(cpu.a).toBe(0x20);
      expect(cpu.carry).toBe(true); // No borrow
    });
  });

  describe('branches', () => {
    it('should take BEQ when zero flag set', () => {
      const cpu = new CPU6502();
      // LDA #$00, BEQ +2, LDA #$FF, HLT
      cpu.memory[0x8000] = 0xa9; // LDA #
      cpu.memory[0x8001] = 0x00;
      cpu.memory[0x8002] = 0xf0; // BEQ
      cpu.memory[0x8003] = 0x02; // offset +2
      cpu.memory[0x8004] = 0xa9; // LDA # (skipped)
      cpu.memory[0x8005] = 0xff;
      cpu.memory[0x8006] = 0x02; // HLT
      cpu.memory[0xfffc] = 0x00;
      cpu.memory[0xfffd] = 0x80;
      cpu.reset();

      cpu.run(3); // LDA, BEQ (taken), HLT

      expect(cpu.a).toBe(0x00); // Should NOT be $FF
      expect(cpu.halted).toBe(true);
    });

    it('should not take BNE when zero flag set', () => {
      const cpu = new CPU6502();
      // LDA #$00, BNE +2, LDA #$FF, HLT
      cpu.memory[0x8000] = 0xa9; // LDA #
      cpu.memory[0x8001] = 0x00;
      cpu.memory[0x8002] = 0xd0; // BNE
      cpu.memory[0x8003] = 0x02; // offset +2
      cpu.memory[0x8004] = 0xa9; // LDA #
      cpu.memory[0x8005] = 0xff;
      cpu.memory[0x8006] = 0x02; // HLT
      cpu.memory[0xfffc] = 0x00;
      cpu.memory[0xfffd] = 0x80;
      cpu.reset();

      cpu.run(4); // LDA, BNE (not taken), LDA, HLT

      expect(cpu.a).toBe(0xff); // Should be $FF
    });
  });

  describe('stack operations', () => {
    it('should push and pull A', () => {
      const cpu = new CPU6502();
      // LDA #$42, PHA, LDA #$00, PLA, HLT
      cpu.memory[0x8000] = 0xa9; // LDA #
      cpu.memory[0x8001] = 0x42;
      cpu.memory[0x8002] = 0x48; // PHA
      cpu.memory[0x8003] = 0xa9; // LDA #
      cpu.memory[0x8004] = 0x00;
      cpu.memory[0x8005] = 0x68; // PLA
      cpu.memory[0x8006] = 0x02; // HLT
      cpu.memory[0xfffc] = 0x00;
      cpu.memory[0xfffd] = 0x80;
      cpu.reset();

      cpu.run(5);

      expect(cpu.a).toBe(0x42);
    });

    it('should execute JSR and RTS', () => {
      const cpu = new CPU6502();
      // JSR $8010, HLT, ... at $8010: LDA #$99, RTS
      cpu.memory[0x8000] = 0x20; // JSR
      cpu.memory[0x8001] = 0x10;
      cpu.memory[0x8002] = 0x80;
      cpu.memory[0x8003] = 0x02; // HLT (return here)

      cpu.memory[0x8010] = 0xa9; // LDA #
      cpu.memory[0x8011] = 0x99;
      cpu.memory[0x8012] = 0x60; // RTS

      cpu.memory[0xfffc] = 0x00;
      cpu.memory[0xfffd] = 0x80;
      cpu.reset();

      cpu.run(4); // JSR, LDA, RTS, HLT

      expect(cpu.a).toBe(0x99);
      expect(cpu.halted).toBe(true);
      expect(cpu.pc).toBe(0x8004); // After HLT
    });
  });

  describe('register operations', () => {
    it('should increment and decrement X', () => {
      const cpu = new CPU6502();
      // LDX #$10, INX, INX, DEX, HLT
      cpu.memory[0x8000] = 0xa2; // LDX #
      cpu.memory[0x8001] = 0x10;
      cpu.memory[0x8002] = 0xe8; // INX
      cpu.memory[0x8003] = 0xe8; // INX
      cpu.memory[0x8004] = 0xca; // DEX
      cpu.memory[0x8005] = 0x02; // HLT
      cpu.memory[0xfffc] = 0x00;
      cpu.memory[0xfffd] = 0x80;
      cpu.reset();

      cpu.run(5);

      expect(cpu.x).toBe(0x11); // $10 + 2 - 1 = $11
    });

    it('should transfer between registers', () => {
      const cpu = new CPU6502();
      // LDA #$42, TAX, TAY, HLT
      cpu.memory[0x8000] = 0xa9; // LDA #
      cpu.memory[0x8001] = 0x42;
      cpu.memory[0x8002] = 0xaa; // TAX
      cpu.memory[0x8003] = 0xa8; // TAY
      cpu.memory[0x8004] = 0x02; // HLT
      cpu.memory[0xfffc] = 0x00;
      cpu.memory[0xfffd] = 0x80;
      cpu.reset();

      cpu.run(4);

      expect(cpu.a).toBe(0x42);
      expect(cpu.x).toBe(0x42);
      expect(cpu.y).toBe(0x42);
    });
  });

  describe('assembled programs', () => {
    it('should run HELLO_WORLD equivalent', () => {
      const cpu = new CPU6502();
      // LDA #$48, STA $0200, LDA #$49, STA $0201, HLT
      cpu.memory[0x8000] = 0xa9; cpu.memory[0x8001] = 0x48; // LDA #$48
      cpu.memory[0x8002] = 0x8d; cpu.memory[0x8003] = 0x00; cpu.memory[0x8004] = 0x02; // STA $0200
      cpu.memory[0x8005] = 0xa9; cpu.memory[0x8006] = 0x49; // LDA #$49
      cpu.memory[0x8007] = 0x8d; cpu.memory[0x8008] = 0x01; cpu.memory[0x8009] = 0x02; // STA $0201
      cpu.memory[0x800a] = 0x02; // HLT
      cpu.memory[0xfffc] = 0x00;
      cpu.memory[0xfffd] = 0x80;
      cpu.reset();

      cpu.runUntilHalt();

      expect(cpu.memory[0x0200]).toBe(0x48);
      expect(cpu.memory[0x0201]).toBe(0x49);
    });

    it('should run counter loop', () => {
      const cpu = new CPU6502();
      // LDA #$00, loop: STA $0200, CLC, ADC #$01, CMP #$05, BNE loop, HLT
      let addr = 0x8000;
      cpu.memory[addr++] = 0xa9; cpu.memory[addr++] = 0x00; // LDA #$00
      const loopAddr = addr;
      cpu.memory[addr++] = 0x8d; cpu.memory[addr++] = 0x00; cpu.memory[addr++] = 0x02; // STA $0200
      cpu.memory[addr++] = 0x18; // CLC
      cpu.memory[addr++] = 0x69; cpu.memory[addr++] = 0x01; // ADC #$01
      cpu.memory[addr++] = 0xc9; cpu.memory[addr++] = 0x05; // CMP #$05
      const bneAddr = addr;
      cpu.memory[addr++] = 0xd0; // BNE
      cpu.memory[addr++] = (loopAddr - addr) & 0xff; // relative offset (negative)
      cpu.memory[addr++] = 0x02; // HLT
      cpu.memory[0xfffc] = 0x00;
      cpu.memory[0xfffd] = 0x80;
      cpu.reset();

      cpu.runUntilHalt();

      expect(cpu.a).toBe(0x05);
      expect(cpu.memory[0x0200]).toBe(0x04); // Last stored value before exit
    });
  });

  describe('benchmark', () => {
    it('should run fast loop benchmark', () => {
      const cpu = new CPU6502();
      // LDX #$00, loop: DEX, BNE loop, HLT
      cpu.memory[0x8000] = 0xa2; cpu.memory[0x8001] = 0x00; // LDX #$00
      cpu.memory[0x8002] = 0xca; // DEX
      cpu.memory[0x8003] = 0xd0; cpu.memory[0x8004] = 0xfd; // BNE -3 (back to DEX)
      cpu.memory[0x8005] = 0x02; // HLT
      cpu.memory[0xfffc] = 0x00;
      cpu.memory[0xfffd] = 0x80;
      cpu.reset();

      const start = performance.now();
      cpu.runUntilHalt();
      const elapsed = performance.now() - start;

      // LDX starts X at 0, DEX wraps to $FF, then loops 255 more times to reach 0
      // DEX + BNE runs 256 times
      const instructions = 1 + 256 * 2 + 1; // LDX + 256*(DEX+BNE) + HLT = 514

      console.log(`\nBehavioral CPU benchmark:`);
      console.log(`  Instructions: ${instructions}`);
      console.log(`  Time: ${elapsed.toFixed(3)}ms`);
      console.log(`  Speed: ${(instructions / elapsed * 1000).toFixed(0)} inst/sec`);

      expect(cpu.x).toBe(0x00);
      expect(cpu.halted).toBe(true);
    });

    it('should benchmark 1M instructions', () => {
      const cpu = new CPU6502();
      // Nested loop:
      // LDY #100
      // outer: LDX #$00
      // inner: DEX, BNE inner
      // DEY, BNE outer
      // HLT
      cpu.memory[0x8000] = 0xa0; cpu.memory[0x8001] = 0x64; // LDY #100
      cpu.memory[0x8002] = 0xa2; cpu.memory[0x8003] = 0x00; // outer: LDX #$00
      cpu.memory[0x8004] = 0xca;                           // inner: DEX
      cpu.memory[0x8005] = 0xd0; cpu.memory[0x8006] = 0xfd; // BNE inner (-3)
      cpu.memory[0x8007] = 0x88;                           // DEY
      cpu.memory[0x8008] = 0xd0; cpu.memory[0x8009] = 0xf8; // BNE outer (-8, back to $8002)
      cpu.memory[0x800a] = 0x02;                           // HLT
      cpu.memory[0xfffc] = 0x00;
      cpu.memory[0xfffd] = 0x80;
      cpu.reset();

      const start = performance.now();
      cpu.runUntilHalt();
      const elapsed = performance.now() - start;

      // Calculate actual instruction count
      // Inner loop: 256 * (DEX + BNE) = 512 per outer iteration
      // Outer loop: LDX + 512 + DEY + BNE = 515 per iteration
      // Total: LDY + 100 * 515 + HLT = 1 + 51500 + 1 = 51502
      const instructions = 1 + 100 * (1 + 256 * 2 + 2) + 1;

      const ips = (instructions / elapsed) * 1000;

      console.log(`\n51K instruction benchmark:`);
      console.log(`  Instructions: ${instructions.toLocaleString()}`);
      console.log(`  Cycles: ${cpu.cycles.toLocaleString()}`);
      console.log(`  Time: ${elapsed.toFixed(2)}ms`);
      console.log(`  Speed: ${(ips / 1e6).toFixed(1)}M inst/sec`);

      expect(cpu.y).toBe(0x00);
      expect(cpu.halted).toBe(true);
      // Should complete in reasonable time
      expect(elapsed).toBeLessThan(1000); // Less than 1 second
    });

    it('should benchmark 10M cycles', () => {
      const cpu = new CPU6502();
      // Very tight loop for maximum speed test
      // loop: INX, JMP loop (no conditional, just pure speed)
      // We'll run for a fixed number of instructions
      cpu.memory[0x8000] = 0xe8;                           // INX
      cpu.memory[0x8001] = 0x4c; cpu.memory[0x8002] = 0x00; cpu.memory[0x8003] = 0x80; // JMP $8000
      cpu.memory[0xfffc] = 0x00;
      cpu.memory[0xfffd] = 0x80;
      cpu.reset();

      const iterations = 5_000_000;
      const start = performance.now();
      cpu.run(iterations);
      const elapsed = performance.now() - start;

      const ips = (iterations / elapsed) * 1000;

      console.log(`\n10M cycle benchmark:`);
      console.log(`  Instructions: ${iterations.toLocaleString()}`);
      console.log(`  Cycles: ${cpu.cycles.toLocaleString()}`);
      console.log(`  Time: ${elapsed.toFixed(0)}ms`);
      console.log(`  Speed: ${(ips / 1e6).toFixed(1)}M inst/sec`);

      expect(cpu.halted).toBe(false); // Still running
    });
  });
});
