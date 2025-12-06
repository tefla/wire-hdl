import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse, elaborate, levelize, Simulator, compileToWasmOptimized } from '../src/index.js';

const WIRE_DIR = '/Users/tim/dev/playground/dead-silicon/src/assets/wire';

describe('CPU Simulation', () => {
  // Load all dependencies
  const gatesSource = readFileSync(join(WIRE_DIR, 'gates.wire'), 'utf-8');
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

  it('should parse cpu_minimal.wire', () => {
    try {
      const program = parse(cpuSource);
      console.log(`✓ Parsed cpu_minimal.wire: ${program.modules.length} modules`);
      for (const mod of program.modules) {
        console.log(`  - ${mod.name}: ${mod.params.length} params, ${mod.outputs.length} outputs`);
      }
      expect(program.modules.length).toBeGreaterThan(0);
    } catch (e: any) {
      console.log(`✗ Parse error: ${e.message}`);
      throw e;
    }
  });

  it('should elaborate cpu_minimal with all dependencies', () => {
    // Combine all sources
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

    try {
      const program = parse(allSources);
      console.log(`✓ Parsed all sources: ${program.modules.length} modules total`);

      const netlist = elaborate(program, 'cpu_minimal');
      const levelized = levelize(netlist);

      console.log(`\n✓ Elaborated cpu_minimal:`);
      console.log(`  Signals: ${levelized.signals.length}`);
      console.log(`  NANDs: ${levelized.totalNands}`);
      console.log(`  DFFs: ${levelized.totalDffs}`);
      console.log(`  Levels: ${levelized.levels.length}`);

      // Estimate performance
      const gatesFor6502 = 4000;
      const estimatedCyclesPerSec = (799000 * gatesFor6502) / levelized.totalNands;
      console.log(`\n  === Performance Estimate ===`);
      console.log(`  Based on 799k cycles/sec for 4000 NANDs:`);
      console.log(`  Estimated: ${(estimatedCyclesPerSec / 1000).toFixed(0)}k cycles/sec`);

      expect(levelized.totalNands).toBeGreaterThan(0);
    } catch (e: any) {
      console.log(`✗ Elaboration error: ${e.message}`);
      throw e;
    }
  });

  it('should compile cpu_minimal to WASM and benchmark', () => {
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

    try {
      const program = parse(allSources);
      const netlist = elaborate(program, 'cpu_minimal');
      const levelized = levelize(netlist);

      console.log(`\nCompiling cpu_minimal to WASM...`);
      const compiled = compileToWasmOptimized(levelized);

      // Initialize inputs
      const clkId = levelized.signalMap.get('clk')!;
      const resetId = levelized.signalMap.get('reset')!;

      // Set clock high, reset low
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
      console.log(`\n✓ CPU WASM Benchmark:`);
      console.log(`  ${(cyclesPerSec / 1000).toFixed(1)}k cycles/sec`);
      console.log(`  ${(elapsed / cycles * 1000).toFixed(2)}µs per cycle`);

      // Compare to 1MHz target
      console.log(`\n  Target: 1000k cycles/sec (1MHz)`);
      if (cyclesPerSec >= 1000000) {
        console.log(`  ✓ ACHIEVED 1MHz!`);
      } else {
        console.log(`  Gap: ${((1000000 - cyclesPerSec) / 1000000 * 100).toFixed(1)}% below target`);
      }

      expect(cyclesPerSec).toBeGreaterThan(0);
    } catch (e: any) {
      console.log(`✗ Compilation error: ${e.message}`);
      throw e;
    }
  });
});
