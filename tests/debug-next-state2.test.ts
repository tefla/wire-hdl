import { describe, it, expect } from 'vitest';
import { parse, elaborate, levelize } from '../src/index.js';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Debug next_state2', () => {
  it('should find gates producing next_state2', () => {
    const files = ['gates.wire', 'arithmetic.wire', 'registers.wire', 'mux8.wire', 'mux4way8.wire', 'mux8way8.wire', 'mux16.wire', 'adder16.wire', 'inc16.wire', 'register16.wire', 'decoder.wire', 'alu8.wire', 'pc.wire', 'cpu_minimal.wire'];
    const source = files.map(f => readFileSync(join('./wire', f), 'utf-8')).join('\n');
    const program = parse(source);
    const netlist = elaborate(program, 'cpu_minimal');
    const levelized = levelize(netlist);

    // Find next_state2
    const next2Id = levelized.signalMap.get('next_state2');
    console.log(`next_state2 ID: ${next2Id}`);

    // Find gates producing next_state2
    const gatesForNext2 = levelized.nandGates.filter(g => g.out === next2Id);
    console.log(`Gates producing next_state2: ${gatesForNext2.length}`);

    for (const gate of gatesForNext2) {
      const in1Name = levelized.signals[gate.in1]?.name || `?${gate.in1}`;
      const in2Name = levelized.signals[gate.in2]?.name || `?${gate.in2}`;
      console.log(`  Gate ${gate.id} (level ${gate.level}): NAND(${in1Name}, ${in2Name}) -> next_state2`);
    }

    // Check if next_state2 exists in signal map before elaboration
    console.log(`\nnext_state2 in signalMap: ${levelized.signalMap.has('next_state2')}`);

    // What is at ID next2Id?
    if (next2Id !== undefined) {
      const sig = levelized.signals[next2Id];
      console.log(`Signal at ID ${next2Id}: ${sig?.name}, isPrimary: ${sig?.isPrimaryInput}, isDffOutput: ${sig?.isDffOutput}`);
    }

    // Also check for any signal containing "next_state" and "or_"
    const orSignals = [...levelized.signalMap.entries()].filter(([name]) => name.includes('or_') && name.includes('na'));
    console.log(`\nSignals with 'or_' and 'na' (first 10):`);
    for (const [name, id] of orSignals.slice(0, 10)) {
      console.log(`  ${name}: ${id}`);
    }

    expect(gatesForNext2.length).toBeGreaterThan(0);
  });
});
