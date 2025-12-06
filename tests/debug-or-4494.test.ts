import { describe, it, expect } from 'vitest';
import { parse, elaborate, levelize } from '../src/index.js';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Debug or_4494', () => {
  it('should find what produces or_4494_na and or_4494_nb', () => {
    const files = ['gates.wire', 'arithmetic.wire', 'registers.wire', 'mux8.wire', 'mux4way8.wire', 'mux8way8.wire', 'mux16.wire', 'adder16.wire', 'inc16.wire', 'register16.wire', 'decoder.wire', 'alu8.wire', 'pc.wire', 'cpu_minimal.wire'];
    const source = files.map(f => readFileSync(join('./wire', f), 'utf-8')).join('\n');
    const program = parse(source);
    const netlist = elaborate(program, 'cpu_minimal');
    const levelized = levelize(netlist);

    // Find or_4494_na and or_4494_nb
    const naId = levelized.signalMap.get('or_4494_na');
    const nbId = levelized.signalMap.get('or_4494_nb');
    console.log(`or_4494_na ID: ${naId}`);
    console.log(`or_4494_nb ID: ${nbId}`);

    // Find gates producing these signals
    const gatesForNa = levelized.nandGates.filter(g => g.out === naId);
    const gatesForNb = levelized.nandGates.filter(g => g.out === nbId);

    console.log(`\nGates producing or_4494_na: ${gatesForNa.length}`);
    for (const gate of gatesForNa) {
      const in1Name = levelized.signals[gate.in1]?.name || `?${gate.in1}`;
      const in2Name = levelized.signals[gate.in2]?.name || `?${gate.in2}`;
      console.log(`  Gate ${gate.id} (level ${gate.level}): NAND(${in1Name}, ${in2Name})`);
    }

    console.log(`\nGates producing or_4494_nb: ${gatesForNb.length}`);
    for (const gate of gatesForNb) {
      const in1Name = levelized.signals[gate.in1]?.name || `?${gate.in1}`;
      const in2Name = levelized.signals[gate.in2]?.name || `?${gate.in2}`;
      console.log(`  Gate ${gate.id} (level ${gate.level}): NAND(${in1Name}, ${in2Name})`);
    }

    // Check the signals
    if (naId !== undefined) {
      console.log(`\nor_4494_na signal: isPrimary=${levelized.signals[naId]?.isPrimaryInput}, isDff=${levelized.signals[naId]?.isDffOutput}`);
    }
    if (nbId !== undefined) {
      console.log(`or_4494_nb signal: isPrimary=${levelized.signals[nbId]?.isPrimaryInput}, isDff=${levelized.signals[nbId]?.isDffOutput}`);
    }

    // These should have producers
    expect(gatesForNa.length).toBeGreaterThan(0);
    expect(gatesForNb.length).toBeGreaterThan(0);
  });
});
