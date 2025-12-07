// Tests for the ALU8 behavioral simulation

import { describe, it, expect } from 'vitest';
import { FastSimulator } from '../src/simulator/fast-simulator.js';
import * as fs from 'fs';
import * as path from 'path';

describe('ALU8 Behavioral Simulation', () => {
  const wireDir = path.join(process.cwd(), 'wire');
  const alu8Source = fs.readFileSync(path.join(wireDir, 'alu8.wire'), 'utf-8');

  it('should have behavioral implementation', () => {
    const sim = FastSimulator.fromSource(alu8Source, 'alu8');
    expect(sim.hasBehavioral('alu8')).toBe(true);
    expect(sim.getMode()).toBe('fast');
  });

  it('should perform ADD correctly', () => {
    const sim = FastSimulator.fromSource(alu8Source, 'alu8');

    sim.setInput('a', 5);
    sim.setInput('b', 3);
    sim.setInput('op', 0); // ADD
    sim.setInput('cin', 0);
    sim.step();

    expect(sim.getOutput('result')).toBe(8);
    expect(sim.getOutput('z')).toBe(0); // Not zero
    expect(sim.getOutput('n')).toBe(0); // Not negative
  });

  it('should perform ADD with carry', () => {
    const sim = FastSimulator.fromSource(alu8Source, 'alu8');

    sim.setInput('a', 5);
    sim.setInput('b', 3);
    sim.setInput('op', 0); // ADD
    sim.setInput('cin', 1);
    sim.step();

    expect(sim.getOutput('result')).toBe(9); // 5 + 3 + 1
  });

  it('should perform SUB correctly', () => {
    const sim = FastSimulator.fromSource(alu8Source, 'alu8');

    sim.setInput('a', 10);
    sim.setInput('b', 3);
    sim.setInput('op', 1); // SUB
    sim.setInput('cin', 1); // cin=1 means no borrow
    sim.step();

    expect(sim.getOutput('result')).toBe(7);
  });

  it('should perform AND correctly', () => {
    const sim = FastSimulator.fromSource(alu8Source, 'alu8');

    sim.setInput('a', 0xFF);
    sim.setInput('b', 0x0F);
    sim.setInput('op', 2); // AND
    sim.setInput('cin', 0);
    sim.step();

    expect(sim.getOutput('result')).toBe(0x0F);
  });

  it('should perform OR correctly', () => {
    const sim = FastSimulator.fromSource(alu8Source, 'alu8');

    sim.setInput('a', 0xF0);
    sim.setInput('b', 0x0F);
    sim.setInput('op', 3); // OR
    sim.setInput('cin', 0);
    sim.step();

    expect(sim.getOutput('result')).toBe(0xFF);
  });

  it('should perform XOR correctly', () => {
    const sim = FastSimulator.fromSource(alu8Source, 'alu8');

    sim.setInput('a', 0xFF);
    sim.setInput('b', 0x0F);
    sim.setInput('op', 4); // XOR
    sim.setInput('cin', 0);
    sim.step();

    expect(sim.getOutput('result')).toBe(0xF0);
  });

  it('should set zero flag correctly', () => {
    const sim = FastSimulator.fromSource(alu8Source, 'alu8');

    sim.setInput('a', 5);
    sim.setInput('b', 5);
    sim.setInput('op', 1); // SUB
    sim.setInput('cin', 1);
    sim.step();

    expect(sim.getOutput('result')).toBe(0);
    expect(sim.getOutput('z')).toBe(1); // Zero flag set
  });

  it('should set negative flag correctly', () => {
    const sim = FastSimulator.fromSource(alu8Source, 'alu8');

    sim.setInput('a', 0x80); // -128 in two's complement
    sim.setInput('b', 0);
    sim.setInput('op', 0); // ADD
    sim.setInput('cin', 0);
    sim.step();

    expect(sim.getOutput('result')).toBe(0x80);
    expect(sim.getOutput('n')).toBe(1); // Negative flag set
  });

  it('should handle overflow correctly', () => {
    const sim = FastSimulator.fromSource(alu8Source, 'alu8');

    // 250 + 10 = 260 -> wraps to 4
    sim.setInput('a', 250);
    sim.setInput('b', 10);
    sim.setInput('op', 0); // ADD
    sim.setInput('cin', 0);
    sim.step();

    expect(sim.getOutput('result')).toBe(4);
    expect(sim.getOutput('cout')).toBe(1); // Carry out
  });

  describe('Performance', () => {
    it('should run ALU8 at MHz speed', () => {
      const sim = FastSimulator.fromSource(alu8Source, 'alu8');

      const cycles = 100000;
      const start = performance.now();

      for (let i = 0; i < cycles; i++) {
        sim.setInput('a', i & 0xFF);
        sim.setInput('b', (i >> 8) & 0xFF);
        sim.setInput('op', i & 7);
        sim.step();
      }

      const elapsed = performance.now() - start;
      const cyclesPerSecond = (cycles / elapsed) * 1000;

      console.log(`ALU8 behavioral: ${Math.round(cyclesPerSecond / 1000000 * 10) / 10}M cycles/sec`);

      // Should be at least 1M cycles/sec
      expect(cyclesPerSecond).toBeGreaterThan(1000000);
    });
  });
});
