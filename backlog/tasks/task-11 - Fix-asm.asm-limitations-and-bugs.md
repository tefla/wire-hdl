---
id: task-11
title: Fix asm.asm limitations and bugs
status: Done
assignee: []
created_date: '2025-12-11 10:20'
updated_date: '2025-12-11 12:53'
labels:
  - '6502'
  - assembler
  - bugfix
  - tdd
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix critical limitations and bugs discovered in asm.asm (Stage 1 assembler) that prevent it from being a fully functional self-hosting assembler.

## Issues Discovered

### 1. 8KB Source Buffer Limit
The assembler loads the entire source file into SRC_BUF ($2000-$3FFF), which is only 8KB. Large files like asm.asm (~65KB) overflow this buffer and corrupt memory.

**Solution Options:**
- A) Stream-based parsing: Read source line-by-line from disk instead of loading entire file
- B) Larger buffer: Reorganize memory map to allow larger source files
- C) Multi-pass with disk: Store intermediate data on disk between passes

### 2. .DB Directive Not Working
The `.DB` (define byte) directive causes "Invalid addressing mode" errors. This is a standard assembler directive that should emit raw bytes.

### 3. Forward Reference Issues
JMP instructions with forward label references fail with "Invalid addressing mode". The two-pass assembly should resolve forward references in pass 2.

## Impact
These bugs prevent:
- Self-hosting (asm.asm can't assemble itself in the emulator)
- Using .DB for data definitions
- Natural code flow with forward jumps
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All bugs have regression tests written BEFORE fixes
- [x] #2 asm.asm can assemble files using .DB directive
- [x] #3 asm.asm can handle forward JMP references
- [x] #4 asm.asm can assemble larger source files (at least 16KB)
- [x] #5 All existing tests continue to pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Progress Update (2025-12-11)

### task-11.1: .DB Directive - NOT A BUG

Investigation revealed .DB actually works correctly. The original error was caused by forward JMP references, not .DB.

### task-11.2: Forward JMP References - FIXED

Added LABELREF flag to track label references and force absolute addressing mode. All tests pass.

All criteria met: asm.asm (75KB) successfully assembles itself using streaming I/O

Self-hosting verified with 281 tests passing
<!-- SECTION:NOTES:END -->
