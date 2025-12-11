---
id: task-30
title: ASM2 - Enhanced assembler with macros and expressions
status: Done
assignee: []
created_date: '2025-12-11 14:25'
labels:
  - riscv
  - assembler
  - enhancement
  - self-hosting
dependencies:
  - task-29
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create ASM2, an enhanced assembler that extends the basic ASM.BIN with advanced features. ASM2 is written in TypeScript (in NativeAssembler) and can be invoked via the ASSEMBLE syscall, making it available to native programs.

**Bootstrap Chain:**
- ASM.BIN (native) uses ASSEMBLE syscall → TypeScript NativeAssembler (basic)
- ASM2 features added to NativeAssembler
- ASM.BIN can assemble programs using ASM2 features
- Eventually: Write ASM2.ASM (native assembler) that implements these features

**Key Features:**
1. **Constants (EQU)** - Named constants for better code readability
2. **Data Directives** - `.byte`, `.word`, `.string` for easier data definition
3. **Error Messages** - Line numbers and better error reporting
4. **Macros** - Reusable code blocks with parameters
5. **Expressions** - Arithmetic in operands (e.g., `BASE+10`, `SIZE*2`)

**Benefits:**
- More maintainable assembly code
- Reduced errors through constants and macros
- Faster development with better tooling
- Educational value showing assembler evolution
<!-- SECTION:DESCRIPTION:END -->

## Subtasks

- [x] task-30.1: Implement constants (EQU directive)
- [x] task-30.2: Implement data directives (.byte, .word, .string)
- [x] task-30.3: Implement better error messages with line numbers
- [x] task-30.4: Implement macro system (.macro/.endmacro)
- [x] task-30.5: Implement expression evaluation in operands

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [x] EQU directive defines named constants
- [x] Constants can be used in place of numeric values
- [x] .byte/.word/.string directives work correctly
- [x] Error messages include line numbers and context
- [x] Macros can be defined and invoked
- [x] Macro parameters are substituted correctly
- [x] Expressions with +, -, *, / work in operands
- [x] Can write and assemble complex programs using all features
- [x] 15+ tests for new features
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
