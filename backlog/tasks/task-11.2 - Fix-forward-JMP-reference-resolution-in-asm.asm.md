---
id: task-11.2
title: Fix forward JMP reference resolution in asm.asm
status: Done
assignee: []
created_date: '2025-12-11 10:20'
updated_date: '2025-12-11 10:40'
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
JMP instructions with forward label references fail with "Invalid addressing mode" errors.

## Current Behavior
```asm
    JMP START    ; Error: Invalid addressing mode at this line
    NOP
START:
    RTS
```

## Expected Behavior
Forward references should be resolved in pass 2 of the assembler:
- Pass 1: Collect all labels and their addresses
- Pass 2: Resolve forward references using the label table

## TDD Approach
1. Write failing test with forward JMP reference
2. Trace through asm.asm to understand current two-pass logic
3. Identify why forward references aren't being resolved
4. Fix the resolution logic
5. Verify test passes

## Investigation Notes
- Backward references work (BNE to earlier label)
- The issue may be in how undefined symbols are handled in pass 1
- May need to emit placeholder bytes in pass 1 and fill them in pass 2
- Check if the symbol table lookup works correctly for forward refs
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Failing test written for forward JMP BEFORE fix
- [x] #2 JMP to forward label assembles correctly
- [x] #3 JMP generates correct 3-byte output ($4C lo hi)
- [x] #4 Both forward and backward references work in same file
- [x] #5 Test passes after fix
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Bug Confirmed (2025-12-11)

TESTFWD.ASM test confirms the bug:

```

JMP START    ; Forward reference - FAILS

NOP

START:

RTS

```

Error: `Invalid addressing mode at line $0007`

The assembler fails when JMP references a label that hasn't been defined yet.

### Next Steps

1. Analyze asm.asm two-pass logic

2. Find why pass 2 doesn't resolve forward references for JMP

3. Implement fix

## Fix Implemented (2025-12-11)

**Root Cause:** Forward reference returned 0 -> OPERAND+1==0 -> AM_ZP selected -> JMP doesn't support zero page mode.

**Solution:** Added LABELREF flag ($67) that tracks when operand contains a label. When set, force absolute mode in PO_NO_INDEX.

**Changes:** Clear LABELREF in PARSE_EXPR, set it in PV_LABEL, check it in PO_NO_INDEX before addressing mode decision.

**Result:** TESTFWD.ASM assembles correctly: `$4C $04 $08 $EA $60`. All 278 tests pass.
<!-- SECTION:NOTES:END -->
