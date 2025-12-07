import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser/index.js';
import { BehavioralCompiler } from '../src/compiler/behavioral-compiler.js';

describe('Composable Behavioral Modules', () => {
  it('should parse function calls in behavioral blocks', () => {
    const source = `
module add8(a:8, b:8) -> sum:8:
  @behavior {
    sum = a + b
  }

module add16(a:16, b:16) -> sum:16:
  @behavior {
    let lo:8 = add8(a[7:0], b[7:0])
    let hi:8 = add8(a[15:8], b[15:8])
    sum = (hi << 8) | lo
  }
`;
    const ast = parse(source);
    expect(ast.modules).toHaveLength(2);

    const add16 = ast.modules[1];
    expect(add16.behavior).toBeDefined();
    expect(add16.behavior!.body).toHaveLength(3);

    // Check first let statement has a call expression
    const letLo = add16.behavior!.body[0];
    expect(letLo.type).toBe('LetStatement');
    if (letLo.type === 'LetStatement') {
      expect(letLo.init.type).toBe('BehavioralCallExpr');
      if (letLo.init.type === 'BehavioralCallExpr') {
        expect(letLo.init.moduleName).toBe('add8');
        expect(letLo.init.args).toHaveLength(2);
      }
    }
  });

  it('should compile and execute composable behaviors', () => {
    // Simple example: double uses add
    const source = `
module add8(a:8, b:8) -> sum:8:
  @behavior {
    sum = a + b
  }

module double(x:8) -> out:8:
  @behavior {
    out = add8(x, x)
  }
`;
    const ast = parse(source);
    const compiler = new BehavioralCompiler();
    const modules = compiler.compileAll(ast);

    expect(modules.size).toBe(2);
    expect(modules.has('add8')).toBe(true);
    expect(modules.has('double')).toBe(true);

    // Test add8 directly
    const add8 = modules.get('add8')!;
    expect(add8({ a: 10, b: 20 })).toEqual({ sum: 30 });
    expect(add8({ a: 200, b: 100 })).toEqual({ sum: 300 & 0xFF }); // 8-bit truncation

    // Test double which calls add8
    const double = modules.get('double')!;
    expect(double({ x: 10 }, undefined, modules)).toEqual({ out: 20 });
    expect(double({ x: 100 }, undefined, modules)).toEqual({ out: 200 });
    expect(double({ x: 200 }, undefined, modules)).toEqual({ out: 400 & 0xFF }); // 144 due to 8-bit wrap
  });

  it('should handle ALU calling other modules', () => {
    // Simple single-output modules to avoid multi-output complexity
    const source = `
module add8(a:8, b:8) -> sum:8:
  @behavior {
    sum = a + b
  }

module sub8(a:8, b:8) -> diff:8:
  @behavior {
    diff = a - b
  }

module alu(a:8, b:8, op:2) -> result:8:
  @behavior {
    match op {
      0 => {
        result = add8(a, b)
      }
      1 => {
        result = sub8(a, b)
      }
      2 => {
        result = a & b
      }
      _ => {
        result = a | b
      }
    }
  }
`;
    const ast = parse(source);
    const compiler = new BehavioralCompiler();
    const modules = compiler.compileAll(ast);

    expect(modules.size).toBe(3);

    const alu = modules.get('alu')!;

    // Test ADD (op=0)
    const addResult = alu({ a: 10, b: 5, op: 0 }, undefined, modules);
    expect(addResult.result).toBe(15);

    // Test SUB (op=1)
    const subResult = alu({ a: 10, b: 3, op: 1 }, undefined, modules);
    expect(subResult.result).toBe(7);

    // Test AND (op=2)
    const andResult = alu({ a: 0b11110000, b: 0b10101010, op: 2 }, undefined, modules);
    expect(andResult.result).toBe(0b10100000);

    // Test OR (op=3)
    const orResult = alu({ a: 0b11110000, b: 0b00001111, op: 3 }, undefined, modules);
    expect(orResult.result).toBe(0b11111111);
  });

  it('should handle deeply nested module calls', () => {
    const source = `
module inc(x:8) -> out:8:
  @behavior {
    out = x + 1
  }

module inc2(x:8) -> out:8:
  @behavior {
    let t:8 = inc(x)
    out = inc(t)
  }

module inc4(x:8) -> out:8:
  @behavior {
    let t:8 = inc2(x)
    out = inc2(t)
  }
`;
    const ast = parse(source);
    const compiler = new BehavioralCompiler();
    const modules = compiler.compileAll(ast);

    const inc4 = modules.get('inc4')!;
    const result = inc4({ x: 10 }, undefined, modules);
    expect(result.out).toBe(14);
  });
});
