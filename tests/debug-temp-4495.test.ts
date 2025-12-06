import { describe, it, expect } from 'vitest';
import { parse, elaborate, levelize } from '../src/index.js';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Debug _temp_4495', () => {
  it('should trace back _temp_4495', () => {
    const files = ['gates.wire', 'arithmetic.wire', 'registers.wire', 'mux8.wire', 'mux4way8.wire', 'mux8way8.wire', 'mux16.wire', 'adder16.wire', 'inc16.wire', 'register16.wire', 'decoder.wire', 'alu8.wire', 'pc.wire', 'cpu_minimal.wire'];
    const source = files.map(f => readFileSync(join('./wire', f), 'utf-8')).join('\n');
    const program = parse(source);
    const netlist = elaborate(program, 'cpu_minimal');
    const levelized = levelize(netlist);

    // Trace _temp_4495
    const sigId = levelized.signalMap.get('_temp_4495');
    console.log(`_temp_4495 ID: ${sigId}`);

    const gates = levelized.nandGates.filter(g => g.out === sigId);
    console.log(`Gates producing _temp_4495: ${gates.length}`);

    for (const gate of gates) {
      const in1Name = levelized.signals[gate.in1]?.name || `?${gate.in1}`;
      const in2Name = levelized.signals[gate.in2]?.name || `?${gate.in2}`;
      console.log(`  Gate ${gate.id} (level ${gate.level}): NAND(${in1Name}(${gate.in1}), ${in2Name}(${gate.in2}))`);

      // Check if inputs have gates
      const in1Gates = levelized.nandGates.filter(g => g.out === gate.in1);
      const in2Gates = levelized.nandGates.filter(g => g.out === gate.in2);
      console.log(`    in1 ${in1Name} has ${in1Gates.length} gates producing it`);
      console.log(`    in2 ${in2Name} has ${in2Gates.length} gates producing it`);

      // Check if input is primary or DFF
      const in1Sig = levelized.signals[gate.in1];
      const in2Sig = levelized.signals[gate.in2];
      if (in1Sig) console.log(`    in1 isPrimary=${in1Sig.isPrimaryInput}, isDff=${in1Sig.isDffOutput}`);
      if (in2Sig) console.log(`    in2 isPrimary=${in2Sig.isPrimaryInput}, isDff=${in2Sig.isDffOutput}`);
    }

    // If no gates, it's an orphan
    if (gates.length === 0) {
      console.log('\n_temp_4495 has no producers - ORPHAN!');
    }

    // Also check set_bit_2 since that's what the or(and(set_bit_2, not(reset)), reset) uses
    const setBit2Id = levelized.signalMap.get('set_bit_2');
    console.log(`\nset_bit_2 ID: ${setBit2Id}`);
    const setBit2Gates = levelized.nandGates.filter(g => g.out === setBit2Id);
    console.log(`Gates producing set_bit_2: ${setBit2Gates.length}`);
    for (const gate of setBit2Gates) {
      const in1Name = levelized.signals[gate.in1]?.name || `?${gate.in1}`;
      const in2Name = levelized.signals[gate.in2]?.name || `?${gate.in2}`;
      console.log(`  Gate ${gate.id} (level ${gate.level}): NAND(${in1Name}(${gate.in1}), ${in2Name}(${gate.in2}))`);
    }
  });
});
