---
id: task-21
title: ECALL syscall handler
status: Done
assignee: []
created_date: '2025-12-11 16:00'
labels:
  - riscv
  - syscall
  - os
dependencies:
  - task-20
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement system call handling via ECALL instruction. Currently ECALL halts the CPU - instead it should dispatch to syscall handlers based on the a7 register.

**Syscall Convention (Linux-like):**
- a7 = syscall number
- a0-a6 = arguments
- a0 = return value

**Initial Syscalls:**
| Number | Name | Args | Description |
|--------|------|------|-------------|
| 0 | exit | a0=code | Halt CPU with exit code |
| 1 | putchar | a0=char | Write char to console |
| 2 | getchar | - | Read char from keyboard (blocking) |
| 3 | puts | a0=addr | Print null-terminated string |
| 4 | read_sector | a0=sector, a1=buf | Read disk sector |
| 5 | write_sector | a0=sector, a1=buf | Write disk sector |

**Implementation:**
- Modify ECALL handling in cpu.ts
- Add syscall dispatcher
- Implement each syscall handler
- Non-blocking getchar returns -1 if no key available
<!-- SECTION:DESCRIPTION:END -->

## Subtasks

- [x] task-21.1: Implement syscall dispatcher in CPU
- [x] task-21.2: Implement console syscalls (putchar, getchar, puts)
- [x] task-21.3: Implement disk syscalls (read_sector, write_sector)

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [x] ECALL dispatches based on a7 register
- [x] putchar writes to screen at cursor position
- [x] getchar reads from keyboard buffer
- [x] puts prints string to screen
- [x] Disk syscalls work with storage controller
- [x] Exit syscall halts with exit code
- [x] 15+ tests for syscalls (18 tests implemented)
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
