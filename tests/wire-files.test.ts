import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { parse, elaborate, levelize, Simulator } from '../src/index.js';

const WIRE_DIR = '/Users/tim/dev/playground/dead-silicon/src/assets/wire';

describe('Wire File Parsing', () => {
  const files = readdirSync(WIRE_DIR).filter(f => f.endsWith('.wire'));

  for (const file of files) {
    it(`should parse ${file}`, () => {
      const source = readFileSync(join(WIRE_DIR, file), 'utf-8');

      try {
        const program = parse(source);
        expect(program.modules.length).toBeGreaterThan(0);
        console.log(`  ✓ ${file}: ${program.modules.length} modules`);
      } catch (e: any) {
        console.log(`  ✗ ${file}: ${e.message}`);
        throw e;
      }
    });
  }
});

describe('Wire File Elaboration', () => {
  // Read common dependencies
  const gatesSource = readFileSync(join(WIRE_DIR, 'gates.wire'), 'utf-8');
  const arithmeticSource = readFileSync(join(WIRE_DIR, 'arithmetic.wire'), 'utf-8');
  const registersSource = readFileSync(join(WIRE_DIR, 'registers.wire'), 'utf-8');

  // Test files with their top module names and dependencies
  // Note: adder4/adder8 use multi-output modules which need elaborator enhancement
  const testCases: [string, string, string][] = [
    ['gates.wire', 'xor8', gatesSource],
    ['gates.wire', 'mux', gatesSource],
    ['gates.wire', 'and3', gatesSource],
    ['gates.wire', 'or3', gatesSource],
    ['arithmetic.wire', 'half_adder', gatesSource + '\n' + arithmeticSource],
    ['arithmetic.wire', 'full_adder', gatesSource + '\n' + arithmeticSource],
  ];

  for (const [file, topModule, source] of testCases) {
    it(`should elaborate ${file} (${topModule})`, () => {
      try {
        const program = parse(source);
        const netlist = elaborate(program, topModule);
        const levelized = levelize(netlist);

        console.log(`  ✓ ${file}/${topModule}:`);
        console.log(`    Signals: ${levelized.signals.length}`);
        console.log(`    NANDs: ${levelized.totalNands}`);
        console.log(`    DFFs: ${levelized.totalDffs}`);
        console.log(`    Levels: ${levelized.levels.length}`);

        expect(levelized.totalNands).toBeGreaterThan(0);
      } catch (e: any) {
        console.log(`  ✗ ${file}/${topModule}: ${e.message}`);
        throw e;
      }
    });
  }
});

