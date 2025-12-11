---
id: task-8.2
title: asm2 full compatibility - assemble asm.asm
status: To Do
assignee: []
created_date: '2025-12-11 09:25'
updated_date: '2025-12-11 09:25'
labels:
  - '6502'
  - assembler
  - tdd
dependencies:
  - task-8.1
  - task-8.3
  - task-8.4
  - task-8.5
  - task-8.6
  - task-8.7
  - task-8.8
parent_task_id: task-8
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Final validation that asm2 can assemble asm.asm, proving it's at least as capable as the original.

## TDD Approach
1. Write test that assembles asm.asm with asm2
2. Compare output binary with known-good asm.bin
3. Byte-for-byte comparison must match

## Success Criteria
This is the ultimate test of the bootstrap chain:
- stage0 (TypeScript) → asm.bin
- asm.bin → asm2.bin  
- asm2.bin → asm.bin (must match original)

If asm2 can produce identical output for asm.asm, the chain is complete.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Test assembles asm.asm using asm2
- [ ] #2 Output binary matches stage0-produced asm.bin exactly
- [ ] #3 Bootstrap chain validated: stage0→asm→asm2→asm
<!-- AC:END -->
