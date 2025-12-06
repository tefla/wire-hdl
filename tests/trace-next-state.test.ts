import { describe, it, expect } from 'vitest';
import { parse, elaborate, levelize, compileToWasmOptimized } from '../src/index.js';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Trace next_state computation', () => {
  it('should show next_state2 = 1 when reset = 1', () => {
    const files = ['gates.wire', 'arithmetic.wire', 'registers.wire', 'mux8.wire', 'mux4way8.wire', 'mux8way8.wire', 'mux16.wire', 'adder16.wire', 'inc16.wire', 'register16.wire', 'decoder.wire', 'alu8.wire', 'pc.wire', 'cpu_minimal.wire'];
    const source = files.map(f => readFileSync(join('./wire', f), 'utf-8')).join('\n');
    const program = parse(source);
    const netlist = elaborate(program, 'cpu_minimal');
    const levelized = levelize(netlist);
    const circuit = compileToWasmOptimized(levelized);

    // Find key signals
    const resetId = levelized.signalMap.get('reset')!;
    const nextState2Id = levelized.signalMap.get('next_state2')!;
    const nextState4Id = levelized.signalMap.get('next_state4')!;
    const state2Id = levelized.signalMap.get('state2')!;
    const state4Id = levelized.signalMap.get('state4')!;

    console.log('Signal IDs:');
    console.log(`  reset: ${resetId}`);
    console.log(`  next_state2: ${nextState2Id}`);
    console.log(`  next_state4: ${nextState4Id}`);

    // Test: Set reset = 1
    console.log('\n=== Test: Set reset=1 ===');
    circuit.setSignal(resetId, 1);
    circuit.evaluate();

    console.log(`  reset: ${circuit.getSignal(resetId)}`);
    console.log(`  next_state2: ${circuit.getSignal(nextState2Id)}`);
    console.log(`  next_state4: ${circuit.getSignal(nextState4Id)}`);
    console.log(`  state2: ${circuit.getSignal(state2Id)}`);
    console.log(`  state4: ${circuit.getSignal(state4Id)}`);

    circuit.evaluate();
    console.log('\nAfter 2nd evaluate:');
    console.log(`  state2: ${circuit.getSignal(state2Id)}`);
    console.log(`  state4: ${circuit.getSignal(state4Id)}`);

    // When reset=1: next_state2 = or(0, 1) = 1
    expect(circuit.getSignal(nextState2Id)).toBe(1);
    expect(circuit.getSignal(nextState4Id)).toBe(1);
  });
});
