// Tests for the Fast Simulator

import { describe, it, expect } from 'vitest';
import { FastSimulator } from '../src/simulator/fast-simulator.js';

describe('Fast Simulator', () => {
  it('should simulate a simple adder', () => {
    const source = `
module add8(a:8, b:8) -> result:8:
  @behavior {
    result = a + b
  }
`;
    const sim = FastSimulator.fromSource(source, 'add8');
    expect(sim.getMode()).toBe('fast');

    sim.setInput('a', 5);
    sim.setInput('b', 3);
    sim.step();

    expect(sim.getOutput('result')).toBe(8);
  });

  it('should handle overflow correctly', () => {
    const source = `
module add8(a:8, b:8) -> result:8:
  @behavior {
    result = a + b
  }
`;
    const sim = FastSimulator.fromSource(source, 'add8');

    sim.setInput('a', 250);
    sim.setInput('b', 10);
    sim.step();

    // 250 + 10 = 260, masked to 8 bits = 4
    expect(sim.getOutput('result')).toBe(4);
  });

  it('should simulate an ALU', () => {
    const source = `
module alu(a:8, b:8, op:3) -> result:8:
  @behavior {
    if op == 0 {
      result = a + b
    } else if op == 1 {
      result = a - b
    } else if op == 2 {
      result = a & b
    } else if op == 3 {
      result = a | b
    } else {
      result = a ^ b
    }
  }
`;
    const sim = FastSimulator.fromSource(source, 'alu');

    // ADD
    sim.setInput('a', 10);
    sim.setInput('b', 5);
    sim.setInput('op', 0);
    sim.step();
    expect(sim.getOutput('result')).toBe(15);

    // SUB
    sim.setInput('op', 1);
    sim.step();
    expect(sim.getOutput('result')).toBe(5);

    // AND
    sim.setInput('a', 0xFF);
    sim.setInput('b', 0x0F);
    sim.setInput('op', 2);
    sim.step();
    expect(sim.getOutput('result')).toBe(0x0F);

    // OR
    sim.setInput('a', 0xF0);
    sim.setInput('b', 0x0F);
    sim.setInput('op', 3);
    sim.step();
    expect(sim.getOutput('result')).toBe(0xFF);

    // XOR
    sim.setInput('op', 4);
    sim.step();
    expect(sim.getOutput('result')).toBe(0xFF);
  });

  it('should run multiple cycles', () => {
    const source = `
module counter(inc) -> count:8:
  @behavior {
    count = inc
  }
`;
    const sim = FastSimulator.fromSource(source, 'counter');

    sim.setInput('inc', 1);
    sim.run(5);

    // Each step just sets count = inc, so final value is 1
    expect(sim.getOutput('count')).toBe(1);
  });

  it('should detect when behavioral is available', () => {
    const source = `
module add(a:8, b:8) -> result:8:
  @behavior {
    result = a + b
  }

module sub(a:8, b:8) -> result:8:
  n = nand(a, b)
  result = nand(n, n)
`;
    const sim = FastSimulator.fromSource(source, 'add');

    expect(sim.hasBehavioral('add')).toBe(true);
    expect(sim.hasBehavioral('sub')).toBe(false);
  });

  it('should handle multiple outputs', () => {
    const source = `
module split(val:8) -> high:4, low:4:
  @behavior {
    high = val[7:4]
    low = val[3:0]
  }
`;
    const sim = FastSimulator.fromSource(source, 'split');

    sim.setInput('val', 0xAB);
    sim.step();

    expect(sim.getOutput('high')).toBe(0x0A);
    expect(sim.getOutput('low')).toBe(0x0B);
  });

  it('should handle getOutputs and getInputs', () => {
    const source = `
module alu(a:8, b:8, op:3) -> result:8, zero:
  @behavior {
    result = a + b
    zero = result == 0
  }
`;
    const sim = FastSimulator.fromSource(source, 'alu');

    sim.setInput('a', 5);
    sim.setInput('b', 3);
    sim.setInput('op', 0);
    sim.step();

    const inputs = sim.getInputs();
    expect(inputs.a).toBe(5);
    expect(inputs.b).toBe(3);
    expect(inputs.op).toBe(0);

    const outputs = sim.getOutputs();
    expect(outputs.result).toBe(8);
    expect(outputs.zero).toBe(0);
  });

  describe('Performance', () => {
    it('should run fast with behavioral simulation', () => {
      const source = `
module alu8(a:8, b:8, op:3) -> result:8:
  @behavior {
    if op == 0 {
      result = a + b
    } else if op == 1 {
      result = a - b
    } else if op == 2 {
      result = a & b
    } else if op == 3 {
      result = a | b
    } else if op == 4 {
      result = a ^ b
    } else if op == 5 {
      result = a << 1
    } else if op == 6 {
      result = a >> 1
    } else {
      result = ~a
    }
  }
`;
      const sim = FastSimulator.fromSource(source, 'alu8');

      sim.setInput('a', 42);
      sim.setInput('b', 17);
      sim.setInput('op', 0);

      const cycles = 100000;
      const start = performance.now();

      for (let i = 0; i < cycles; i++) {
        sim.setInput('op', i & 7);
        sim.step();
      }

      const elapsed = performance.now() - start;
      const cyclesPerSecond = (cycles / elapsed) * 1000;

      console.log(`Fast simulator: ${Math.round(cyclesPerSecond / 1000000 * 10) / 10}M cycles/sec`);

      // Should be at least 1M cycles/sec (usually much faster)
      expect(cyclesPerSecond).toBeGreaterThan(1000000);
    });
  });
});
