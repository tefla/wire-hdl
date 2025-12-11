---
id: task-30.1
title: Implement constants (EQU directive)
status: Done
assignee: []
created_date: '2025-12-11 14:25'
labels:
  - riscv
  - assembler
  - enhancement
parent: task-30
dependencies: []
priority: high
---

## Description

Implement the EQU directive to define named constants in assembly code.

**Syntax:**
```assembly
CONST_NAME EQU value
```

**Example:**
```assembly
BUFFER_SIZE EQU 1024
BASE_ADDR EQU 0x1000

        LUI a0, BASE_ADDR
        ADDI a1, zero, BUFFER_SIZE
```

**Implementation:**
- First pass: Collect all EQU definitions
- Store in symbol table with their values
- Second pass: Replace constant names with values
- Support in immediate values and addresses

## Acceptance Criteria

- [x] EQU directive syntax works
- [x] Constants can be defined with numeric values
- [x] Constants can be used in immediate operands
- [x] Constants can be used in addresses
- [x] Undefined constant produces error
- [x] 3+ tests for EQU functionality
