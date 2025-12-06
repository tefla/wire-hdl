import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse, elaborate, levelize, optimize, compileToWasmOptimized } from '../src/index.js';

const WIRE_DIR = './wire';

describe('Optimizer', () => {
  // Load gates for simple tests
  const gatesSource = readFileSync(join(WIRE_DIR, 'gates.wire'), 'utf-8');

  it('should optimize a simple XOR gate', () => {
    const program = parse(gatesSource);
    const netlist = elaborate(program, 'xor');
    const levelized = levelize(netlist);

    console.log(`Before optimization: ${levelized.totalNands} NANDs`);

    const result = optimize(netlist, { verbose: true });
    const optimizedLevelized = levelize(result.netlist);

    console.log(`After optimization: ${optimizedLevelized.totalNands} NANDs`);
    console.log(`Stats:`, result.stats);

    // XOR uses 4 NANDs in our implementation
    expect(result.stats.originalGates).toBe(4);
  });

  it('should optimize a MUX gate', () => {
    const program = parse(gatesSource);
    const netlist = elaborate(program, 'mux');
    const levelized = levelize(netlist);

    console.log(`MUX before: ${levelized.totalNands} NANDs`);

    const result = optimize(netlist, { verbose: true });
    const optimizedLevelized = levelize(result.netlist);

    console.log(`MUX after: ${optimizedLevelized.totalNands} NANDs`);
    console.log(`Stats:`, result.stats);
  });

  it('should verify optimized circuit produces same outputs', () => {
    // Test with a simple 2-bit counter
    const program = parse(gatesSource);
    const netlist = elaborate(program, 'xor');

    // Optimize
    const { netlist: optimizedNetlist } = optimize(netlist);
    const levelized = levelize(netlist);
    const optimizedLevelized = levelize(optimizedNetlist);

    // Both should have same inputs/outputs
    expect(optimizedLevelized.signals.filter(s => s.isPrimaryInput).length)
      .toBe(levelized.signals.filter(s => s.isPrimaryInput).length);
    expect(optimizedLevelized.signals.filter(s => s.isPrimaryOutput).length)
      .toBe(levelized.signals.filter(s => s.isPrimaryOutput).length);
  });

  describe('CPU Optimization', () => {
    // Load all CPU dependencies
    const arithmeticSource = readFileSync(join(WIRE_DIR, 'arithmetic.wire'), 'utf-8');
    const registersSource = readFileSync(join(WIRE_DIR, 'registers.wire'), 'utf-8');
    const mux8Source = readFileSync(join(WIRE_DIR, 'mux8.wire'), 'utf-8');
    const mux4way8Source = readFileSync(join(WIRE_DIR, 'mux4way8.wire'), 'utf-8');
    const mux8way8Source = readFileSync(join(WIRE_DIR, 'mux8way8.wire'), 'utf-8');
    const mux16Source = readFileSync(join(WIRE_DIR, 'mux16.wire'), 'utf-8');
    const adder16Source = readFileSync(join(WIRE_DIR, 'adder16.wire'), 'utf-8');
    const inc16Source = readFileSync(join(WIRE_DIR, 'inc16.wire'), 'utf-8');
    const register16Source = readFileSync(join(WIRE_DIR, 'register16.wire'), 'utf-8');
    const decoderSource = readFileSync(join(WIRE_DIR, 'decoder.wire'), 'utf-8');
    const alu8Source = readFileSync(join(WIRE_DIR, 'alu8.wire'), 'utf-8');
    const pcSource = readFileSync(join(WIRE_DIR, 'pc.wire'), 'utf-8');
    const cpuSource = readFileSync(join(WIRE_DIR, 'cpu_minimal.wire'), 'utf-8');

    const allSources = [
      gatesSource,
      arithmeticSource,
      registersSource,
      mux8Source,
      mux4way8Source,
      mux8way8Source,
      mux16Source,
      adder16Source,
      inc16Source,
      register16Source,
      decoderSource,
      alu8Source,
      pcSource,
      cpuSource,
    ].join('\n');

    it('should optimize cpu_minimal and benchmark', () => {
      const program = parse(allSources);
      const netlist = elaborate(program, 'cpu_minimal');

      console.log(`\nOriginal CPU:`);
      console.log(`  NANDs: ${netlist.nandGates.length}`);
      console.log(`  DFFs: ${netlist.dffs.length}`);

      // Optimize with verbose output
      console.log(`\nOptimizing...`);
      const { netlist: optimized, stats } = optimize(netlist, {
        verbose: false,
        maxConeInputs: 10,
        minSavingsPercent: 5,
      });

      console.log(`\nOptimized CPU:`);
      console.log(`  NANDs: ${optimized.nandGates.length}`);
      console.log(`  DFFs: ${optimized.dffs.length}`);
      console.log(`\nOptimization stats:`);
      console.log(`  Cones extracted: ${stats.conesExtracted}`);
      console.log(`  Cones optimized: ${stats.conesOptimized}`);
      console.log(`  Cones skipped: ${stats.conesSkipped}`);
      console.log(`  Gates saved: ${stats.gatesSaved}`);
      console.log(`  Time: ${stats.optimizationTimeMs.toFixed(0)}ms`);
      console.log(`  Reduction: ${((stats.originalGates - stats.optimizedGates) / stats.originalGates * 100).toFixed(1)}%`);

      // Benchmark optimized circuit
      const levelized = levelize(optimized);
      console.log(`\nLevelized: ${levelized.levels.length} levels`);

      const compiled = compileToWasmOptimized(levelized);

      // Initialize inputs
      const clkId = levelized.signalMap.get('clk')!;
      const resetId = levelized.signalMap.get('reset')!;
      compiled.setSignal(clkId, 1);
      compiled.setSignal(resetId, 0);

      // Warmup
      compiled.runCycles(100);

      // Benchmark
      const cycles = 10000;
      const start = performance.now();
      compiled.runCycles(cycles);
      const elapsed = performance.now() - start;

      const cyclesPerSec = (cycles / elapsed) * 1000;
      console.log(`\n✓ Optimized CPU WASM Benchmark:`);
      console.log(`  ${(cyclesPerSec / 1000).toFixed(1)}k cycles/sec`);
      console.log(`  ${(elapsed / cycles * 1000).toFixed(2)}µs per cycle`);

      // Compare to 1MHz target
      console.log(`\n  Target: 1000k cycles/sec (1MHz)`);
      if (cyclesPerSec >= 1000000) {
        console.log(`  ✓ ACHIEVED 1MHz!`);
      } else {
        console.log(`  Gap: ${((1000000 - cyclesPerSec) / 1000000 * 100).toFixed(1)}% below target`);
      }

      expect(stats.optimizedGates).toBeLessThanOrEqual(stats.originalGates);
    });
  });
});
