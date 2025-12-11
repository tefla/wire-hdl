---
id: task-11.1
title: Fix .DB directive in asm.asm
status: Done
assignee: []
created_date: '2025-12-11 10:20'
updated_date: '2025-12-11 10:36'
labels:
  - '6502'
  - assembler
  - bugfix
  - tdd
dependencies: []
parent_task_id: task-11
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The `.DB` (define byte) directive causes "Invalid addressing mode" errors when used in assembly files.

## Current Behavior
```asm
DATA:
    .DB $00    ; Error: Invalid addressing mode
```

## Expected Behavior
`.DB` should emit raw bytes to the output. It should support:
- Single byte: `.DB $42`
- Multiple bytes: `.DB $01, $02, $03`
- Character strings: `.DB "Hello"`

## TDD Approach
1. Write failing test that tries to assemble a file with `.DB`
2. Analyze asm.asm to find where directive handling occurs
3. Fix the directive parser to recognize and handle `.DB`
4. Verify test passes

## Investigation Notes
- The error "Invalid addressing mode" suggests `.DB` is being parsed as an instruction
- Need to check the directive detection logic in asm.asm
- Compare with how `.ORG` directive is handled (which works)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Failing test written for .DB directive BEFORE fix
- [ ] #2 .DB $xx emits single byte
- [ ] #3 .DB $xx, $yy emits multiple bytes
- [ ] #4 .DB "string" emits ASCII bytes
- [ ] #5 Test passes after fix
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Investigation Result (2025-12-11)

The .DB directive actually works correctly in asm.asm. Testing revealed:

- TESTDB.ASM assembled successfully: `.DB $42, .DB $01,$02, RTS` → `42 01 02 60`

- TESTDB2.ASM (label + .DB) also worked: output matches stage0 assembler

The original error "Invalid addressing mode" was actually caused by forward JMP references, not .DB.

**Conclusion**: Not a bug. Closing as resolved.
<!-- SECTION:NOTES:END -->
