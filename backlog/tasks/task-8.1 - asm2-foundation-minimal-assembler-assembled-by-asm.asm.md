---
id: task-8.1
title: asm2 foundation - minimal assembler assembled by asm.asm
status: To Do
assignee: []
created_date: '2025-12-11 09:25'
labels:
  - '6502'
  - assembler
  - tdd
dependencies: []
parent_task_id: task-8
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the basic asm2 skeleton that can be assembled by asm.asm and assemble simple programs.

## TDD Approach
1. Write TypeScript tests that load asm2.bin and verify it can assemble simple test programs
2. Tests should compare output against known-good binaries from stage0 assembler
3. Start with the simplest possible programs and incrementally add instruction support

## Implementation
- Basic two-pass assembler structure
- Label table management
- All standard 6502 addressing modes
- ORG, BYTE, WORD directives
- Error reporting with line numbers
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Tests written BEFORE implementation (TDD red-green-refactor)
- [ ] #2 asm.asm successfully assembles asm2.asm
- [ ] #3 asm2 can assemble simple test programs (NOP, LDA, STA, branches)
- [ ] #4 Output matches stage0 assembler for identical input
- [ ] #5 Error messages include line numbers
<!-- AC:END -->
