import { describe, it, expect } from 'vitest';
import { parse, elaborate } from '../src/index.js';

describe('Debug register8', () => {
  it('should correctly wire register8 outputs', () => {
    const source = `
      module register(d, en, clk) -> q:
        mux_out = mux(q, d, en)
        q = dff(mux_out, clk)

      module mux(a, b, sel) -> out:
        not_sel = nand(sel, sel)
        a_and_not_sel = and(a, not_sel)
        b_and_sel = and(b, sel)
        out = or(a_and_not_sel, b_and_sel)

      module and(a, b) -> out:
        nand_out = nand(a, b)
        out = nand(nand_out, nand_out)

      module or(a, b) -> out:
        not_a = nand(a, a)
        not_b = nand(b, b)
        out = nand(not_a, not_b)

      module register8(d:8, en, clk) -> q:8:
        q0 = register(d[0], en, clk)
        q1 = register(d[1], en, clk)
        q2 = register(d[2], en, clk)
        q3 = register(d[3], en, clk)
        q4 = register(d[4], en, clk)
        q5 = register(d[5], en, clk)
        q6 = register(d[6], en, clk)
        q7 = register(d[7], en, clk)
        q = concat(q7, q6, q5, q4, q3, q2, q1, q0)

      module outer(x:8, en, clk) -> out:8:
        ir = register8(x, en, clk)
        out = ir
    `;

    const program = parse(source);
    const netlist = elaborate(program, 'outer');

    console.log('All signals:');
    for (const [name, id] of netlist.signalMap) {
      if (name.includes('ir') || name.includes('out[')) {
        console.log(`  ${name}: ${id}`);
      }
    }

    // Check ir[0]
    const ir0Id = netlist.signalMap.get('ir[0]');
    console.log(`\nir[0] ID: ${ir0Id}`);
    const ir0Gates = netlist.nandGates.filter(g => g.out === ir0Id);
    console.log(`Gates producing ir[0]: ${ir0Gates.length}`);

    // Check ir.q[0]
    const irQ0Id = netlist.signalMap.get('ir.q[0]');
    console.log(`\nir.q[0] ID: ${irQ0Id}`);
    const irQ0Gates = netlist.nandGates.filter(g => g.out === irQ0Id);
    console.log(`Gates producing ir.q[0]: ${irQ0Gates.length}`);

    // Check out[0]
    const out0Id = netlist.signalMap.get('out[0]');
    console.log(`\nout[0] ID: ${out0Id}`);

    // Print first 10 gates
    console.log('\nFirst 20 gates:');
    for (const gate of netlist.nandGates.slice(0, 20)) {
      const in1Name = netlist.signals[gate.in1]?.name || `?${gate.in1}`;
      const in2Name = netlist.signals[gate.in2]?.name || `?${gate.in2}`;
      const outName = netlist.signals[gate.out]?.name || `?${gate.out}`;
      console.log(`  NAND(${in1Name}, ${in2Name}) -> ${outName}`);
    }

    // ir[0] should have gates producing it (DFF outputs)
    // For single-output modules, use ir[0] not ir.q[0]
    expect(ir0Gates.length).toBeGreaterThan(0);
  });
});
