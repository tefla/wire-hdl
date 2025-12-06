import { describe, it, expect } from 'vitest';
import { parse, elaborate, levelize, optimize, compileToWasmOptimized, type LevelizedNetlist } from '../src/index.js';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Debug Reset', () => {
  it('should find reset signal and trace DFFs', () => {
    const files = ['gates.wire', 'arithmetic.wire', 'registers.wire', 'mux8.wire', 'mux4way8.wire', 'mux8way8.wire', 'mux16.wire', 'adder16.wire', 'inc16.wire', 'register16.wire', 'decoder.wire', 'alu8.wire', 'pc.wire', 'cpu_minimal.wire'];
    const source = files.map(f => readFileSync(join('./wire', f), 'utf-8')).join('\n');
    const program = parse(source);
    const netlist = elaborate(program, 'cpu_minimal');
    const optimized = optimize(netlist, { maxConeInputs: 10 });
    const levelized = levelize(optimized.netlist);

    // Find the state DFFs
    console.log(`Total DFFs: ${levelized.dffs.length}`);

    // Find state0-state4 DFF outputs
    const state0Id = levelized.signalMap.get('state_out[0]')!;
    const state1Id = levelized.signalMap.get('state_out[1]')!;
    const state2Id = levelized.signalMap.get('state_out[2]')!;
    const state3Id = levelized.signalMap.get('state_out[3]')!;
    const state4Id = levelized.signalMap.get('state_out[4]')!;

    // Find DFFs by Q output
    const stateDffs = levelized.dffs.filter(dff =>
      dff.q === state0Id || dff.q === state1Id || dff.q === state2Id ||
      dff.q === state3Id || dff.q === state4Id
    );

    console.log('State DFFs found:', stateDffs.length);
    for (const dff of stateDffs) {
      // Find signal name for D input
      const dName = [...levelized.signalMap.entries()].find(([_, id]) => id === dff.d)?.[0] || `signal_${dff.d}`;
      const qName = [...levelized.signalMap.entries()].find(([_, id]) => id === dff.q)?.[0] || `signal_${dff.q}`;
      console.log(`  DFF: D=${dName}(${dff.d}) -> Q=${qName}(${dff.q})`);
    }

    // But wait - the optimizer might have changed things!
    // Let's check the unoptimized netlist
    const levelizedUnopt = levelize(netlist);
    const stateDffsUnopt = levelizedUnopt.dffs.filter(dff => {
      const qName = [...levelizedUnopt.signalMap.entries()].find(([_, id]) => id === dff.q)?.[0];
      return qName?.startsWith('state');
    });
    console.log('\nUnoptimized state DFFs:', stateDffsUnopt.length);

    // Compare DFF counts
    console.log(`\nOptimized DFFs: ${levelized.dffs.length}`);
    console.log(`Unoptimized DFFs: ${levelizedUnopt.dffs.length}`);

    // Test with unoptimized circuit
    const circuitUnopt = compileToWasmOptimized(levelizedUnopt);
    const resetId = levelizedUnopt.signalMap.get('reset')!;

    console.log('\n--- Testing UNOPTIMIZED circuit ---');

    // Set reset
    circuitUnopt.setSignal(resetId, 1);
    console.log('Reset set to 1');

    const readStateUnopt = () => {
      const s0 = levelizedUnopt.signalMap.get('state_out[0]')!;
      const s1 = levelizedUnopt.signalMap.get('state_out[1]')!;
      const s2 = levelizedUnopt.signalMap.get('state_out[2]')!;
      const s3 = levelizedUnopt.signalMap.get('state_out[3]')!;
      const s4 = levelizedUnopt.signalMap.get('state_out[4]')!;
      return circuitUnopt.getSignal(s0) |
        (circuitUnopt.getSignal(s1) << 1) |
        (circuitUnopt.getSignal(s2) << 2) |
        (circuitUnopt.getSignal(s3) << 3) |
        (circuitUnopt.getSignal(s4) << 4);
    };

    for (let i = 0; i < 5; i++) {
      circuitUnopt.evaluate();
      console.log(`Cycle ${i + 1}: state=${readStateUnopt()}`);
    }
  });
});
