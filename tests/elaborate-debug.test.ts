import { describe, it, expect } from 'vitest';
import { parse, elaborate } from '../src/index.js';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Elaborate debug', () => {
  it('should show gates producing next_state2', () => {
    const files = ['gates.wire', 'arithmetic.wire', 'registers.wire', 'mux8.wire', 'mux4way8.wire', 'mux8way8.wire', 'mux16.wire', 'adder16.wire', 'inc16.wire', 'register16.wire', 'decoder.wire', 'alu8.wire', 'pc.wire', 'cpu_minimal.wire'];
    const source = files.map(f => readFileSync(join('./wire', f), 'utf-8')).join('\n');
    const program = parse(source);
    const netlist = elaborate(program, 'cpu_minimal');

    const next_state2Id = netlist.signalMap.get('next_state2');
    console.log(`next_state2 signal ID: ${next_state2Id}`);

    // Find gates that output to next_state2
    const gatesOutputtingToNextState2 = netlist.nandGates.filter(g => g.out === next_state2Id);
    console.log(`Gates outputting to next_state2: ${gatesOutputtingToNextState2.length}`);

    for (const gate of gatesOutputtingToNextState2) {
      const in1Name = netlist.signals[gate.in1]?.name || `unknown_${gate.in1}`;
      const in2Name = netlist.signals[gate.in2]?.name || `unknown_${gate.in2}`;
      console.log(`  Gate ${gate.id}: NAND(${in1Name}, ${in2Name}) -> next_state2`);
    }

    // Look for gates with "or_" in the output name around next_state2
    console.log('\nGates with "or_" prefix around next_state2:');
    for (const gate of netlist.nandGates) {
      const outName = netlist.signals[gate.out]?.name;
      if (outName?.includes('next_state')) {
        const in1Name = netlist.signals[gate.in1]?.name || `sig_${gate.in1}`;
        const in2Name = netlist.signals[gate.in2]?.name || `sig_${gate.in2}`;
        console.log(`  Gate ${gate.id}: NAND(${in1Name}, ${in2Name}) -> ${outName}`);
      }
    }
  });

  it('should show DFFs with next_state as D input', () => {
    const files = ['gates.wire', 'arithmetic.wire', 'registers.wire', 'mux8.wire', 'mux4way8.wire', 'mux8way8.wire', 'mux16.wire', 'adder16.wire', 'inc16.wire', 'register16.wire', 'decoder.wire', 'alu8.wire', 'pc.wire', 'cpu_minimal.wire'];
    const source = files.map(f => readFileSync(join('./wire', f), 'utf-8')).join('\n');
    const program = parse(source);
    const netlist = elaborate(program, 'cpu_minimal');

    // Find state DFFs
    console.log('State DFFs:');
    for (const dff of netlist.dffs) {
      const dName = netlist.signals[dff.d]?.name || `sig_${dff.d}`;
      const qName = netlist.signals[dff.q]?.name || `sig_${dff.q}`;
      if (qName?.startsWith('state') || dName?.includes('next_state')) {
        console.log(`  DFF ${dff.id}: D=${dName}(${dff.d}) -> Q=${qName}(${dff.q})`);
      }
    }

    // Check if next_state2 has any gates driving it
    const next_state2Id = netlist.signalMap.get('next_state2');
    const gatesCount = netlist.nandGates.filter(g => g.out === next_state2Id).length;
    console.log(`\nnext_state2 (${next_state2Id}) has ${gatesCount} gates driving it`);

    // If no gates, the signal is just dangling!
    expect(gatesCount).toBeGreaterThan(0);
  });
});
