---
id: task-8
title: Create asm2 - Extended assembler with macros (assembled by asm.asm)
status: To Do
assignee: []
created_date: '2025-12-11 09:01'
labels:
  - '6502'
  - assembler
  - enhancement
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a second-stage assembler (asm2) written in 6502 assembly that can be assembled by the existing asm.asm. This assembler will provide extended syntax and macro capabilities beyond what asm.asm supports.

## Goals
- **Self-bootstrapping chain**: asm.asm assembles asm2.asm, demonstrating the bootstrap capability
- **Extended syntax**: Support additional assembler directives and syntax sugar
- **Macro system**: Implement a macro preprocessor with parameterized macros

## Extended Syntax Ideas
- `.MACRO` / `.ENDMACRO` - Define reusable code blocks with parameters
- `.IF` / `.ELSE` / `.ENDIF` - Conditional assembly
- `.REPEAT` / `.ENDREP` - Loop constructs
- `.INCLUDE` - Include other source files
- `.STRUCT` / `.ENDSTRUCT` - Define structured data layouts
- Named local labels (e.g., `.loop` scoped to current macro/procedure)
- Expression evaluation with `+`, `-`, `*`, `/`, `<<`, `>>`, `&`, `|`

## Macro System Features
- Parameter substitution (e.g., `.MACRO ADD16 lo, hi`)
- Local labels within macros (auto-generated unique labels)
- Recursive macro expansion
- Built-in macros for common patterns (push/pop multiple registers, 16-bit operations)

## Architecture Considerations
- Must fit within memory constraints when assembled
- Two-pass design: first pass for macro expansion, second for assembly
- Error messages with line numbers and context
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 asm2.asm can be successfully assembled by asm.asm
- [ ] #2 Macro definitions work with `.MACRO name [params]` / `.ENDMACRO`
- [ ] #3 Macros support parameter substitution
- [ ] #4 Local labels work within macros (auto-uniquified)
- [ ] #5 Conditional assembly with `.IF` / `.ELSE` / `.ENDIF`
- [ ] #6 Expression evaluation supports basic arithmetic and bitwise operators
- [ ] #7 asm2 can assemble asm.asm (proving it's at least as capable)
- [ ] #8 Error messages include line numbers
<!-- AC:END -->
