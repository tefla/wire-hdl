---
id: task-30.5
title: Implement expression evaluation in operands
status: To Do
assignee: []
created_date: '2025-12-11 14:25'
labels:
  - riscv
  - assembler
  - enhancement
parent: task-30
dependencies:
  - task-30.1
priority: medium
---

## Description

Support arithmetic expressions in operands instead of just literal values.

**Examples:**
```assembly
BUFFER_SIZE EQU 1024
BASE EQU 0x1000

        ADDI a0, zero, BUFFER_SIZE*2        ; 2048
        LUI a1, BASE+0x100                  ; 0x1100
        ADDI a2, zero, (10+5)*2             ; 30
        LW a3, BASE+8(a0)                   ; Offset calculation
```

**Operators:**
- Arithmetic: `+`, `-`, `*`, `/`, `%`
- Bitwise: `&`, `|`, `^`, `<<`, `>>`
- Parentheses for grouping: `(expr)`

**Features:**
- Parse expressions in immediate values
- Parse expressions in addresses/offsets
- Evaluate at assembly time (not runtime)
- Support constants in expressions
- Operator precedence: `*/%` before `+-`, bitwise last
- Parentheses override precedence

**Implementation:**
- Tokenize expression into numbers, operators, parens
- Build expression tree or use shunting-yard algorithm
- Evaluate recursively
- Replace with computed value

## Acceptance Criteria

- [x] Arithmetic operators (+, -, *, /, %) work
- [x] Bitwise operators (&, |, ^, <<, >>) work
- [x] Parentheses work for grouping
- [x] Constants can be used in expressions
- [x] Expressions work in immediate values
- [x] Expressions work in offsets
- [x] Correct operator precedence
- [x] 5+ tests for expression evaluation
