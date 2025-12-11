---
id: task-11.4
title: Add .DW (define word) directive to asm.asm
status: Done
assignee: []
created_date: '2025-12-11 10:21'
updated_date: '2025-12-11 10:43'
labels:
  - '6502'
  - assembler
  - enhancement
  - tdd
dependencies: []
parent_task_id: task-11
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
While fixing .DB, we should also add .DW (define word) directive for 16-bit values.

## Expected Behavior
`.DW` should emit 16-bit words in little-endian format (6502 byte order):
- `.DW $1234` emits `$34 $12`
- `.DW LABEL` emits address of LABEL
- `.DW $1000, $2000` emits multiple words

## Use Cases
- Jump tables: `.DW handler1, handler2, handler3`
- Address pointers: `.DW BUFFER_START`
- 16-bit data values

## TDD Approach
1. Write failing test for .DW directive
2. Implement similar to .DB but emit 2 bytes per value
3. Verify little-endian byte order
4. Test with labels (forward and backward refs)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Failing test written for .DW BEFORE implementation
- [x] #2 .DW $xxxx emits two bytes in little-endian order
- [x] #3 .DW LABEL resolves to label address
- [x] #4 .DW with multiple values works
- [x] #5 Test passes after implementation
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Already Implemented (2025-12-11)

.DW directive was already implemented in asm.asm at DIR_DW (line 936).

Added test TESTDW.ASM to verify:

- `.DW $1234` emits `$34 $12` (little-endian)

- `.DW $ABCD` emits `$CD $AB`

All 278 tests pass.
<!-- SECTION:NOTES:END -->
