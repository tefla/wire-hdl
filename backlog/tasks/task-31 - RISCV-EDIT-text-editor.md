---
id: task-31
title: RISC-V EDIT - MS-DOS style text editor
status: To Do
assignee: []
created_date: '2025-12-11 15:00'
labels:
  - riscv
  - editor
  - native
  - feature
dependencies:
  - task-29
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build a full-screen text editor for RISC-V similar to MS-DOS EDIT. The editor should provide a comfortable editing experience for writing assembly programs and other text files.

**MS-DOS EDIT Features:**
- Full-screen text editing with ANSI terminal control
- File open/save operations
- Cursor navigation (arrow keys, page up/down, home/end)
- Text insertion and deletion
- Status bar showing filename, line/column, modified status
- Search/find functionality
- Keyboard shortcuts (Ctrl+S save, Ctrl+Q quit, etc.)

**Implementation Strategy:**
- Native RISC-V program (EDIT.BIN)
- Uses console syscalls for keyboard input and screen output
- Uses file syscalls for loading and saving
- ANSI escape sequences for cursor control and screen clearing
- In-memory text buffer with gap buffer or line-based structure

**Benefits:**
- Essential tool for writing assembly programs on the system
- Demonstrates full-screen terminal application programming
- Educational value showing text editor internals
- Improves development workflow
<!-- SECTION:DESCRIPTION:END -->

## Subtasks

- [ ] task-31.1: Terminal control and screen management
- [ ] task-31.2: Text buffer data structure
- [ ] task-31.3: File load/save operations
- [ ] task-31.4: Cursor navigation and display
- [ ] task-31.5: Text editing operations (insert/delete)
- [ ] task-31.6: Status bar and UI
- [ ] task-31.7: Search/find functionality
- [ ] task-31.8: Command interface and keyboard shortcuts

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] Can run EDIT <filename> to edit a file
- [ ] Full-screen interface with ANSI terminal control
- [ ] Arrow keys navigate cursor through text
- [ ] Can insert and delete text at cursor position
- [ ] Can save file with Ctrl+S
- [ ] Can exit with Ctrl+Q
- [ ] Status bar shows filename, line, column, and modified status
- [ ] Can search for text with Ctrl+F
- [ ] Handles files larger than screen (scrolling)
- [ ] Works on empty files (new file creation)
- [ ] 10+ tests for core functionality
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
