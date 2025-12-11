---
id: task-31.4
title: Cursor navigation and display
status: To Do
assignee: []
created_date: '2025-12-11 15:00'
labels:
  - riscv
  - editor
  - ui
parent: task-31
dependencies:
  - task-31.1
  - task-31.2
priority: high
---

## Description

Implement cursor movement and screen scrolling for navigating through the text buffer.

**Cursor State:**
```c
struct Cursor {
  int row;          // Current line (0-based)
  int col;          // Current column (0-based)
  int topLine;      // First visible line (for scrolling)
  int screenRows;   // Visible rows (e.g., 24, leaving 1 for status)
};
```

**Navigation Functions:**
- `moveUp()` - Move cursor up one line
- `moveDown()` - Move cursor down one line
- `moveLeft()` - Move cursor left one character
- `moveRight()` - Move cursor right one character
- `moveHome()` - Move to start of line
- `moveEnd()` - Move to end of line
- `pageUp()` - Move up one screen
- `pageDown()` - Move down one screen
- `gotoLine(lineNum)` - Jump to specific line

**Scrolling Logic:**
- If cursor moves above topLine, scroll up
- If cursor moves below topLine + screenRows, scroll down
- Keep cursor within text bounds
- Handle short lines (can't move right past end)

**Display Update:**
- Redraw visible portion of text
- Update cursor position on screen
- Efficient: only redraw changed lines

## Acceptance Criteria

- [ ] Arrow keys move cursor in all directions
- [ ] Home/End keys work
- [ ] Page Up/Down scroll by screen height
- [ ] Cursor stays within text bounds
- [ ] Screen scrolls when cursor moves beyond visible area
- [ ] Cursor column adjusts when moving to shorter line
- [ ] Display shows correct portion of text
- [ ] 8+ tests for cursor navigation
