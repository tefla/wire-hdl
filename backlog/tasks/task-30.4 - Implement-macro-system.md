---
id: task-30.4
title: Implement macro system (.macro/.endmacro)
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

Implement a macro preprocessor system with parameterized macros.

**Syntax:**
```assembly
.macro PUSH reg
        ADDI sp, sp, -4
        SW \reg, 0(sp)
.endmacro

.macro POP reg
        LW \reg, 0(sp)
        ADDI sp, sp, 4
.endmacro

; Usage:
        PUSH a0
        PUSH a1
        ; ... code ...
        POP a1
        POP a0
```

**Features:**
- Define macros with `.macro name [params]`
- End with `.endmacro`
- Parameters referenced with `\param` or `%param`
- Parameter substitution during expansion
- Macros expanded before assembly
- Nested macro invocations

**Implementation:**
- First pass: Collect macro definitions
- Store in macro table with body and parameters
- Second pass: Expand macro invocations inline
- Replace parameter references with actual values
- Then assemble expanded code

## Acceptance Criteria

- [x] .macro/.endmacro directives work
- [x] Macros can have 0-8 parameters
- [x] Parameter substitution works with \param syntax
- [x] Macros can invoke other macros
- [x] Macro expansion happens before assembly
- [x] 5+ tests for macro functionality
