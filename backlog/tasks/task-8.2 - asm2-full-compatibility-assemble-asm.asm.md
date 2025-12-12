---
id: task-8.2
title: asm2 full compatibility - assemble asm.asm
status: To Do
assignee: []
created_date: '2025-12-11 09:25'
updated_date: '2025-12-12 08:17'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Investigation (Dec 12)

**Root Cause Found:** ASM2 cannot assemble ASM.ASM because:

1. **asm.asm uses source streaming** - 1KB buffer with automatic refill when parser crosses midpoint. This allows asm.asm to handle files larger than memory.

2. **asm2.asm tries to load entire file** - 8KB buffer at $2000-$3FFF. When loading 79KB asm.asm:
   - First 8KB goes to $2000-$3FFF (source buffer)
   - Next 8KB overwrites $4000-$5FFF (output buffer)
   - Next 4KB overwrites $6000-$6FFF (symbol table)
   - Memory continues wrapping, eventually overwriting zero page and assembler code itself

3. **The "Invalid addressing mode at line $014A" error** is meaningless - memory is corrupted before the assembler even starts parsing.

**Solutions:**
1. **Add streaming to asm2** - Copy STREAM_INIT, STREAM_REFILL, and PL_REFILL from asm.asm to asm2.asm. This is significant work but would make asm2 handle any file size.
2. **Accept limitation** - asm2 can only assemble files that fit in its 8KB buffer (~8000 chars of source).

**Note:** asm.asm itself is 3182 lines / 79KB. The streaming feature is essential for self-hosting.
<!-- SECTION:NOTES:END -->
