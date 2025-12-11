---
id: task-29.4
title: Implement native echo command
status: To Do
assignee: []
created_date: '2025-12-11 18:00'
labels:
  - riscv
  - shell
  - native
parent: task-29
priority: low
---

## Description

Implement the `echo` command as a native RISC-V program that prints its arguments.

**Program flow:**
1. Get command line args from memory
2. Loop through args, putchar each character
3. Print space between args
4. Print newline at end
5. Exit

This is the simplest native command - good starting point.

## Acceptance Criteria

- [ ] ECHO.BIN is a real RISC-V executable
- [ ] Prints all arguments with spaces
- [ ] Ends with newline
- [ ] Same output as TypeScript built-in version
- [ ] 2+ tests for native echo
