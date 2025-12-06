import { describe, it, expect } from 'vitest';
import { parse, elaborate, levelize, compileToWasmOptimized } from '../src/index.js';

describe('Simple OR gate', () => {
  it('should compute or(0, 1) = 1', () => {
    const source = `
      module not(a) -> out:
        out = nand(a, a)

      module or(a, b) -> out:
        na = nand(a, a)
        nb = nand(b, b)
        out = nand(na, nb)

      module top(a, b) -> out:
        out = or(a, b)
    `;

    const program = parse(source);
    const netlist = elaborate(program, 'top');
    const levelized = levelize(netlist);
    const circuit = compileToWasmOptimized(levelized);

    const aId = levelized.signalMap.get('a')!;
    const bId = levelized.signalMap.get('b')!;
    const outId = levelized.signalMap.get('out')!;

    // Test or(0, 1) = 1
    circuit.setSignal(aId, 0);
    circuit.setSignal(bId, 1);
    circuit.evaluate();

    console.log(`a=${circuit.getSignal(aId)}, b=${circuit.getSignal(bId)}, out=${circuit.getSignal(outId)}`);
    expect(circuit.getSignal(outId)).toBe(1);
  });

  it('should compute the reset logic correctly', () => {
    // Simplified version of: next_state2 = or(and(set_bit_2, not(reset)), reset)
    // When reset=1, this should equal 1 regardless of set_bit_2
    const source = `
      module not(a) -> out:
        out = nand(a, a)

      module and(a, b) -> out:
        n = nand(a, b)
        out = nand(n, n)

      module or(a, b) -> out:
        na = nand(a, a)
        nb = nand(b, b)
        out = nand(na, nb)

      module top(reset, set_bit) -> out:
        not_reset = not(reset)
        and_result = and(set_bit, not_reset)
        out = or(and_result, reset)
    `;

    const program = parse(source);
    const netlist = elaborate(program, 'top');
    const levelized = levelize(netlist);
    const circuit = compileToWasmOptimized(levelized);

    const resetId = levelized.signalMap.get('reset')!;
    const setBitId = levelized.signalMap.get('set_bit')!;
    const outId = levelized.signalMap.get('out')!;

    // Show all signals
    console.log('All signals:', [...levelized.signalMap.entries()]);
    console.log('Levels:', levelized.levels.length);

    for (let i = 0; i < levelized.levels.length; i++) {
      console.log(`Level ${i}:`, levelized.levels[i].length, 'gates');
    }

    // Test with reset=1, set_bit=0
    circuit.setSignal(resetId, 1);
    circuit.setSignal(setBitId, 0);
    circuit.evaluate();

    console.log(`reset=${circuit.getSignal(resetId)}, set_bit=${circuit.getSignal(setBitId)}, out=${circuit.getSignal(outId)}`);
    expect(circuit.getSignal(outId)).toBe(1);
  });
});
