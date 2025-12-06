import { describe, it, expect } from 'vitest';
import { parse, elaborate, levelize } from '../src/index.js';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Debug full chain', () => {
  it('should trace back the entire chain', () => {
    const files = ['gates.wire', 'arithmetic.wire', 'registers.wire', 'mux8.wire', 'mux4way8.wire', 'mux8way8.wire', 'mux16.wire', 'adder16.wire', 'inc16.wire', 'register16.wire', 'decoder.wire', 'alu8.wire', 'pc.wire', 'cpu_minimal.wire'];
    const source = files.map(f => readFileSync(join('./wire', f), 'utf-8')).join('\n');
    const program = parse(source);
    const netlist = elaborate(program, 'cpu_minimal');
    const levelized = levelize(netlist);

    // Build signal producers map
    const producers = new Map<number, {in1: number, in2: number, level: number}>();
    for (const gate of levelized.nandGates) {
      if (!producers.has(gate.out)) {
        producers.set(gate.out, { in1: gate.in1, in2: gate.in2, level: gate.level });
      }
    }

    // Build set of level-0 signals
    const level0 = new Set<number>();
    for (const sig of levelized.primaryInputs) level0.add(sig);
    for (const dff of levelized.dffs) level0.add(dff.q);
    for (const sig of levelized.signals) {
      if (sig.name.startsWith('const_')) level0.add(sig.id);
    }

    // Recursive trace function
    function trace(sigId: number, indent: string = '', visited: Set<number> = new Set()): void {
      if (visited.has(sigId)) {
        console.log(`${indent}${levelized.signals[sigId]?.name || `?${sigId}`} (already visited)`);
        return;
      }
      visited.add(sigId);

      const name = levelized.signals[sigId]?.name || `?${sigId}`;
      const prod = producers.get(sigId);

      if (!prod) {
        // No producer
        if (level0.has(sigId)) {
          console.log(`${indent}${name} (level-0: primary/dff/const)`);
        } else {
          console.log(`${indent}${name} *** ORPHAN - NO PRODUCER ***`);
        }
        return;
      }

      const in1Name = levelized.signals[prod.in1]?.name || `?${prod.in1}`;
      const in2Name = levelized.signals[prod.in2]?.name || `?${prod.in2}`;
      console.log(`${indent}${name} (level=${prod.level}) = NAND(${in1Name}, ${in2Name})`);

      if (prod.level === -1) {
        // Recursively trace inputs
        trace(prod.in1, indent + '  ', visited);
        if (prod.in1 !== prod.in2) {
          trace(prod.in2, indent + '  ', visited);
        }
      }
    }

    // Start from next_state2
    const next2Id = levelized.signalMap.get('next_state2')!;
    console.log('Tracing from next_state2:\n');
    trace(next2Id);
  });
});
