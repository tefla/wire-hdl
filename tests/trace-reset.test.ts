import { describe, it, expect } from 'vitest';
import { parse, elaborate, levelize, optimize, compileToWasmOptimized, type LevelizedNetlist } from '../src/index.js';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Trace Reset Signals', () => {
  it('should trace reset signal through to next_state', () => {
    const files = ['gates.wire', 'arithmetic.wire', 'registers.wire', 'mux8.wire', 'mux4way8.wire', 'mux8way8.wire', 'mux16.wire', 'adder16.wire', 'inc16.wire', 'register16.wire', 'decoder.wire', 'alu8.wire', 'pc.wire', 'cpu_minimal.wire'];
    const source = files.map(f => readFileSync(join('./wire', f), 'utf-8')).join('\n');
    const program = parse(source);
    const netlist = elaborate(program, 'cpu_minimal');

    // Use unoptimized for clearer signal names
    const levelized = levelize(netlist);
    const circuit = compileToWasmOptimized(levelized);

    // Find key signal IDs
    const signalNames = [
      'reset',
      'clk',
      'state[0]', 'state[1]', 'state[2]', 'state[3]', 'state[4]',
      'state_out[0]', 'state_out[1]', 'state_out[2]', 'state_out[3]', 'state_out[4]',
    ];

    // Try to find next_state signals - they may have been renamed
    const allSignals = [...levelized.signalMap.entries()];
    const nextStateSignals = allSignals.filter(([name]) => name.includes('next_state'));
    console.log('next_state signals found:', nextStateSignals.map(([n, id]) => `${n}=${id}`).join(', '));

    // Also look for set_bit signals
    const setBitSignals = allSignals.filter(([name]) => name.includes('set_bit'));
    console.log('set_bit signals found:', setBitSignals.length);

    const signals: Record<string, number | undefined> = {};
    for (const name of signalNames) {
      signals[name] = levelized.signalMap.get(name);
    }

    console.log('\n=== Signal IDs ===');
    for (const [name, id] of Object.entries(signals)) {
      console.log(`  ${name}: ${id ?? 'NOT FOUND'}`);
    }

    // Find the DFFs for state
    console.log('\n=== State DFFs ===');
    console.log(`Total DFFs: ${levelized.dffs.length}`);

    // Find DFFs by looking at their Q outputs matching state_out signals
    for (let i = 0; i < 5; i++) {
      const qId = signals[`state_out[${i}]`];
      if (qId !== undefined) {
        const dff = levelized.dffs.find(d => d.q === qId);
        if (dff) {
          // Find the name of the D signal
          const dName = allSignals.find(([_, id]) => id === dff.d)?.[0] || `signal_${dff.d}`;
          console.log(`  state_out[${i}] (Q=${qId}): D=${dName} (id=${dff.d})`);
        } else {
          console.log(`  state_out[${i}] (Q=${qId}): NO DFF FOUND`);
        }
      }
    }

    // Now test the circuit
    console.log('\n=== Testing Circuit ===');

    const resetId = signals['reset']!;
    const clkId = signals['clk']!;

    // Helper to read state
    const readState = () => {
      let state = 0;
      for (let i = 0; i < 5; i++) {
        const id = signals[`state_out[${i}]`];
        if (id !== undefined) {
          state |= circuit.getSignal(id) << i;
        }
      }
      return state;
    };

    // Helper to read all key signals
    const readSignals = () => {
      const result: Record<string, number> = {};
      for (const [name, id] of Object.entries(signals)) {
        if (id !== undefined) {
          result[name] = circuit.getSignal(id);
        }
      }
      return result;
    };

    console.log('\nInitial state:', readState());
    console.log('Initial signals:', readSignals());

    // Set reset = 1
    circuit.setSignal(resetId, 1);
    console.log('\nAfter setting reset=1:');
    console.log('  reset signal:', circuit.getSignal(resetId));

    // Run one evaluation cycle
    circuit.evaluate();
    console.log('\nAfter evaluate():');
    console.log('  state:', readState());
    console.log('  signals:', readSignals());

    // Check next_state signals if found
    for (const [name, id] of nextStateSignals) {
      console.log(`  ${name}: ${circuit.getSignal(id)}`);
    }

    // Run a few more cycles
    for (let i = 0; i < 5; i++) {
      circuit.evaluate();
      console.log(`\nCycle ${i + 2}: state=${readState()}`);
    }
  });

  it('should check if state DFFs exist and are wired correctly', () => {
    const files = ['gates.wire', 'arithmetic.wire', 'registers.wire', 'mux8.wire', 'mux4way8.wire', 'mux8way8.wire', 'mux16.wire', 'adder16.wire', 'inc16.wire', 'register16.wire', 'decoder.wire', 'alu8.wire', 'pc.wire', 'cpu_minimal.wire'];
    const source = files.map(f => readFileSync(join('./wire', f), 'utf-8')).join('\n');
    const program = parse(source);
    const netlist = elaborate(program, 'cpu_minimal');
    const levelized = levelize(netlist);

    // List all DFFs with their D and Q signal names
    console.log('\n=== All DFFs ===');
    const allSignals = [...levelized.signalMap.entries()];

    for (const dff of levelized.dffs) {
      const dName = allSignals.find(([_, id]) => id === dff.d)?.[0] || `signal_${dff.d}`;
      const qName = allSignals.find(([_, id]) => id === dff.q)?.[0] || `signal_${dff.q}`;
      console.log(`  DFF: ${dName} -> ${qName}`);
    }

    // Check if state_out signals are DFF outputs
    console.log('\n=== State Output Analysis ===');
    for (let i = 0; i < 5; i++) {
      const stateOutId = levelized.signalMap.get(`state_out[${i}]`);
      const stateId = levelized.signalMap.get(`state[${i}]`);
      console.log(`state[${i}]=${stateId}, state_out[${i}]=${stateOutId}`);

      // Check if state_out is a DFF Q output
      const isDffOutput = levelized.dffs.some(d => d.q === stateOutId);
      console.log(`  state_out[${i}] is DFF output: ${isDffOutput}`);
    }
  });
});
