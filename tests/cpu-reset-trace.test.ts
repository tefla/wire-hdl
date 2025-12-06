import { describe, it, expect } from 'vitest';
import { parse, elaborate, levelize, compileToWasmOptimized } from '../src/index.js';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('CPU Reset Trace', () => {
  it('should trace gate chain from reset to next_state2', () => {
    const files = ['gates.wire', 'arithmetic.wire', 'registers.wire', 'mux8.wire', 'mux4way8.wire', 'mux8way8.wire', 'mux16.wire', 'adder16.wire', 'inc16.wire', 'register16.wire', 'decoder.wire', 'alu8.wire', 'pc.wire', 'cpu_minimal.wire'];
    const source = files.map(f => readFileSync(join('./wire', f), 'utf-8')).join('\n');
    const program = parse(source);
    const netlist = elaborate(program, 'cpu_minimal');
    const levelized = levelize(netlist);
    const circuit = compileToWasmOptimized(levelized);

    const allSignals = [...levelized.signalMap.entries()];
    const resetId = levelized.signalMap.get('reset')!;
    const nextState2Id = levelized.signalMap.get('next_state2')!;

    console.log(`reset ID: ${resetId}`);
    console.log(`next_state2 ID: ${nextState2Id}`);

    // Trace back from next_state2 to find all gates leading to it
    const gateMap = new Map<number, { in1: number; in2: number; out: number }>();
    for (const level of levelized.levels) {
      for (const gate of level) {
        gateMap.set(gate.out, gate);
      }
    }

    // Do a BFS to find path from reset to next_state2
    console.log('\nTracing from next_state2 back to inputs:');
    const traced = new Set<number>();
    const queue: number[] = [nextState2Id];

    while (queue.length > 0) {
      const id = queue.shift()!;
      if (traced.has(id)) continue;
      traced.add(id);

      const gate = gateMap.get(id);
      if (gate) {
        const outName = allSignals.find(([_, i]) => i === id)?.[0] || `sig_${id}`;
        const in1Name = allSignals.find(([_, i]) => i === gate.in1)?.[0] || `sig_${gate.in1}`;
        const in2Name = allSignals.find(([_, i]) => i === gate.in2)?.[0] || `sig_${gate.in2}`;
        console.log(`  ${outName}(${id}) = NAND(${in1Name}(${gate.in1}), ${in2Name}(${gate.in2}))`);

        if (!traced.has(gate.in1)) queue.push(gate.in1);
        if (!traced.has(gate.in2)) queue.push(gate.in2);
      } else {
        const name = allSignals.find(([_, i]) => i === id)?.[0] || `sig_${id}`;
        console.log(`  ${name}(${id}) = PRIMARY INPUT or DFF output`);
      }
    }

    // Now test evaluation
    console.log('\n=== Testing with reset=1 ===');
    circuit.setSignal(resetId, 1);

    // Read intermediate values after evaluate
    circuit.evaluate();

    console.log(`reset: ${circuit.getSignal(resetId)}`);
    for (const id of traced) {
      const name = allSignals.find(([_, i]) => i === id)?.[0] || `sig_${id}`;
      console.log(`  ${name}: ${circuit.getSignal(id)}`);
    }
  });
});
