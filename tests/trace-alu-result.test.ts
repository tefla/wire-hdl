import { describe, it, expect } from 'vitest';
import { parse, elaborate } from '../src/index.js';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Trace alu.result', () => {
  it('should find what produces alu.result signals', () => {
    const files = ['gates.wire', 'arithmetic.wire', 'registers.wire', 'mux8.wire', 'mux4way8.wire', 'mux8way8.wire', 'mux16.wire', 'adder16.wire', 'inc16.wire', 'register16.wire', 'decoder.wire', 'alu8.wire', 'pc.wire', 'cpu_minimal.wire'];
    const source = files.map(f => readFileSync(join('./wire', f), 'utf-8')).join('\n');
    const program = parse(source);
    const netlist = elaborate(program, 'cpu_minimal');

    // Find alu.result[0]
    const aluResult0Id = netlist.signalMap.get('alu.result[0]');
    console.log(`alu.result[0] ID: ${aluResult0Id}`);

    // Find gates producing alu.result[0]
    const gatesForAluResult0 = netlist.nandGates.filter(g => g.out === aluResult0Id);
    console.log(`Gates producing alu.result[0]: ${gatesForAluResult0.length}`);

    // Look for any signal with 'alu' in the name
    const aluSignals = [...netlist.signalMap.entries()].filter(([name]) => name.startsWith('alu'));
    console.log(`\nSignals starting with 'alu' (first 20):`);
    for (const [name, id] of aluSignals.slice(0, 20)) {
      const gatesCount = netlist.nandGates.filter(g => g.out === id).length;
      console.log(`  ${name} (${id}): ${gatesCount} gates producing it`);
    }

    // Look for alu8_ signals (inlined module)
    const alu8Signals = [...netlist.signalMap.entries()].filter(([name]) => name.includes('alu8_'));
    console.log(`\nSignals containing 'alu8_' (first 20):`);
    for (const [name, id] of alu8Signals.slice(0, 20)) {
      const gatesCount = netlist.nandGates.filter(g => g.out === id).length;
      console.log(`  ${name} (${id}): ${gatesCount} gates producing it`);
    }

    // Also check for result in alu8
    const resultSignals = [...netlist.signalMap.entries()].filter(([name]) => name.includes('alu8_') && name.includes('result'));
    console.log(`\nSignals with 'alu8_' AND 'result':`);
    for (const [name, id] of resultSignals.slice(0, 20)) {
      console.log(`  ${name} (${id})`);
    }

    expect(gatesForAluResult0.length).toBeGreaterThan(0);
  });
});