describe('Wire File Simulation', () => {
  it('should simulate half_adder correctly', () => {
    const source = readFileSync(join(WIRE_DIR, 'arithmetic.wire'), 'utf-8');
    // Need gates.wire for dependencies
    const gatesSource = readFileSync(join(WIRE_DIR, 'gates.wire'), 'utf-8');

    const program = parse(gatesSource + '\n' + source);
    const netlist = elaborate(program, 'half_adder');
    const levelized = levelize(netlist);
    const sim = new Simulator(levelized);

    // Test all input combinations
    const testCases = [
      { a: 0, b: 0, sum: 0, carry: 0 },
      { a: 0, b: 1, sum: 1, carry: 0 },
      { a: 1, b: 0, sum: 1, carry: 0 },
      { a: 1, b: 1, sum: 0, carry: 1 },
    ];

    for (const tc of testCases) {
      sim.setInput('a', tc.a);
      sim.setInput('b', tc.b);
      sim.step();

      expect(sim.getOutput('sum')).toBe(tc.sum);
      expect(sim.getOutput('carry')).toBe(tc.carry);
    }
  });

  it('should simulate full_adder correctly', () => {
    const source = readFileSync(join(WIRE_DIR, 'arithmetic.wire'), 'utf-8');
    const gatesSource = readFileSync(join(WIRE_DIR, 'gates.wire'), 'utf-8');

    const program = parse(gatesSource + '\n' + source);
    const netlist = elaborate(program, 'full_adder');
    const levelized = levelize(netlist);
    const sim = new Simulator(levelized);

    // Test all 8 input combinations
    for (let a = 0; a <= 1; a++) {
      for (let b = 0; b <= 1; b++) {
        for (let cin = 0; cin <= 1; cin++) {
          sim.setInput('a', a);
          sim.setInput('b', b);
          sim.setInput('cin', cin);
          sim.step();

          const expected = a + b + cin;
          const expectedSum = expected & 1;
          const expectedCout = (expected >> 1) & 1;

          expect(sim.getOutput('sum')).toBe(expectedSum);
          expect(sim.getOutput('cout')).toBe(expectedCout);
        }
      }
    }
  });

  it('should simulate basic gates correctly', () => {
    const gatesSource = readFileSync(join(WIRE_DIR, 'gates.wire'), 'utf-8');

    // Test NOT gate
    {
      const program = parse(gatesSource);
      const netlist = elaborate(program, 'not');
      const levelized = levelize(netlist);
      const sim = new Simulator(levelized);

      sim.setInput('a', 0);
      sim.step();
      expect(sim.getOutput('out')).toBe(1);

      sim.setInput('a', 1);
      sim.step();
      expect(sim.getOutput('out')).toBe(0);
    }

    // Test AND gate
    {
      const program = parse(gatesSource);
      const netlist = elaborate(program, 'and');
      const levelized = levelize(netlist);
      const sim = new Simulator(levelized);

      for (let a = 0; a <= 1; a++) {
        for (let b = 0; b <= 1; b++) {
          sim.setInput('a', a);
          sim.setInput('b', b);
          sim.step();
          expect(sim.getOutput('out')).toBe(a & b);
        }
      }
    }

    // Test OR gate
    {
      const program = parse(gatesSource);
      const netlist = elaborate(program, 'or');
      const levelized = levelize(netlist);
      const sim = new Simulator(levelized);

      for (let a = 0; a <= 1; a++) {
        for (let b = 0; b <= 1; b++) {
          sim.setInput('a', a);
          sim.setInput('b', b);
          sim.step();
          expect(sim.getOutput('out')).toBe(a | b);
        }
      }
    }

    // Test XOR gate
    {
      const program = parse(gatesSource);
      const netlist = elaborate(program, 'xor');
      const levelized = levelize(netlist);
      const sim = new Simulator(levelized);

      for (let a = 0; a <= 1; a++) {
        for (let b = 0; b <= 1; b++) {
          sim.setInput('a', a);
          sim.setInput('b', b);
          sim.step();
          expect(sim.getOutput('out')).toBe(a ^ b);
        }
      }
    }
  });

  it('should simulate MUX correctly', () => {
    const gatesSource = readFileSync(join(WIRE_DIR, 'gates.wire'), 'utf-8');

    const program = parse(gatesSource);
    const netlist = elaborate(program, 'mux');
    const levelized = levelize(netlist);
    const sim = new Simulator(levelized);

    // sel=0 should select a
    sim.setInput('a', 1);
    sim.setInput('b', 0);
    sim.setInput('sel', 0);
    sim.step();
    expect(sim.getOutput('out')).toBe(1);

    // sel=1 should select b
    sim.setInput('a', 1);
    sim.setInput('b', 0);
    sim.setInput('sel', 1);
    sim.step();
    expect(sim.getOutput('out')).toBe(0);

    // Test all combinations
    for (let a = 0; a <= 1; a++) {
      for (let b = 0; b <= 1; b++) {
        for (let sel = 0; sel <= 1; sel++) {
          sim.setInput('a', a);
          sim.setInput('b', b);
          sim.setInput('sel', sel);
          sim.step();
          expect(sim.getOutput('out')).toBe(sel === 0 ? a : b);
        }
      }
    }
  });
});
