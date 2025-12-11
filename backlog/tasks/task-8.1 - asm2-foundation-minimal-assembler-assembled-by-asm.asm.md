---
id: task-8.1
title: asm2 foundation - minimal assembler assembled by asm.asm
status: In Progress
assignee: []
created_date: '2025-12-11 09:25'
updated_date: '2025-12-11 17:56'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Progress (Dec 11)
- Added ASM2.ASM to disk image SRC directory
- Fixed 24 label collision groups in asm2.asm (same issue as asm.asm)
- Stage0 TypeScript assembler successfully assembles asm2.asm to 4894 bytes
- ASM2.COM is precompiled and functional

**Issue Found:** Native AS.COM fails to assemble asm2.asm with "Undefined symbol at line $008C" error. This affects forward references with < > operators. The stage0 assembler handles this correctly, so ASM2.COM is precompiled by stage0 for now.

TODO: Investigate why native AS.COM fails on asm2.asm forward refs
<!-- SECTION:NOTES:END -->
