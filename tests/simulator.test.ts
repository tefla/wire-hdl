import { describe, it, expect } from 'vitest';
import { Simulator, parse, elaborate, levelize } from '../src/index.js';

describe('Parser', () => {
  it('should parse a simple NOT gate', () => {
    const source = `
      module not(a) -> out:
        out = nand(a, a)
    `;
    const program = parse(source);
    expect(program.modules).toHaveLength(1);
    expect(program.modules[0].name).toBe('not');
    expect(program.modules[0].params).toHaveLength(1);
    expect(program.modules[0].outputs).toHaveLength(1);
  });

  it('should parse multi-bit signals', () => {
    const source = `
      module and4(a:4, b:4) -> out:4:
        out0 = nand(a, b)
    `;
    const program = parse(source);
    expect(program.modules[0].params[0].width).toBe(4);
    expect(program.modules[0].outputs[0].width).toBe(4);
  });

  it('should parse multiple outputs', () => {
    const source = `
      module half_adder(a, b) -> (sum, carry):
        sum = nand(a, b)
        carry = nand(a, a)
    `;
    const program = parse(source);
    expect(program.modules[0].outputs).toHaveLength(2);
    expect(program.modules[0].outputs[0].name).toBe('sum');
    expect(program.modules[0].outputs[1].name).toBe('carry');
  });
});

describe('Elaborator', () => {
  it('should elaborate a NOT gate to a single NAND', () => {
    const source = `
      module not(a) -> out:
        out = nand(a, a)
    `;
    const program = parse(source);
    const netlist = elaborate(program, 'not');

    expect(netlist.nandGates).toHaveLength(1);
    expect(netlist.primaryInputs).toHaveLength(1);
    expect(netlist.primaryOutputs).toHaveLength(1);
  });

  it('should elaborate an AND gate to 2 NANDs', () => {
    const source = `
      module not(a) -> out:
        out = nand(a, a)

      module and(a, b) -> out:
        n = nand(a, b)
        out = nand(n, n)
    `;
    const program = parse(source);
    const netlist = elaborate(program, 'and');

    expect(netlist.nandGates).toHaveLength(2);
    expect(netlist.primaryInputs).toHaveLength(2);
    expect(netlist.primaryOutputs).toHaveLength(1);
  });
});

describe('Levelizer', () => {
  it('should levelize a simple gate chain', () => {
    const source = `
      module chain(a, b) -> out:
        n1 = nand(a, b)
        n2 = nand(n1, n1)
        out = nand(n2, n2)
    `;
    const program = parse(source);
    const netlist = elaborate(program, 'chain');
    const levelized = levelize(netlist);

    expect(levelized.maxLevel).toBe(3);
    expect(levelized.levels[1]).toHaveLength(1);
    expect(levelized.levels[2]).toHaveLength(1);
    expect(levelized.levels[3]).toHaveLength(1);
  });
});

