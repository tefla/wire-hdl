// Tests for the behavioral compiler

import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser/parser.js';
import { compileBehavior, BehavioralCompiler } from '../src/compiler/behavioral-compiler.js';

describe('Behavioral Compiler', () => {
  it('should compile simple addition', () => {
    const source = `
module add8(a:8, b:8) -> result:8:
  @behavior {
    result = a + b
  }
`;
    const ast = parse(source);
    const func = compileBehavior(ast.modules[0]);
    expect(func).not.toBeNull();

    const result = func!({ a: 5, b: 3 });
    expect(result.result).toBe(8);
  });

  it('should mask result to output width', () => {
    const source = `
module add8(a:8, b:8) -> result:8:
  @behavior {
    result = a + b
  }
`;
    const ast = parse(source);
    const func = compileBehavior(ast.modules[0]);

    // 250 + 10 = 260, but masked to 8 bits = 4
    const result = func!({ a: 250, b: 10 });
    expect(result.result).toBe(4);
  });

  it('should handle let statements', () => {
    const source = `
module adder(a:8, b:8) -> out:9:
  @behavior {
    let temp:9 = a + b
    out = temp
  }
`;
    const ast = parse(source);
    const func = compileBehavior(ast.modules[0]);

    const result = func!({ a: 250, b: 10 });
    expect(result.out).toBe(260); // 9-bit can hold 260
  });

  it('should handle if statements', () => {
    const source = `
module mux(sel, a, b) -> out:
  @behavior {
    if sel == 1 {
      out = a
    } else {
      out = b
    }
  }
`;
    const ast = parse(source);
    const func = compileBehavior(ast.modules[0]);

    // 1-bit output: 42 & 1 = 0, 99 & 1 = 1
    expect(func!({ sel: 1, a: 42, b: 99 }).out).toBe(0); // a=42, 42&1=0
    expect(func!({ sel: 0, a: 42, b: 99 }).out).toBe(1); // b=99, 99&1=1
    expect(func!({ sel: 1, a: 1, b: 0 }).out).toBe(1);   // a=1
    expect(func!({ sel: 0, a: 1, b: 0 }).out).toBe(0);   // b=0
  });

  it('should handle mux with proper widths', () => {
    const source = `
module mux8(sel, a:8, b:8) -> out:8:
  @behavior {
    if sel == 1 {
      out = a
    } else {
      out = b
    }
  }
`;
    const ast = parse(source);
    const func = compileBehavior(ast.modules[0]);

    expect(func!({ sel: 1, a: 42, b: 99 }).out).toBe(42);
    expect(func!({ sel: 0, a: 42, b: 99 }).out).toBe(99);
  });

  it('should handle bitwise operators', () => {
    const source = `
module bitwise(a:8, b:8) -> out:8:
  @behavior {
    out = a & b
  }
`;
    const ast = parse(source);
    const func = compileBehavior(ast.modules[0]);

    expect(func!({ a: 0xFF, b: 0x0F }).out).toBe(0x0F);
  });

  it('should handle or and xor', () => {
    const source = `
module logic(a:8, b:8) -> or_out:8, xor_out:8:
  @behavior {
    or_out = a | b
    xor_out = a ^ b
  }
`;
    const ast = parse(source);
    const func = compileBehavior(ast.modules[0]);

    const result = func!({ a: 0xF0, b: 0x0F });
    expect(result.or_out).toBe(0xFF);
    expect(result.xor_out).toBe(0xFF);
  });

  it('should handle shift operators', () => {
    const source = `
module shift(a:8) -> left:8, right:8:
  @behavior {
    left = a << 2
    right = a >> 2
  }
`;
    const ast = parse(source);
    const func = compileBehavior(ast.modules[0]);

    const result = func!({ a: 0x10 });
    expect(result.left).toBe(0x40);
    expect(result.right).toBe(0x04);
  });

  it('should handle unary not', () => {
    const source = `
module invert(a:8) -> out:8:
  @behavior {
    out = ~a
  }
`;
    const ast = parse(source);
    const func = compileBehavior(ast.modules[0]);

    // ~0x0F = 0xFFFFFFF0, masked to 8 bits = 0xF0
    const result = func!({ a: 0x0F });
    expect(result.out).toBe(0xF0);
  });

  it('should handle ternary expressions', () => {
    const source = `
module ternary(sel, a:8, b:8) -> out:8:
  @behavior {
    out = sel ? a : b
  }
`;
    const ast = parse(source);
    const func = compileBehavior(ast.modules[0]);

    expect(func!({ sel: 1, a: 42, b: 99 }).out).toBe(42);
    expect(func!({ sel: 0, a: 42, b: 99 }).out).toBe(99);
  });

  it('should handle bit indexing', () => {
    const source = `
module bit_access(a:8) -> b0, b7:
  @behavior {
    b0 = a[0]
    b7 = a[7]
  }
`;
    const ast = parse(source);
    const func = compileBehavior(ast.modules[0]);

    const result = func!({ a: 0x81 }); // bit 0 and 7 set
    expect(result.b0).toBe(1);
    expect(result.b7).toBe(1);

    const result2 = func!({ a: 0x7E }); // all bits except 0 and 7
    expect(result2.b0).toBe(0);
    expect(result2.b7).toBe(0);
  });

  it('should handle bit slicing', () => {
    const source = `
module slice(a:8) -> high:4, low:4:
  @behavior {
    high = a[7:4]
    low = a[3:0]
  }
`;
    const ast = parse(source);
    const func = compileBehavior(ast.modules[0]);

    const result = func!({ a: 0xAB });
    expect(result.high).toBe(0x0A);
    expect(result.low).toBe(0x0B);
  });

  it('should handle match statements', () => {
    const source = `
module decoder(op:2) -> out:4:
  @behavior {
    match op {
      0 => out = 1
      1 => out = 2
      2 => out = 4
      _ => out = 8
    }
  }
`;
    const ast = parse(source);
    const func = compileBehavior(ast.modules[0]);

    expect(func!({ op: 0 }).out).toBe(1);
    expect(func!({ op: 1 }).out).toBe(2);
    expect(func!({ op: 2 }).out).toBe(4);
    expect(func!({ op: 3 }).out).toBe(8);
  });

  it('should handle match with range patterns', () => {
    const source = `
module range(val:4) -> out:
  @behavior {
    match val {
      0..3 => out = 0
      4..7 => out = 1
      _ => out = 0
    }
  }
`;
    const ast = parse(source);
    const func = compileBehavior(ast.modules[0]);

    expect(func!({ val: 0 }).out).toBe(0);
    expect(func!({ val: 3 }).out).toBe(0);
    expect(func!({ val: 4 }).out).toBe(1);
    expect(func!({ val: 7 }).out).toBe(1);
    expect(func!({ val: 8 }).out).toBe(0);
  });

  it('should handle comparison operators', () => {
    const source = `
module compare(a:8, b:8) -> eq, lt, gt:
  @behavior {
    eq = a == b
    lt = a < b
    gt = a > b
  }
`;
    const ast = parse(source);
    const func = compileBehavior(ast.modules[0]);

    expect(func!({ a: 5, b: 5 }).eq).toBe(1);
    expect(func!({ a: 5, b: 5 }).lt).toBe(0);
    expect(func!({ a: 5, b: 5 }).gt).toBe(0);

    expect(func!({ a: 3, b: 5 }).eq).toBe(0);
    expect(func!({ a: 3, b: 5 }).lt).toBe(1);
    expect(func!({ a: 3, b: 5 }).gt).toBe(0);

    expect(func!({ a: 7, b: 5 }).eq).toBe(0);
    expect(func!({ a: 7, b: 5 }).lt).toBe(0);
    expect(func!({ a: 7, b: 5 }).gt).toBe(1);
  });

  it('should handle ALU-like module', () => {
    const source = `
module alu8(a:8, b:8, op:3) -> result:8, zero:
  @behavior {
    if op == 0 {
      result = a + b
    } else if op == 1 {
      result = a - b
    } else if op == 2 {
      result = a & b
    } else if op == 3 {
      result = a | b
    } else if op == 4 {
      result = a ^ b
    } else {
      result = 0
    }

    zero = result == 0
  }
`;
    const ast = parse(source);
    const func = compileBehavior(ast.modules[0]);

    // ADD
    expect(func!({ a: 5, b: 3, op: 0 }).result).toBe(8);

    // SUB
    expect(func!({ a: 10, b: 3, op: 1 }).result).toBe(7);

    // AND
    expect(func!({ a: 0xFF, b: 0x0F, op: 2 }).result).toBe(0x0F);

    // OR
    expect(func!({ a: 0xF0, b: 0x0F, op: 3 }).result).toBe(0xFF);

    // XOR
    expect(func!({ a: 0xFF, b: 0x0F, op: 4 }).result).toBe(0xF0);

    // Zero flag
    expect(func!({ a: 5, b: 5, op: 1 }).zero).toBe(1);
    expect(func!({ a: 5, b: 3, op: 1 }).zero).toBe(0);
  });

  it('should return null for modules without @behavior', () => {
    const source = `
module and(a, b) -> out:
  n = nand(a, b)
  out = nand(n, n)
`;
    const ast = parse(source);
    const func = compileBehavior(ast.modules[0]);
    expect(func).toBeNull();
  });

  describe('BehavioralCompiler class', () => {
    it('should cache compiled functions', () => {
      const source = `
module add8(a:8, b:8) -> result:8:
  @behavior {
    result = a + b
  }
`;
      const ast = parse(source);
      const compiler = new BehavioralCompiler();

      const func1 = compiler.compile(ast.modules[0]);
      const func2 = compiler.compile(ast.modules[0]);

      expect(func1).toBe(func2); // Same reference (cached)
    });

    it('should check if module is compiled', () => {
      const source = `
module add8(a:8, b:8) -> result:8:
  @behavior {
    result = a + b
  }
`;
      const ast = parse(source);
      const compiler = new BehavioralCompiler();

      expect(compiler.has('add8')).toBe(false);
      compiler.compile(ast.modules[0]);
      expect(compiler.has('add8')).toBe(true);
    });
  });
});
