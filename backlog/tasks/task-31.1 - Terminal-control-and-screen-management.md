---
id: task-31.1
title: Terminal control and screen management
status: To Do
assignee: []
created_date: '2025-12-11 15:00'
labels:
  - riscv
  - editor
  - terminal
parent: task-31
dependencies: []
priority: high
---

## Description

Implement terminal control functions using ANSI escape sequences for managing the full-screen editor interface.

**ANSI Escape Sequences Needed:**
```
\x1b[2J        - Clear screen
\x1b[H         - Move cursor to home (0,0)
\x1b[<row>;<col>H - Move cursor to position
\x1b[K         - Clear from cursor to end of line
\x1b[?25l      - Hide cursor
\x1b[?25h      - Show cursor
\x1b[7m        - Reverse video (for status bar)
\x1b[0m        - Reset attributes
```

**Functions to Implement:**
- `clearScreen()` - Clear entire screen
- `moveCursor(row, col)` - Position cursor at row, col (0-based)
- `clearLine()` - Clear current line
- `hideCursor()` / `showCursor()` - Toggle cursor visibility
- `setReverse()` / `resetAttrs()` - Set/reset display attributes
- `getScreenSize()` - Get terminal dimensions (default 80x25)

**Implementation:**
- Helper functions that emit ANSI sequences via WRITE syscall
- Keep track of current cursor position
- Handle screen boundaries

## Acceptance Criteria

- [ ] clearScreen() clears the entire display
- [ ] moveCursor(row, col) positions cursor correctly
- [ ] clearLine() erases current line
- [ ] Cursor can be hidden and shown
- [ ] Reverse video works for status bar
- [ ] 5+ tests for terminal control functions
