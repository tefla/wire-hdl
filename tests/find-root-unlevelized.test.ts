import { describe, it, expect } from 'vitest';
import { parse, elaborate, levelize } from '../src/index.js';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Find root unlevelized', () => {
  it('should find why signals are unlevelized', () => {
    const files = ['gates.wire', 'arithmetic.wire', 'registers.wire', 'mux8.wire', 'mux4way8.wire', 'mux8way8.wire', 'mux16.wire', 'adder16.wire', 'inc16.wire', 'register16.wire', 'decoder.wire', 'alu8.wire', 'pc.wire', 'cpu_minimal.wire'];
    const source = files.map(f => readFileSync(join('./wire', f), 'utf-8')).join('\n');
    const program = parse(source);
    const netlist = elaborate(program, 'cpu_minimal');
    const levelized = levelize(netlist);

    // Build a map: signal ID -> gates that produce it
    const signalProducers = new Map<number, number[]>();
    for (let i = 0; i < levelized.nandGates.length; i++) {
      const gate = levelized.nandGates[i];
      if (!signalProducers.has(gate.out)) {
        signalProducers.set(gate.out, []);
      }
      signalProducers.get(gate.out)!.push(i);
    }

    // Collect level-0 signals
    const level0Signals = new Set<number>();
    for (const sig of levelized.primaryInputs) {
      level0Signals.add(sig);
    }
    for (const dff of levelized.dffs) {
      level0Signals.add(dff.q);
    }
    for (const sig of levelized.signals) {
      if (sig.name.startsWith('const_')) {
        level0Signals.add(sig.id);
      }
    }

    console.log(`Level-0 signals: ${level0Signals.size}`);
    console.log(`Total signals: ${levelized.signals.length}`);

    // Find all unlevelized gates
    const unlevelizedGates = levelized.nandGates.filter(g => g.level === -1);
    console.log(`Unlevelized gates: ${unlevelizedGates.length}`);

    // For each unlevelized gate, check why it's unlevelized
    // (either in1 or in2 has no level)
    const signalsWithNoLevel = new Set<number>();
    for (const gate of unlevelizedGates) {
      const producers1 = signalProducers.get(gate.in1) || [];
      const producers2 = signalProducers.get(gate.in2) || [];

      // If a signal has no producers and is not level-0, it's the root cause
      if (producers1.length === 0 && !level0Signals.has(gate.in1)) {
        signalsWithNoLevel.add(gate.in1);
      }
      if (producers2.length === 0 && !level0Signals.has(gate.in2)) {
        signalsWithNoLevel.add(gate.in2);
      }
    }

    console.log(`\nSignals with no producers and not level-0: ${signalsWithNoLevel.size}`);
    for (const sigId of [...signalsWithNoLevel].slice(0, 10)) {
      const name = levelized.signals[sigId]?.name || `sig_${sigId}`;
      console.log(`  ${name} (${sigId})`);
    }

    // These are the ROOT CAUSE - signals that are referenced but never defined
    expect(signalsWithNoLevel.size).toBe(0);
  });
});
