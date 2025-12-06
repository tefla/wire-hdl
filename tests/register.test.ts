import { describe, it, expect } from 'vitest';
import { parse, elaborate, levelize } from '../src/index.js';
import { compileToWasmOptimized } from '../src/compiler/index.js';

describe('Register Test', () => {
  it('should latch value when enable is high', () => {
    const source = `
      ; Basic gates
      module not(a) -> out:
        out = nand(a, a)

      module and(a, b) -> out:
        n = nand(a, b)
        out = nand(n, n)

      module or(a, b) -> out:
        na = nand(a, a)
        nb = nand(b, b)
        out = nand(na, nb)

      module mux(a, b, sel) -> out:
        nsel = not(sel)
        t0 = and(a, nsel)
        t1 = and(b, sel)
        out = or(t0, t1)

      module register(d, en, clk) -> q:
        feedback = mux(q, d, en)
        q = dff(feedback, clk)

      module test_reg(d, en, clk) -> q:
        q = register(d, en, clk)
    `;

    const program = parse(source);
    const netlist = elaborate(program, 'test_reg');
    const levelized = levelize(netlist);
    const circuit = compileToWasmOptimized(levelized);

    const getSignalId = (name: string): number => {
      const id = levelized.signalMap.get(name);
      if (id === undefined) throw new Error(`Signal not found: ${name}`);
      return id;
    };

    const dId = getSignalId('d');
    const enId = getSignalId('en');
    const clkId = getSignalId('clk');
    const qId = getSignalId('q');

    // Initial state: q should be 0
    circuit.setSignal(clkId, 1);
    circuit.setSignal(dId, 0);
    circuit.setSignal(enId, 0);
    circuit.evaluate();
    expect(circuit.getSignal(qId)).toBe(0);

    // Set d=1, en=1, evaluate - q should become 1
    circuit.setSignal(dId, 1);
    circuit.setSignal(enId, 1);
    circuit.evaluate();
    console.log(`After d=1, en=1: q=${circuit.getSignal(qId)}`);
    expect(circuit.getSignal(qId)).toBe(1);

    // Set en=0, d=0, evaluate - q should stay 1 (hold mode)
    circuit.setSignal(enId, 0);
    circuit.setSignal(dId, 0);
    circuit.evaluate();
    console.log(`After en=0, d=0: q=${circuit.getSignal(qId)}`);
    expect(circuit.getSignal(qId)).toBe(1);

    // Set en=1, d=0, evaluate - q should become 0
    circuit.setSignal(enId, 1);
    circuit.evaluate();
    console.log(`After en=1, d=0: q=${circuit.getSignal(qId)}`);
    expect(circuit.getSignal(qId)).toBe(0);
  });
});
