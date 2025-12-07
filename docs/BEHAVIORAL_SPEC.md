# Wire HDL Behavioral Extension

## Overview

Wire HDL now supports two description styles:
- **Structural**: Build from gates/modules (existing, for education)
- **Behavioral**: Describe logic with expressions (new, for speed)

## Syntax

### Basic Behavioral Module

```wire
module alu8(a:8, b:8, op:3, carry_in) -> result:8, carry_out, zero, neg:
  @behavior {
    let temp:9 = 0

    if op == 0 {           // ADD
      temp = a + b + carry_in
    } else if op == 1 {    // SUB
      temp = a - b - !carry_in
    } else if op == 2 {    // AND
      temp = a & b
    } else if op == 3 {    // OR
      temp = a | b
    } else if op == 4 {    // XOR
      temp = a ^ b
    } else if op == 5 {    // ASL (shift left)
      temp = (a << 1) | carry_in
    } else if op == 6 {    // LSR (shift right)
      temp = a >> 1
      carry_out = a[0]
    }

    result = temp[7:0]
    carry_out = temp[8]
    zero = result == 0
    neg = result[7]
  }
```

### Expression Syntax

```
// Arithmetic
a + b          // Addition
a - b          // Subtraction

// Bitwise
a & b          // AND
a | b          // OR
a ^ b          // XOR
~a             // NOT
a << n         // Shift left by n
a >> n         // Shift right by n

// Comparison (returns 1-bit)
a == b         // Equal
a != b         // Not equal
a < b          // Less than (unsigned)
a > b          // Greater than (unsigned)

// Bit access
a[n]           // Single bit
a[hi:lo]       // Bit range (inclusive)

// Concatenation
{a, b, c}      // Combine bits: {4-bit, 4-bit} = 8-bit

// Conditional
cond ? x : y   // Ternary
```

### Control Flow

```wire
// If-else
if condition {
  ...
} else if condition2 {
  ...
} else {
  ...
}

// Match (like switch)
match value {
  0 => result = a + b
  1 => result = a - b
  2..5 => result = a & b   // Range match
  _ => result = 0          // Default
}
```

### Variables

```wire
// Local variables with explicit width
let temp:16 = 0
let flag:1 = 0

// Assignment
temp = a + b
result = temp[7:0]
```

## Module Types

### Structure Only (existing modules)
```wire
module and(a, b) -> out:
  n = nand(a, b)
  out = nand(n, n)
```
- Works in both modes
- Educational mode: simulates NANDs
- Fast mode: auto-optimized (simple cases)

### Behavior Only
```wire
module alu8(a:8, b:8, op:3) -> result:8:
  @behavior { ... }
```
- Fast mode: runs behavioral code
- Educational mode: error or falls back to behavioral

### Both (hybrid)
```wire
module adder8(a:8, b:8, cin) -> sum:8, cout:
  @behavior {
    let temp:9 = a + b + cin
    sum = temp[7:0]
    cout = temp[8]
  }

  @structure {
    fa0 = full_adder(a[0], b[0], cin)
    fa1 = full_adder(a[1], b[1], fa0.cout)
    // ... ripple carry chain
    sum = {fa7.sum, fa6.sum, ...}
    cout = fa7.cout
  }
```
- Fast mode: uses @behavior
- Educational mode: uses @structure (flattens to NANDs)

## Sequential Logic

DFFs are still explicit - behavioral code describes combinational logic only:

```wire
module counter8(clk, reset) -> count:8:
  // DFF for state
  state:8 = dff(next_state, clk)

  @behavior {
    if reset {
      next_state = 0
    } else {
      next_state = state + 1
    }
    count = state
  }
```

## Compilation

Behavioral blocks compile to TypeScript:

```wire
// Wire
@behavior {
  if op == 0 {
    result = a + b
  } else {
    result = a - b
  }
}
```

```typescript
// Generated TypeScript
function alu8_behavior(a: number, b: number, op: number): { result: number } {
  let result: number;
  if (op === 0) {
    result = (a + b) & 0xFF;
  } else {
    result = (a - b) & 0xFF;
  }
  return { result };
}
```

## Simulation Modes

```typescript
// API
const computer = new Computer({
  mode: 'fast',        // Use behavioral (default)
  // mode: 'educational' // Use structural/NAND
});
```

## Implementation Plan

1. **Parser**: Add lexer tokens for `@behavior`, `{`, `}`, `if`, `else`, `match`, `let`, operators
2. **AST**: Add BehaviorBlock node type with statement/expression trees
3. **Behavioral Compiler**: Transform AST to TypeScript functions
4. **Elaborator**: Choose behavioral vs structural based on mode
5. **Runtime**: Call generated functions during simulation

## Example: Full CPU Module

```wire
module cpu(clk, reset, data_in:8) -> addr:16, data_out:8, mem_write, halted:
  // Registers (DFFs)
  pc:16 = dff(next_pc, clk)
  a:8 = dff(next_a, clk)
  x:8 = dff(next_x, clk)
  y:8 = dff(next_y, clk)
  sp:8 = dff(next_sp, clk)
  flags:4 = dff(next_flags, clk)
  state:5 = dff(next_state, clk)

  @behavior {
    // Default: hold values
    next_pc = pc
    next_a = a
    next_x = x
    next_y = y
    next_sp = sp
    next_flags = flags
    next_state = state
    mem_write = 0
    halted = 0

    match state {
      0 => {  // FETCH
        addr = pc
        next_state = 1
      }
      1 => {  // DECODE
        let opcode:8 = data_in
        next_pc = pc + 1

        match opcode {
          0xA9 => next_state = 2   // LDA #imm
          0x8D => next_state = 10  // STA abs
          0x02 => halted = 1       // HLT
          // ... etc
        }
      }
      // ... more states
    }
  }
```

This would give us MHz-speed CPU simulation while keeping the wire language as the single source of truth.
