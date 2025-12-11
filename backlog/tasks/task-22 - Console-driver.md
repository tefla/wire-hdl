---
id: task-22
title: Console driver
status: Done
assignee: []
created_date: '2025-12-11 16:00'
labels:
  - riscv
  - console
  - driver
dependencies:
  - task-21
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a console driver that provides terminal-like functionality on top of the raw graphics card and keyboard.

**Features:**
- Cursor auto-advance after character output
- Newline handling (CR/LF)
- Screen scrolling when cursor reaches bottom
- Backspace handling (move cursor back, clear char)
- Line input with editing (readline-like)

**Implementation Options:**
1. **In CPU/Syscall layer** - Console logic in TypeScript, syscalls handle high-level ops
2. **In ROM** - Console routines in RISC-V assembly, loaded at boot
3. **Hybrid** - Basic ops in syscalls, advanced in loadable driver

**Recommended: Option 1 for simplicity**

**Console State:**
- Current cursor position (managed by syscalls)
- Current text attribute (color)
- Scroll region (full screen initially)
<!-- SECTION:DESCRIPTION:END -->

## Subtasks

- [x] task-22.1: Implement putchar with cursor advance and scroll
- [x] task-22.2: Implement newline and carriage return handling
- [x] task-22.3: Implement backspace handling
- [x] task-22.4: Implement line input (getline syscall)

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [x] Characters appear at cursor and cursor advances
- [x] Newline moves to start of next line
- [x] Screen scrolls when cursor reaches line 25
- [x] Backspace erases previous character
- [x] getline reads a full line with editing support
- [x] 10+ tests for console operations (24 tests implemented)
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
