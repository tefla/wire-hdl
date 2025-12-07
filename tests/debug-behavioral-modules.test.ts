import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse, elaborate, levelize, optimize, compileToWasmOptimized } from '../src/index.js';

const CPU_SOURCES = [
  'gates.wire', 'arithmetic.wire', 'registers.wire', 'mux8.wire',
  'mux4way8.wire', 'mux8way8.wire', 'mux16.wire', 'adder16.wire',
  'inc16.wire', 'register16.wire', 'decoder.wire', 'alu8.wire',
  'pc.wire', 'cpu_minimal.wire',
];

describe('Debug behavioral modules', () => {
  it('should have behavioral modules after elaboration', () => {
    const wireDir = './wire';
    const sources = CPU_SOURCES.map(file => readFileSync(join(wireDir, file), 'utf-8'));
    const allSource = sources.join('\n');
    const program = parse(allSource);
    const netlist = elaborate(program, 'cpu_minimal');

    console.log('After elaboration:');
    console.log('  behavioralModules:', netlist.behavioralModules.length);
    if (netlist.behavioralModules.length > 0) {
      for (const mod of netlist.behavioralModules) {
        console.log('    -', mod.name, '(', mod.moduleName, ')');
        console.log('      inputs:');
        for (const [name, signalIds] of mod.inputs) {
          console.log('        ', name, ':', signalIds);
        }
        console.log('      outputs:');
        for (const [name, signalIds] of mod.outputs) {
          console.log('        ', name, ':', signalIds);
        }
      }
    }

    // Check optimizer
    const result = optimize(netlist, { maxConeInputs: 10, minSavingsPercent: 5, verbose: false });
    console.log('\nAfter optimization:');
    console.log('  behavioralModules:', result.netlist.behavioralModules.length);

    // Check levelize
    const levelized = levelize(result.netlist, program);
    console.log('\nAfter levelize:');
    console.log('  behavioralModules:', levelized.behavioralModules.length);
    console.log('  compiledBehaviors:', levelized.compiledBehaviors?.size ?? 0);
    console.log('  behavioralModuleDefs:', levelized.behavioralModuleDefs?.size ?? 0);

    if (levelized.compiledBehaviors) {
      for (const [name, func] of levelized.compiledBehaviors) {
        console.log('    - compiled:', name);
        // Test the function
        const testInputs = { a: 10, b: 5, op: 0, cin: 0 };
        try {
          const result = func(testInputs);
          console.log('      test result:', result);
        } catch (e) {
          console.log('      error:', (e as Error).message);
        }
      }
    }

    // Check WASM compilation
    const circuit = compileToWasmOptimized(levelized);
    console.log('\nAfter WASM compile:');
    console.log('  evaluateBehavioral:', typeof circuit.evaluateBehavioral);

    // Check what signals the circuit would use for alu_result
    console.log('\nSignal name check:');
    const resultSignals = levelized.behavioralModules[0].outputs.get('result') as number[];
    console.log('  Behavioral result signals:', resultSignals);
    console.log('  Signal names:');
    for (const sigId of resultSignals) {
      const sig = levelized.signals[sigId];
      console.log(`    ${sigId}: ${sig?.name || 'UNKNOWN'}`);
    }

    // Look for alu.result and alu signals
    console.log('\n  Looking for alu.result signals:');
    for (const sig of levelized.signals) {
      if (sig.name.includes('alu') && !sig.name.includes('alu_')) {
        console.log(`    ${sig.id}: ${sig.name}`);
      }
    }

    // Also check the signalMap
    console.log('\n  SignalMap entries for alu:');
    for (const [name, id] of levelized.signalMap) {
      if (name.includes('alu') && !name.includes('alu_')) {
        console.log(`    ${name} -> ${id}`);
      }
    }

    // Check what NAND gates use alu.result[0]
    const aluResult0 = 879;
    console.log('\n  NAND gates that use alu.result[0] (signal 879):');
    for (const gate of levelized.nandGates) {
      if (gate.in1 === aluResult0 || gate.in2 === aluResult0) {
        console.log(`    Gate ${gate.id}: NAND(${gate.in1}, ${gate.in2}) -> ${gate.out}`);
      }
    }

    // Check what NAND gates OUTPUT to signal 879 (this is the critical issue!)
    console.log('\n  NAND gates that OUTPUT to alu.result[0] (signal 879):');
    for (const gate of levelized.nandGates) {
      if (gate.out === aluResult0) {
        console.log(`    Gate ${gate.id}: NAND(${gate.in1}, ${gate.in2}) -> ${gate.out}`);
      }
    }
    // Check all 8 bits
    console.log('\n  NAND gates that OUTPUT to any alu.result[0-7]:');
    for (let bit = 0; bit < 8; bit++) {
      const sigId = 879 + bit;
      for (const gate of levelized.nandGates) {
        if (gate.out === sigId) {
          console.log(`    Gate ${gate.id}: NAND(${gate.in1}, ${gate.in2}) -> ${gate.out} (alu.result[${bit}])`);
        }
      }
    }

    // Also check what signals are behavioral module INPUTS and at what level
    console.log('\n  Behavioral module input signals:');
    const aInputs = levelized.behavioralModules[0].inputs.get('a') as number[];
    const bInputs = levelized.behavioralModules[0].inputs.get('b') as number[];
    const opInputs = levelized.behavioralModules[0].inputs.get('op') as number[];

    // Check what LEVEL the gates using alu.result are at
    console.log('\n  Level of gates using alu.result signals:');
    // Build gate level lookup
    const gateLevelMap = new Map<number, number>();
    for (let levelIdx = 0; levelIdx < levelized.levels.length; levelIdx++) {
      for (const gate of levelized.levels[levelIdx]) {
        gateLevelMap.set(gate.id, levelIdx);
      }
    }
    // Find gates using alu.result
    for (let bit = 0; bit < 8; bit++) {
      const sigId = 879 + bit;
      for (const gate of levelized.nandGates) {
        if (gate.in1 === sigId || gate.in2 === sigId) {
          const level = gateLevelMap.get(gate.id) ?? -1;
          console.log(`    Gate ${gate.id} at level ${level} uses alu.result[${bit}]`);
        }
      }
    }

    // Find max level that behavioral inputs are computed at
    console.log('\n  Max level of behavioral inputs:');
    let maxInputLevel = 0;
    for (const sigId of [...aInputs, ...bInputs, ...opInputs]) {
      for (const gate of levelized.nandGates) {
        if (gate.out === sigId) {
          const level = gateLevelMap.get(gate.id) ?? 0;
          if (level > maxInputLevel) maxInputLevel = level;
        }
      }
    }
    console.log(`    Max input level: ${maxInputLevel}`)

    // Print behavioral input signals
    console.log('    a:', aInputs);
    console.log('    b:', bInputs);
    console.log('    op:', opInputs);

    // Check if inputs are DFF outputs, primary inputs, or gate outputs
    console.log('\n  Input signal sources:');
    for (const sigId of [...aInputs, ...bInputs, ...opInputs]) {
      const sig = levelized.signals[sigId];
      if (sig.isPrimaryInput) {
        console.log(`    ${sigId} (${sig.name}): primary input`);
      } else if (sig.isDffOutput) {
        console.log(`    ${sigId} (${sig.name}): DFF output`);
      } else {
        // Find which gate outputs this signal
        for (let levelIdx = 0; levelIdx < levelized.levels.length; levelIdx++) {
          for (const gate of levelized.levels[levelIdx]) {
            if (gate.out === sigId) {
              console.log(`    ${sigId} (${sig.name}): gate ${gate.id} output at level ${levelIdx}`);
            }
          }
        }
      }
    }

    // Also check signal 887 (alu[0])
    const alu0 = 887;
    console.log('\n  NAND gates that use alu[0] (signal 887):');
    for (const gate of levelized.nandGates) {
      if (gate.in1 === alu0 || gate.in2 === alu0) {
        console.log(`    Gate ${gate.id}: NAND(${gate.in1}, ${gate.in2}) -> ${gate.out}`);
      }
    }

    // Test the behavioral evaluation manually
    if (circuit.evaluateBehavioral) {
      // Set some test input signals
      const aSignals = levelized.behavioralModules[0].inputs.get('a') as number[];
      const bSignals = levelized.behavioralModules[0].inputs.get('b') as number[];
      const opSignals = levelized.behavioralModules[0].inputs.get('op') as number[];

      console.log('\nManual test:');
      console.log('  a signals:', aSignals);
      console.log('  b signals:', bSignals);
      console.log('  op signals:', opSignals);
      console.log('  result signals:', resultSignals);

      // Set a = 10 (0b00001010)
      for (let i = 0; i < 8; i++) {
        circuit.setSignal(aSignals[i], (10 >> i) & 1);
      }
      // Set b = 5 (0b00000101)
      for (let i = 0; i < 8; i++) {
        circuit.setSignal(bSignals[i], (5 >> i) & 1);
      }
      // Set op = 0 (ADD)
      for (let i = 0; i < 3; i++) {
        circuit.setSignal(opSignals[i], 0);
      }

      // Evaluate behavioral
      circuit.evaluateBehavioral();

      // Read result
      let resultValue = 0;
      for (let i = 0; i < 8; i++) {
        resultValue |= circuit.getSignal(resultSignals[i]) << i;
      }
      console.log('  result value:', resultValue, '(expected 15)');
    }

    expect(netlist.behavioralModules.length).toBeGreaterThan(0);
  });
});
