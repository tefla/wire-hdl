import { describe, it, expect } from 'vitest';
import {
  parse,
  elaborate,
  levelize,
  Simulator,
  compileToWasm,
  compileToWasmOptimized,
} from '../src/index.js';

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

function createCounter(bits: number): string {
  let source = GATES_SOURCE + `
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
`;

  if (bits === 8) {
    return source;
  }

  // Create cascaded counters
  const numCounters = Math.ceil(bits / 8);
  source += `\nmodule counter${bits}(en, clk) -> out:\n`;

  for (let i = 0; i < numCounters; i++) {
    if (i === 0) {
      source += `  c0 = counter8(en, clk)\n`;
    } else {
      source += `  c${i} = counter8(c${i - 1}, clk)\n`;
    }
  }
  source += `  out = c${numCounters - 1}\n`;

  return source;
}

describe('WASM vs JS Performance', () => {
  it('should compile a simple circuit to WASM', () => {
    const source = GATES_SOURCE + `
      module test(a, b) -> out:
        out = nand(a, b)
    `;
    const program = parse(source);
    const netlist = elaborate(program, 'test');
    const levelized = levelize(netlist);

    const compiled = compileToWasm(levelized);

    // Test basic functionality
    compiled.setSignal(0, 1); // a = 1
    compiled.setSignal(1, 1); // b = 1
    compiled.evaluate();
    expect(compiled.getSignal(2)).toBe(0); // NAND(1,1) = 0

    compiled.setSignal(0, 0); // a = 0
    compiled.evaluate();
    expect(compiled.getSignal(2)).toBe(1); // NAND(0,1) = 1
  });

  it('should compare JS vs WASM performance for 128-bit counter', () => {
    const source = createCounter(128);
    const program = parse(source);
    const netlist = elaborate(program, 'counter128');
    const levelized = levelize(netlist);

    console.log(`\nCircuit: 128-bit counter`);
    console.log(`  NANDs: ${levelized.totalNands}, DFFs: ${levelized.totalDffs}`);

    // Benchmark JS
    const jsSim = new Simulator(levelized);
    jsSim.setInput('en', 1);
    jsSim.setInput('clk', 1);
    jsSim.run(1000); // warmup

    const jsCycles = 100000;
    const jsStart = performance.now();
    jsSim.run(jsCycles);
    const jsElapsed = performance.now() - jsStart;
    const jsCyclesPerSec = (jsCycles / jsElapsed) * 1000;

    console.log(`\n  JS Performance:`);
    console.log(`    ${(jsCyclesPerSec / 1000).toFixed(1)}k cycles/sec`);
    console.log(`    ${(jsElapsed / jsCycles * 1000).toFixed(2)}µs per cycle`);

    // Benchmark WASM
    const wasmCompiled = compileToWasm(levelized);

    // Set inputs (find signal IDs)
    const enId = levelized.signalMap.get('en')!;
    const clkId = levelized.signalMap.get('clk')!;
    wasmCompiled.setSignal(enId, 1);
    wasmCompiled.setSignal(clkId, 1);

    wasmCompiled.runCycles(1000); // warmup

    const wasmCycles = 100000;
    const wasmStart = performance.now();
    wasmCompiled.runCycles(wasmCycles);
    const wasmElapsed = performance.now() - wasmStart;
    const wasmCyclesPerSec = (wasmCycles / wasmElapsed) * 1000;

    console.log(`\n  WASM Performance:`);
    console.log(`    ${(wasmCyclesPerSec / 1000).toFixed(1)}k cycles/sec`);
    console.log(`    ${(wasmElapsed / wasmCycles * 1000).toFixed(2)}µs per cycle`);

    // Benchmark optimized WASM
    const wasmOptCompiled = compileToWasmOptimized(levelized);
    wasmOptCompiled.setSignal(enId, 1);
    wasmOptCompiled.setSignal(clkId, 1);
    wasmOptCompiled.runCycles(1000); // warmup

    const wasmOptStart = performance.now();
    wasmOptCompiled.runCycles(wasmCycles);
    const wasmOptElapsed = performance.now() - wasmOptStart;
    const wasmOptCyclesPerSec = (wasmCycles / wasmOptElapsed) * 1000;

    console.log(`\n  WASM Optimized Performance:`);
    console.log(`    ${(wasmOptCyclesPerSec / 1000).toFixed(1)}k cycles/sec`);
    console.log(`    ${(wasmOptElapsed / wasmCycles * 1000).toFixed(2)}µs per cycle`);

    // Summary
    console.log(`\n  Speedup:`);
    console.log(`    WASM vs JS: ${(wasmCyclesPerSec / jsCyclesPerSec).toFixed(2)}x`);
    console.log(`    WASM-Opt vs JS: ${(wasmOptCyclesPerSec / jsCyclesPerSec).toFixed(2)}x`);

    // Estimate for 6502
    const gatesFor6502 = 4000;
    const ratio = gatesFor6502 / levelized.totalNands;
    const estJS = jsCyclesPerSec / ratio;
    const estWasm = wasmCyclesPerSec / ratio;
    const estWasmOpt = wasmOptCyclesPerSec / ratio;

    console.log(`\n  === 6502 ESTIMATE (${gatesFor6502} NANDs) ===`);
    console.log(`    JS: ${(estJS / 1000).toFixed(0)}k cycles/sec`);
    console.log(`    WASM: ${(estWasm / 1000).toFixed(0)}k cycles/sec`);
    console.log(`    WASM-Opt: ${(estWasmOpt / 1000).toFixed(0)}k cycles/sec`);
    console.log(`    Target: 1000k cycles/sec (1MHz)`);

    // WASM should be faster than JS
    expect(wasmCyclesPerSec).toBeGreaterThan(jsCyclesPerSec * 0.8); // At least 80% as fast
  });

  it('should verify WASM correctness against JS', () => {
    const source = createCounter(8);
    const program = parse(source);
    const netlist = elaborate(program, 'counter8');
    const levelized = levelize(netlist);

    const jsSim = new Simulator(levelized);
    const wasmCompiled = compileToWasm(levelized);

    // Set up both simulators the same way
    const enId = levelized.signalMap.get('en')!;
    const clkId = levelized.signalMap.get('clk')!;
    const outId = levelized.signalMap.get('q7')!;

    jsSim.setInput('en', 1);
    jsSim.setInput('clk', 1);
    wasmCompiled.setSignal(enId, 1);
    wasmCompiled.setSignal(clkId, 1);

    // Run both for 256 cycles and compare outputs
    for (let i = 0; i < 256; i++) {
      jsSim.step();
      wasmCompiled.evaluate();

      const jsOut = jsSim.getOutput('q7');
      const wasmOut = wasmCompiled.getSignal(outId);

      if (jsOut !== wasmOut) {
        throw new Error(`Mismatch at cycle ${i}: JS=${jsOut}, WASM=${wasmOut}`);
      }
    }

    console.log('\nWASM correctness verified against JS for 256 cycles');
  });
});
