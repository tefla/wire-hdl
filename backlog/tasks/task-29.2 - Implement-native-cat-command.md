---
id: task-29.2
title: Implement native cat command
status: Done
assignee: []
created_date: '2025-12-11 18:00'
labels:
  - riscv
  - shell
  - native
parent: task-29
dependencies:
  - task-29.1
priority: medium
---

## Description

Implement the `cat` command as a native RISC-V program that reads and displays file contents.

**Program flow:**
1. Parse filename from command line args (deferred - hardcoded to README.TXT)
2. Call fopen syscall to open file
3. Loop: fread into buffer, putchar each byte
4. Call fclose syscall
5. Exit

**Assembly source:** Will be compiled with NativeAssembler at boot disk creation time.

## Acceptance Criteria

- [x] CAT.BIN is a real RISC-V executable (not a stub)
- [x] Can display text files (README.TXT)
- [x] Handles file not found error
- [x] Same output as TypeScript built-in version
- [x] 3+ tests for native cat
