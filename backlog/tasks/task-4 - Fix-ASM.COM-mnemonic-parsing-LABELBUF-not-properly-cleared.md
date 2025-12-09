---
id: task-4
title: Fix ASM.COM mnemonic parsing - LABELBUF not properly cleared
status: To Do
assignee: []
created_date: '2025-12-09 15:03'
labels:
  - assembler
  - asm.com
  - bug
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Current State:**
ASM.COM (Stage 1 assembler) now correctly parses:
- Comments (`;`)
- Blank lines
- `.ORG` directive
- EQU definitions (`LABEL = $VALUE`)
- Label definitions (`LABEL:`)

**Problem:**
When parsing mnemonics like `LDA #$4F`, LABELBUF shows stale data (e.g., `LDATE` instead of `LDA`). This suggests GET_LABEL isn't properly clearing/null-terminating the buffer when reading shorter labels/mnemonics after longer ones.

**Symptoms:**
- Error: "Unknown mnemonic at line $0013"  
- MNEMBUF shows `LDATE` when parsing `LDA`
- Test shows source correctly as `LDA #$4F ; 'O'`

**Investigation Needed:**
1. Check if LABELBUF is being properly null-terminated in GET_LABEL
2. Verify MNEMBUF copy in GT_LABEL handles null termination
3. Check if there's leftover data from previous longer labels (like `PUTCHAR`)

**Files:**
- `asm/asm.asm` - GET_LABEL (line ~1163), GT_LABEL (line ~1248), LOOKUP_MNEM (line ~1436)
- `tests/install-dir.test.ts` - "should run ASM TEST.ASM" test case

**Related Fixes Already Made:**
- Directive handlers jump to PL_DONE
- Y register preserved in DEFINE_LABEL/DEFINE_EQU
- GET_TOKEN no longer resets Y
- PRINT_ERROR saves message pointer on stack
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ASM.COM can assemble TEST.ASM without 'Unknown mnemonic' errors
- [ ] #2 Mnemonics LDA, JSR, etc. are parsed correctly after longer labels
- [ ] #3 Assembly completes pass 1 and pass 2 successfully
<!-- AC:END -->
