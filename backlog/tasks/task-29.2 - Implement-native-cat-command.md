---
id: task-29.2
title: Implement native cat command
status: To Do
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
1. Parse filename from command line args
2. Call fopen syscall to open file
3. Loop: fread into buffer, putchar each byte
4. Call fclose syscall
5. Exit

**Assembly source:** Will be compiled with NativeAssembler at boot disk creation time.

## Acceptance Criteria

- [ ] CAT.BIN is a real RISC-V executable (not a stub)
- [ ] Can display text files (README.TXT, HELLO.ASM)
- [ ] Handles file not found error
- [ ] Same output as TypeScript built-in version
- [ ] 3+ tests for native cat
