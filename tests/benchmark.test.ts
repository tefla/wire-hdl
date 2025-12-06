import { describe, it, expect } from 'vitest';
import { Simulator, parse, elaborate, levelize } from '../src/index.js';

// Build progressively larger circuits to measure scaling
// Avoid multi-output modules for now (need to fix that bug)

const GATES_SOURCE = `
module not(a) -> out:
  out = nand(a, a)

module and(a, b) -> out:
  n = nand(a, b)
  out = nand(n, n)

module or(a, b) -> out:
  na = nand(a, a)
  nb = nand(b, b)
  out = nand(na, nb)

module xor(a, b) -> out:
  n1 = nand(a, b)
  n2 = nand(a, n1)
  n3 = nand(b, n1)
  out = nand(n2, n3)
`;

function benchmarkCircuit(source: string, topModule: string, label: string) {
  const program = parse(source);
  const netlist = elaborate(program, topModule);
  const levelized = levelize(netlist);

  const sim = new Simulator(levelized);

  // Set up inputs
  for (const input of sim.listInputs()) {
    sim.setInput(input, input.includes('clk') ? 1 : 0);
  }

  // Warm up
  sim.run(1000);

  // Benchmark
  const cycles = 100000;
  const start = performance.now();
  sim.run(cycles);
  const elapsed = performance.now() - start;

  const cyclesPerSecond = (cycles / elapsed) * 1000;
  const stats = sim.getStats();

  console.log(`\n${label}:`);
  console.log(`  NANDs: ${stats.totalGates}, DFFs: ${stats.totalDffs}, Levels: ${stats.maxLevel}`);
  console.log(`  Performance: ${(cyclesPerSecond / 1000).toFixed(1)}k cycles/sec`);
  console.log(`  Time per cycle: ${(elapsed / cycles * 1000).toFixed(2)}µs`);
  console.log(`  Time per NAND: ${(elapsed / cycles / Math.max(1, stats.totalGates) * 1000000).toFixed(1)}ns`);

  return { cyclesPerSecond, stats };
}

describe('Scaling Benchmarks', () => {
  it('should benchmark tiny circuit (~4 NANDs)', () => {
    const source = GATES_SOURCE + `
      module counter1(en, clk) -> q:
        next = xor(q, en)
        q = dff(next, clk)
    `;
    const result = benchmarkCircuit(source, 'counter1', '1-bit counter');
    expect(result.stats.totalGates).toBe(4);
  });

  it('should benchmark small circuit (~50 NANDs)', () => {
    const source = GATES_SOURCE + `
      module counter1(en, clk) -> q:
        next = xor(q, en)
        q = dff(next, clk)

      module counter8(en, clk) -> q0:
        q0 = counter1(en, clk)
        e1 = and(en, q0)
        q1 = counter1(e1, clk)
        e2 = and(e1, q1)
        q2 = counter1(e2, clk)
        e3 = and(e2, q2)
        q3 = counter1(e3, clk)
        e4 = and(e3, q3)
        q4 = counter1(e4, clk)
        e5 = and(e4, q4)
        q5 = counter1(e5, clk)
        e6 = and(e5, q5)
        q6 = counter1(e6, clk)
        e7 = and(e6, q6)
        q7 = counter1(e7, clk)
    `;
    const result = benchmarkCircuit(source, 'counter8', '8-bit counter');
    expect(result.stats.totalGates).toBeGreaterThan(40);
  });

  it('should benchmark medium circuit (~200 NANDs)', () => {
    // Create 4 cascaded 8-bit counters
    const source = GATES_SOURCE + `
      module counter1(en, clk) -> q:
        next = xor(q, en)
        q = dff(next, clk)

      module counter8(en, clk) -> q7:
        q0 = counter1(en, clk)
        e1 = and(en, q0)
        q1 = counter1(e1, clk)
        e2 = and(e1, q1)
        q2 = counter1(e2, clk)
        e3 = and(e2, q2)
        q3 = counter1(e3, clk)
        e4 = and(e3, q3)
        q4 = counter1(e4, clk)
        e5 = and(e4, q4)
        q5 = counter1(e5, clk)
        e6 = and(e5, q5)
        q6 = counter1(e6, clk)
        e7 = and(e6, q6)
        q7 = counter1(e7, clk)

      module counter32(en, clk) -> out:
        c0 = counter8(en, clk)
        c1 = counter8(c0, clk)
        c2 = counter8(c1, clk)
        out = counter8(c2, clk)
    `;
    const result = benchmarkCircuit(source, 'counter32', '32-bit counter');
    expect(result.stats.totalGates).toBeGreaterThan(150);
  });

  it('should benchmark large circuit (~800 NANDs)', () => {
    // Create 16 cascaded 8-bit counters
    const source = GATES_SOURCE + `
      module counter1(en, clk) -> q:
        next = xor(q, en)
        q = dff(next, clk)

      module counter8(en, clk) -> q7:
        q0 = counter1(en, clk)
        e1 = and(en, q0)
        q1 = counter1(e1, clk)
        e2 = and(e1, q1)
        q2 = counter1(e2, clk)
        e3 = and(e2, q2)
        q3 = counter1(e3, clk)
        e4 = and(e3, q3)
        q4 = counter1(e4, clk)
        e5 = and(e4, q4)
        q5 = counter1(e5, clk)
        e6 = and(e5, q5)
        q6 = counter1(e6, clk)
        e7 = and(e6, q6)
        q7 = counter1(e7, clk)

      module counter128(en, clk) -> out:
        c0 = counter8(en, clk)
        c1 = counter8(c0, clk)
        c2 = counter8(c1, clk)
        c3 = counter8(c2, clk)
        c4 = counter8(c3, clk)
        c5 = counter8(c4, clk)
        c6 = counter8(c5, clk)
        c7 = counter8(c6, clk)
        c8 = counter8(c7, clk)
        c9 = counter8(c8, clk)
        c10 = counter8(c9, clk)
        c11 = counter8(c10, clk)
        c12 = counter8(c11, clk)
        c13 = counter8(c12, clk)
        c14 = counter8(c13, clk)
        out = counter8(c14, clk)
    `;
    const result = benchmarkCircuit(source, 'counter128', '128-bit counter');
    expect(result.stats.totalGates).toBeGreaterThan(600);

    // Estimate for 6502
    const gatesFor6502 = 4000;
    const ratio = gatesFor6502 / result.stats.totalGates;
    const estimated6502Speed = result.cyclesPerSecond / ratio;

    console.log(`\n  === 6502 ESTIMATE (${gatesFor6502} NANDs) ===`);
    console.log(`  Extrapolated: ${(estimated6502Speed / 1000).toFixed(0)}k cycles/sec`);
    console.log(`  Target: 1000k cycles/sec (1MHz)`);
    console.log(`  Gap: ${(1000000 / estimated6502Speed).toFixed(1)}x slower than target`);
    console.log(`  WASM needed: YES (expect 2-10x speedup)`);
  });
});
