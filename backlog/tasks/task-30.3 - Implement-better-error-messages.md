---
id: task-30.3
title: Implement better error messages with line numbers
status: To Do
assignee: []
created_date: '2025-12-11 14:25'
labels:
  - riscv
  - assembler
  - enhancement
  - dx
parent: task-30
dependencies: []
priority: medium
---

## Description

Improve error reporting in NativeAssembler to include line numbers and context.

**Current Errors:**
```
Error: Unknown instruction: ADDX
```

**Enhanced Errors:**
```
Error at line 42: Unknown instruction: ADDX
  41 |         ADDI a0, zero, 10
  42 |         ADDX a1, a2, a3
     |         ^^^^
  43 |         ECALL
```

**Features:**
- Track line numbers during assembly
- Show line number in error message
- Show context (surrounding lines)
- Point to error location with caret (^)
- Include instruction/directive name in error

## Acceptance Criteria

- [x] Error messages include line numbers
- [x] Show context lines around error
- [x] Highlight error location with caret
- [x] All error types show line info (unknown instruction, invalid operand, undefined label, etc.)
- [x] 3+ tests for error reporting
