import { describe, it, expect } from 'vitest';
import { parse, elaborate, levelize } from '../src/index.js';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Levelize debug', () => {
  it('should preserve gate for next_state2 after levelization', () => {
    const files = ['gates.wire', 'arithmetic.wire', 'registers.wire', 'mux8.wire', 'mux4way8.wire', 'mux8way8.wire', 'mux16.wire', 'adder16.wire', 'inc16.wire', 'register16.wire', 'decoder.wire', 'alu8.wire', 'pc.wire', 'cpu_minimal.wire'];
    const source = files.map(f => readFileSync(join('./wire', f), 'utf-8')).join('\n');
    const program = parse(source);
    const netlist = elaborate(program, 'cpu_minimal');

    console.log('Before levelize:');
    const next_state2Id = netlist.signalMap.get('next_state2');
    console.log(`  next_state2 ID: ${next_state2Id}`);
    const gatesBefore = netlist.nandGates.filter(g => g.out === next_state2Id);
    console.log(`  Gates driving next_state2: ${gatesBefore.length}`);

    const levelized = levelize(netlist);

    console.log('\nAfter levelize:');
    const next_state2IdAfter = levelized.signalMap.get('next_state2');
    console.log(`  next_state2 ID: ${next_state2IdAfter}`);

    // Count all gates in levels
    let totalGates = 0;
    for (const level of levelized.levels) {
      totalGates += level.length;
    }
    console.log(`  Total gates in levels: ${totalGates}`);
    console.log(`  Total nandGates: ${levelized.nandGates.length}`);

    // Find gates driving next_state2 in levelized netlist
    let gatesForNext2 = 0;
    for (const level of levelized.levels) {
      for (const gate of level) {
        if (gate.out === next_state2IdAfter) {
          gatesForNext2++;
          const in1Name = levelized.signals[gate.in1]?.name || `sig_${gate.in1}`;
          const in2Name = levelized.signals[gate.in2]?.name || `sig_${gate.in2}`;
          console.log(`  Found gate in level ${gate.level}: NAND(${in1Name}, ${in2Name}) -> next_state2`);
        }
      }
    }
    console.log(`  Gates in levels driving next_state2: ${gatesForNext2}`);

    // Also check nandGates array directly
    const gatesAfter = levelized.nandGates.filter(g => g.out === next_state2IdAfter);
    console.log(`  Gates in nandGates array driving next_state2: ${gatesAfter.length}`);

    // Check if or_4494_na and or_4494_nb have valid levels
    const or_naId = levelized.signalMap.get('or_4494_na');
    const or_nbId = levelized.signalMap.get('or_4494_nb');
    console.log(`\n  or_4494_na ID: ${or_naId}`);
    console.log(`  or_4494_nb ID: ${or_nbId}`);

    // Find gates that produce or_4494_na and or_4494_nb
    for (const gate of levelized.nandGates) {
      if (gate.out === or_naId || gate.out === or_nbId) {
        const in1Name = levelized.signals[gate.in1]?.name || `sig_${gate.in1}`;
        const in2Name = levelized.signals[gate.in2]?.name || `sig_${gate.in2}`;
        const outName = levelized.signals[gate.out]?.name || `sig_${gate.out}`;
        console.log(`  Gate ${gate.id} (level ${gate.level}): NAND(${in1Name}, ${in2Name}) -> ${outName}`);
      }
    }

    // Check signal IDs - maybe they're out of bounds?
    console.log(`\n  Total signals: ${levelized.signals.length}`);
    console.log(`  or_4494_na (${or_naId}) exists: ${or_naId !== undefined && or_naId < levelized.signals.length}`);
    console.log(`  or_4494_nb (${or_nbId}) exists: ${or_nbId !== undefined && or_nbId < levelized.signals.length}`);

    // The gate for next_state2 has level -1, which means it wasn't levelized!
    const gateFor2 = levelized.nandGates.find(g => g.out === next_state2IdAfter);
    console.log(`\n  Gate for next_state2: level=${gateFor2?.level}`);

    // Trace _temp_4495
    const temp4495Id = levelized.signalMap.get('_temp_4495');
    console.log(`\n_temp_4495 ID: ${temp4495Id}`);

    // Find gate producing _temp_4495
    for (const gate of levelized.nandGates) {
      if (gate.out === temp4495Id) {
        const in1Name = levelized.signals[gate.in1]?.name || `sig_${gate.in1}`;
        const in2Name = levelized.signals[gate.in2]?.name || `sig_${gate.in2}`;
        console.log(`  Gate ${gate.id} (level ${gate.level}): NAND(${in1Name}(${gate.in1}), ${in2Name}(${gate.in2})) -> _temp_4495`);

        // Is set_bit_2 defined? What drives it?
        if (gate.in1 !== gate.in2) {
          const sb2Id = levelized.signalMap.get('set_bit_2');
          console.log(`  set_bit_2 ID: ${sb2Id}`);

          // Find gates producing set_bit_2
          for (const g2 of levelized.nandGates) {
            if (g2.out === sb2Id) {
              const in1 = levelized.signals[g2.in1]?.name || `sig_${g2.in1}`;
              const in2 = levelized.signals[g2.in2]?.name || `sig_${g2.in2}`;
              console.log(`    Gate ${g2.id} (level ${g2.level}): NAND(${in1}, ${in2}) -> set_bit_2`);
            }
          }
        }
      }
    }

    // Count unlevelized gates
    const unlevelized = levelized.nandGates.filter(g => g.level === -1);
    console.log(`\nUnlevelized gates: ${unlevelized.length} / ${levelized.nandGates.length}`);

    // Trace and_4496_n
    const and4496nId = levelized.signalMap.get('and_4496_n');
    console.log(`\nand_4496_n ID: ${and4496nId}`);

    // Find what produces and_4496_n
    for (const gate of levelized.nandGates) {
      if (gate.out === and4496nId) {
        const in1Name = levelized.signals[gate.in1]?.name || `sig_${gate.in1}`;
        const in2Name = levelized.signals[gate.in2]?.name || `sig_${gate.in2}`;
        console.log(`  Gate ${gate.id} (level ${gate.level}): NAND(${in1Name}(${gate.in1}), ${in2Name}(${gate.in2})) -> and_4496_n`);
      }
    }

    // Check if set_bit_2 exists and has a level
    const sb2Id = levelized.signalMap.get('set_bit_2');
    console.log(`\nset_bit_2 ID: ${sb2Id}`);
    if (sb2Id !== undefined) {
      // Find what produces set_bit_2
      for (const gate of levelized.nandGates) {
        if (gate.out === sb2Id) {
          const in1Name = levelized.signals[gate.in1]?.name || `sig_${gate.in1}`;
          const in2Name = levelized.signals[gate.in2]?.name || `sig_${gate.in2}`;
          console.log(`  Gate ${gate.id} (level ${gate.level}): NAND(${in1Name}(${gate.in1}), ${in2Name}(${gate.in2})) -> set_bit_2`);
        }
      }
    }

    // Check how many signals have high IDs
    const highIdSignals = levelized.signals.filter(s => s.id > 10000);
    console.log(`\nSignals with ID > 10000: ${highIdSignals.length}`);
    console.log(`First few:`, highIdSignals.slice(0, 5).map(s => `${s.name}(${s.id})`).join(', '));

    // Check what produces or_4463_na
    const or4463naId = levelized.signalMap.get('or_4463_na');
    console.log(`\nor_4463_na ID: ${or4463naId}`);
    let foundGateForOr4463na = false;
    for (const gate of levelized.nandGates) {
      if (gate.out === or4463naId) {
        foundGateForOr4463na = true;
        const in1Name = levelized.signals[gate.in1]?.name || `sig_${gate.in1}`;
        const in2Name = levelized.signals[gate.in2]?.name || `sig_${gate.in2}`;
        console.log(`  Gate ${gate.id} (level ${gate.level}): NAND(${in1Name}(${gate.in1}), ${in2Name}(${gate.in2})) -> or_4463_na`);

        // What are the input IDs?
        const isIn1Primary = levelized.primaryInputs.includes(gate.in1);
        const isIn1DffOutput = levelized.dffs.some(d => d.q === gate.in1);
        const isIn1Const = levelized.signals[gate.in1]?.name.startsWith('const_');
        console.log(`    in1 (${gate.in1}): primary=${isIn1Primary}, dff=${isIn1DffOutput}, const=${isIn1Const}`);

        const isIn2Primary = levelized.primaryInputs.includes(gate.in2);
        const isIn2DffOutput = levelized.dffs.some(d => d.q === gate.in2);
        const isIn2Const = levelized.signals[gate.in2]?.name.startsWith('const_');
        console.log(`    in2 (${gate.in2}): primary=${isIn2Primary}, dff=${isIn2DffOutput}, const=${isIn2Const}`);

        // Check if these inputs are produced by other gates
        let gatesProducingIn1 = 0;
        let gatesProducingIn2 = 0;
        for (const g2 of levelized.nandGates) {
          if (g2.out === gate.in1) gatesProducingIn1++;
          if (g2.out === gate.in2) gatesProducingIn2++;
        }
        console.log(`    gates producing in1: ${gatesProducingIn1}`);
        console.log(`    gates producing in2: ${gatesProducingIn2}`);
      }
    }
    if (!foundGateForOr4463na) {
      console.log(`  NO GATE produces or_4463_na!`);
    }

    expect(gatesAfter.length).toBeGreaterThan(0);
  });
});
