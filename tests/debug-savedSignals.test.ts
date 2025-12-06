import { describe, it, expect } from 'vitest';
import { parse, elaborate } from '../src/index.js';

describe('Debug savedSignals', () => {
  it('should trace signal creation for alu.result', () => {
    // Simplified test case
    const source = `
      module inner(a:8) -> (result:8, flag):
        result = a
        flag = a[0]

      module outer(x:8) -> out:8:
        inner_result = inner(x)
        out = inner_result.result
    `;

    const program = parse(source);
    const netlist = elaborate(program, 'outer');

    // What signals exist?
    console.log('All signals:');
    for (const [name, id] of netlist.signalMap) {
      console.log(`  ${name}: ${id}`);
    }

    // Check inner_result.result[0]
    const resultId = netlist.signalMap.get('inner_result.result[0]');
    console.log(`\ninner_result.result[0] ID: ${resultId}`);

    // Check what gates produce it
    const gates = netlist.nandGates.filter(g => g.out === resultId);
    console.log(`Gates producing it: ${gates.length}`);

    // Print all gates to see what they're wiring
    console.log('\nAll gates:');
    for (const gate of netlist.nandGates.slice(0, 20)) {
      const in1Name = netlist.signals[gate.in1]?.name || `?${gate.in1}`;
      const in2Name = netlist.signals[gate.in2]?.name || `?${gate.in2}`;
      const outName = netlist.signals[gate.out]?.name || `?${gate.out}`;
      console.log(`  NAND(${in1Name}, ${in2Name}) -> ${outName}`);
    }
  });
});
