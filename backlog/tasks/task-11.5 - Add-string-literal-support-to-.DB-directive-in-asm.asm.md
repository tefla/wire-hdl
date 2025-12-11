---
id: task-11.5
title: Add string literal support to .DB directive in asm.asm
status: Done
assignee: []
created_date: '2025-12-11 11:36'
updated_date: '2025-12-11 12:53'
labels:
  - '6502'
  - assembler
  - enhancement
  - self-hosting
dependencies: []
parent_task_id: task-11
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The .DB directive currently only supports numeric expressions. To enable self-hosting (asm.asm assembling itself), string literals like `.DB "Hello"` must be supported.

## Current Behavior
```asm
.DB "Hello"  ; FAILS - tries to parse "Hello as a label
.DB $48, $65, $6C, $6C, $6F  ; Works - explicit bytes
```

## Required Behavior
```asm
.DB "Hello", $0D, $0A, 0  ; Should emit: 48 65 6C 6C 6F 0D 0A 00
.DB "A"  ; Should emit: 41
```

## Implementation Plan
Modify DIR_DB in asm.asm to:
1. Check if next character is `"` (double quote)
2. If so, enter string parsing mode:
   - Read characters until closing `"`
   - Emit each character as a byte
   - Handle escape sequences (optional): `\n`, `\r`, `\\`, `\"`
3. After string, continue checking for comma-separated values

## Key Code Location
- `DIR_DB:` routine around line 946 in asm.asm
- Currently calls `PARSE_EXPR` which doesn't handle strings

## Impact
This is the primary blocker for self-hosting. asm.asm uses ~20 string literals in .DB directives for error messages and prompts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Test written for .DB with string literal BEFORE implementation
- [ ] #2 .DB "text" emits correct ASCII bytes
- [ ] #3 Mixed format works: .DB "Hi", $0D, $0A, 0
- [ ] #4 Empty string .DB "" works (emits nothing)
- [ ] #5 Escaped quotes .DB "He said \"Hi\"" work (optional)
- [ ] #6 asm.asm can assemble itself (self-hosting achieved)
- [ ] #7 All existing tests still pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Modify DIR_DB in asm.asm to:
1. Check if next character is `"` (double quote)
2. If so, enter string parsing mode:
   - Read characters until closing `"`
   - Emit each character as a byte
   - Handle escape sequences (optional): `\n`, `\r`, `\\`, `\"`
3. After string, continue checking for comma-separated values

## Key Code Location
- `DIR_DB:` routine around line 946 in asm.asm
- Currently calls `PARSE_EXPR` which doesn't handle strings

## Impact
This is the primary blocker for self-hosting. asm.asm uses ~20 string literals in .DB directives for error messages and prompts.
<!-- SECTION:DESCRIPTION:END -->
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Completed: String literals now supported in .DB directive

Self-hosting verified: asm.asm successfully assembles itself (1594 bytes)

Fixed 24 label collision groups (8-char truncation) by renaming labels to unique prefixes

Fixed ADD_SYMBOL to return carry set when existing symbol found (prevents value overwrite)

All 281 tests pass
<!-- SECTION:NOTES:END -->
