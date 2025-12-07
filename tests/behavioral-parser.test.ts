// Tests for the behavioral extension to the Wire HDL parser

import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser/parser.js';

describe('Behavioral Parser', () => {
  it('should parse a simple @behavior block', () => {
    const source = `
module add8(a:8, b:8) -> result:8:
  @behavior {
    result = a + b
  }
`;
    const ast = parse(source);
    expect(ast.modules).toHaveLength(1);
    const mod = ast.modules[0];
    expect(mod.name).toBe('add8');
    expect(mod.behavior).toBeDefined();
    expect(mod.behavior!.body).toHaveLength(1);
    expect(mod.behavior!.body[0].type).toBe('AssignStatement');
  });

  it('should parse let statements with width', () => {
    const source = `
module adder(a:8, b:8) -> out:9:
  @behavior {
    let temp:9 = a + b
    out = temp
  }
`;
    const ast = parse(source);
    const mod = ast.modules[0];
    expect(mod.behavior!.body).toHaveLength(2);

    const letStmt = mod.behavior!.body[0];
    expect(letStmt.type).toBe('LetStatement');
    if (letStmt.type === 'LetStatement') {
      expect(letStmt.name).toBe('temp');
      expect(letStmt.width).toBe(9);
    }
  });

  it('should parse if-else statements', () => {
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
    const mod = ast.modules[0];
    const ifStmt = mod.behavior!.body[0];
    expect(ifStmt.type).toBe('IfStatement');
    if (ifStmt.type === 'IfStatement') {
      expect(ifStmt.thenBranch).toHaveLength(1);
      expect(ifStmt.elseBranch).toBeDefined();
    }
  });

  it('should parse match statements', () => {
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
    const mod = ast.modules[0];
    const matchStmt = mod.behavior!.body[0];
    expect(matchStmt.type).toBe('MatchStatement');
    if (matchStmt.type === 'MatchStatement') {
      expect(matchStmt.arms).toHaveLength(4);
      expect(matchStmt.arms[3].pattern.type).toBe('WildcardPattern');
    }
  });

  it('should parse match with range patterns', () => {
    const source = `
module range_test(val:4) -> out:
  @behavior {
    match val {
      0..3 => out = 1
      4..7 => out = 0
      _ => out = 1
    }
  }
`;
    const ast = parse(source);
    const mod = ast.modules[0];
    const matchStmt = mod.behavior!.body[0];
    if (matchStmt.type === 'MatchStatement') {
      expect(matchStmt.arms[0].pattern.type).toBe('RangePattern');
      if (matchStmt.arms[0].pattern.type === 'RangePattern') {
        expect(matchStmt.arms[0].pattern.start).toBe(0);
        expect(matchStmt.arms[0].pattern.end).toBe(3);
      }
    }
  });

  it('should parse binary expressions with precedence', () => {
    const source = `
module expr_test(a:8, b:8) -> out:8:
  @behavior {
    out = a + b * 2
  }
`;
    const ast = parse(source);
    const mod = ast.modules[0];
    const stmt = mod.behavior!.body[0];
    if (stmt.type === 'AssignStatement') {
      // Should be: a + (b * 2)
      expect(stmt.value.type).toBe('BinaryExpr');
      if (stmt.value.type === 'BinaryExpr') {
        expect(stmt.value.op).toBe('+');
        expect(stmt.value.right.type).toBe('BinaryExpr');
      }
    }
  });

  it('should parse bitwise operators', () => {
    const source = `
module bitwise(a:8, b:8) -> out:8:
  @behavior {
    out = (a & b) | (a ^ b)
  }
`;
    const ast = parse(source);
    const mod = ast.modules[0];
    expect(mod.behavior).toBeDefined();
  });

  it('should parse shift operators', () => {
    const source = `
module shift(a:8) -> out:8:
  @behavior {
    out = (a << 2) | (a >> 4)
  }
`;
    const ast = parse(source);
    const mod = ast.modules[0];
    expect(mod.behavior).toBeDefined();
  });

  it('should parse unary operators', () => {
    const source = `
module unary(a:8) -> out:8:
  @behavior {
    out = ~a
  }
`;
    const ast = parse(source);
    const mod = ast.modules[0];
    const stmt = mod.behavior!.body[0];
    if (stmt.type === 'AssignStatement') {
      expect(stmt.value.type).toBe('UnaryExpr');
    }
  });

  it('should parse ternary expressions', () => {
    const source = `
module ternary(sel, a, b) -> out:
  @behavior {
    out = sel ? a : b
  }
`;
    const ast = parse(source);
    const mod = ast.modules[0];
    const stmt = mod.behavior!.body[0];
    if (stmt.type === 'AssignStatement') {
      expect(stmt.value.type).toBe('TernaryExpr');
    }
  });

  it('should parse bit indexing', () => {
    const source = `
module bit_access(a:8) -> out:
  @behavior {
    out = a[0]
  }
`;
    const ast = parse(source);
    const mod = ast.modules[0];
    const stmt = mod.behavior!.body[0];
    if (stmt.type === 'AssignStatement') {
      expect(stmt.value.type).toBe('BehavioralIndexExpr');
    }
  });

  it('should parse bit slicing', () => {
    const source = `
module bit_slice(a:8) -> out:4:
  @behavior {
    out = a[7:4]
  }
`;
    const ast = parse(source);
    const mod = ast.modules[0];
    const stmt = mod.behavior!.body[0];
    if (stmt.type === 'AssignStatement') {
      expect(stmt.value.type).toBe('BehavioralSliceExpr');
    }
  });

  it('should parse concat expressions with braces', () => {
    const source = `
module concat_test(a:4, b:4) -> out:8:
  @behavior {
    out = {a, b}
  }
`;
    const ast = parse(source);
    const mod = ast.modules[0];
    const stmt = mod.behavior!.body[0];
    if (stmt.type === 'AssignStatement') {
      expect(stmt.value.type).toBe('BehavioralConcatExpr');
    }
  });

  it('should parse hex numbers', () => {
    const source = `
module hex_test(a:8) -> out:8:
  @behavior {
    out = a + 0xFF
  }
`;
    const ast = parse(source);
    const mod = ast.modules[0];
    const stmt = mod.behavior!.body[0];
    if (stmt.type === 'AssignStatement' && stmt.value.type === 'BinaryExpr') {
      const right = stmt.value.right;
      if (right.type === 'BehavioralNumberExpr') {
        expect(right.value).toBe(255);
      }
    }
  });

  it('should parse hybrid modules with both behavior and structure', () => {
    const source = `
module hybrid(a, b) -> out:
  @behavior {
    out = a & b
  }

  @structure {
    n = nand(a, b)
    out = nand(n, n)
  }
`;
    const ast = parse(source);
    const mod = ast.modules[0];
    expect(mod.behavior).toBeDefined();
    expect(mod.structure).toBeDefined();
    expect(mod.structure!.statements).toHaveLength(2);
  });

  it('should still parse regular structural modules', () => {
    const source = `
module and(a, b) -> out:
  n = nand(a, b)
  out = nand(n, n)
`;
    const ast = parse(source);
    const mod = ast.modules[0];
    expect(mod.statements).toHaveLength(2);
    expect(mod.behavior).toBeUndefined();
  });

  it('should parse ALU-like module from spec', () => {
    const source = `
module alu8(a:8, b:8, op:3, carry_in) -> result:8, carry_out, zero, neg:
  @behavior {
    let temp:9 = 0

    if op == 0 {
      temp = a + b + carry_in
    } else if op == 1 {
      temp = a - b
    } else if op == 2 {
      temp = a & b
    } else if op == 3 {
      temp = a | b
    } else {
      temp = a ^ b
    }

    result = temp[7:0]
    carry_out = temp[8]
    zero = result == 0
    neg = result[7]
  }
`;
    const ast = parse(source);
    const mod = ast.modules[0];
    expect(mod.name).toBe('alu8');
    expect(mod.params).toHaveLength(4);
    expect(mod.outputs).toHaveLength(4);
    expect(mod.behavior).toBeDefined();
    expect(mod.behavior!.body.length).toBeGreaterThan(0);
  });
});