describe('Simulator', () => {
  it('should simulate a NOT gate', () => {
    const source = `
      module not(a) -> out:
        out = nand(a, a)
    `;
    const sim = Simulator.fromSource(source, 'not');

    // NOT(0) = 1
    sim.setInput('a', 0);
    sim.step();
    expect(sim.getOutput('out')).toBe(1);

    // NOT(1) = 0
    sim.setInput('a', 1);
    sim.step();
    expect(sim.getOutput('out')).toBe(0);
  });

  it('should simulate an AND gate', () => {
    const source = `
      module and(a, b) -> out:
        n = nand(a, b)
        out = nand(n, n)
    `;
    const sim = Simulator.fromSource(source, 'and');

    // AND(0, 0) = 0
    sim.setInput('a', 0);
    sim.setInput('b', 0);
    sim.step();
    expect(sim.getOutput('out')).toBe(0);

    // AND(0, 1) = 0
    sim.setInput('a', 0);
    sim.setInput('b', 1);
    sim.step();
    expect(sim.getOutput('out')).toBe(0);

    // AND(1, 0) = 0
    sim.setInput('a', 1);
    sim.setInput('b', 0);
    sim.step();
    expect(sim.getOutput('out')).toBe(0);

    // AND(1, 1) = 1
    sim.setInput('a', 1);
    sim.setInput('b', 1);
    sim.step();
    expect(sim.getOutput('out')).toBe(1);
  });

  it('should simulate an OR gate', () => {
    const source = `
      module or(a, b) -> out:
        na = nand(a, a)
        nb = nand(b, b)
        out = nand(na, nb)
    `;
    const sim = Simulator.fromSource(source, 'or');

    // OR(0, 0) = 0
    sim.setInput('a', 0);
    sim.setInput('b', 0);
    sim.step();
    expect(sim.getOutput('out')).toBe(0);

    // OR(0, 1) = 1
    sim.setInput('a', 0);
    sim.setInput('b', 1);
    sim.step();
    expect(sim.getOutput('out')).toBe(1);

    // OR(1, 0) = 1
    sim.setInput('a', 1);
    sim.setInput('b', 0);
    sim.step();
    expect(sim.getOutput('out')).toBe(1);

    // OR(1, 1) = 1
    sim.setInput('a', 1);
    sim.setInput('b', 1);
    sim.step();
    expect(sim.getOutput('out')).toBe(1);
  });

  it('should simulate a XOR gate', () => {
    const source = `
      module xor(a, b) -> out:
        n1 = nand(a, b)
        n2 = nand(a, n1)
        n3 = nand(b, n1)
        out = nand(n2, n3)
    `;
    const sim = Simulator.fromSource(source, 'xor');

    // XOR(0, 0) = 0
    sim.setInput('a', 0);
    sim.setInput('b', 0);
    sim.step();
    expect(sim.getOutput('out')).toBe(0);

    // XOR(0, 1) = 1
    sim.setInput('a', 0);
    sim.setInput('b', 1);
    sim.step();
    expect(sim.getOutput('out')).toBe(1);

    // XOR(1, 0) = 1
    sim.setInput('a', 1);
    sim.setInput('b', 0);
    sim.step();
    expect(sim.getOutput('out')).toBe(1);

    // XOR(1, 1) = 0
    sim.setInput('a', 1);
    sim.setInput('b', 1);
    sim.step();
    expect(sim.getOutput('out')).toBe(0);
  });

  it('should simulate a DFF', () => {
    const source = `
      module dff_test(d, clk) -> q:
        q = dff(d, clk)
    `;
    const sim = Simulator.fromSource(source, 'dff_test');

    // Initial state should be 0
    sim.setInput('d', 0);
    sim.setInput('clk', 1);
    expect(sim.getOutput('q')).toBe(0);

    // Set D=1, clock, Q should become 1
    sim.setInput('d', 1);
    sim.step();
    expect(sim.getOutput('q')).toBe(1);

    // Set D=0, clock, Q should become 0
    sim.setInput('d', 0);
    sim.step();
    expect(sim.getOutput('q')).toBe(0);
  });

  it('should simulate a 1-bit counter', () => {
    const source = `
      module xor(a, b) -> out:
        n1 = nand(a, b)
        n2 = nand(a, n1)
        n3 = nand(b, n1)
        out = nand(n2, n3)

      module counter1(en, clk) -> q:
        next = xor(q, en)
        q = dff(next, clk)
    `;
    const sim = Simulator.fromSource(source, 'counter1');

    sim.setInput('en', 1);
    sim.setInput('clk', 1);

    // Initial: q = 0
    expect(sim.getOutput('q')).toBe(0);

    // Cycle 1: q = 1
    sim.step();
    expect(sim.getOutput('q')).toBe(1);

    // Cycle 2: q = 0
    sim.step();
    expect(sim.getOutput('q')).toBe(0);

    // Cycle 3: q = 1
    sim.step();
    expect(sim.getOutput('q')).toBe(1);
  });
});

describe('Performance', () => {
  it('should run many cycles quickly', () => {
    const source = `
      module xor(a, b) -> out:
        n1 = nand(a, b)
        n2 = nand(a, n1)
        n3 = nand(b, n1)
        out = nand(n2, n3)

      module counter1(en, clk) -> q:
        next = xor(q, en)
        q = dff(next, clk)
    `;
    const sim = Simulator.fromSource(source, 'counter1');
    sim.setInput('en', 1);
    sim.setInput('clk', 1);

    const cycles = 100000;
    const start = performance.now();
    sim.run(cycles);
    const elapsed = performance.now() - start;

    const cyclesPerSecond = (cycles / elapsed) * 1000;
    console.log(`Performance: ${cyclesPerSecond.toFixed(0)} cycles/second`);

    // Should achieve at least 100k cycles/second
    expect(cyclesPerSecond).toBeGreaterThan(100000);
  });
});
