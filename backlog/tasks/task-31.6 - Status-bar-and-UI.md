---
id: task-31.6
title: Status bar and UI
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
  - task-31.4
priority: medium
---

## Description

Implement status bar and overall UI layout for the editor.

**Screen Layout:**
```
+-----------------------------------------------------------+
|  Line 1 of text file                                      | Row 0
|  Line 2 of text file                                      | Row 1
|  ...                                                       | ...
|  Line 24 of text file                                     | Row 23
+-----------------------------------------------------------+
| HELLO.ASM  Line: 42  Col: 15  Modified  Ctrl+S=Save ^Q=Quit | Row 24 (Status)
+-----------------------------------------------------------+
```

**Status Bar Contents:**
- Filename (or "Untitled" for new files)
- Current line number (1-based for user display)
- Current column number (1-based for user display)
- Modified indicator (asterisk or "Modified" text)
- Help text for key commands

**Status Bar Rendering:**
- Use reverse video (ANSI `\x1b[7m`)
- Position at bottom row of screen
- Clear line before writing
- Reset attributes after (`\x1b[0m`)

**Functions to Implement:**
- `drawStatusBar(filename, row, col, modified)` - Render status bar
- `drawScreen(buffer, topLine, cursor)` - Render entire screen
- `refreshScreen()` - Update display
- `clearEditor()` - Clear screen and prepare for editor

**UI Polish:**
- Center align some status elements
- Use formatting for better readability
- Ensure status bar always visible

## Acceptance Criteria

- [ ] Status bar appears at bottom of screen
- [ ] Shows filename correctly
- [ ] Shows current line and column (1-based)
- [ ] Shows modified indicator when file is edited
- [ ] Status bar uses reverse video
- [ ] Help text shows key commands
- [ ] Screen refreshes correctly when scrolling
- [ ] 5+ tests for status bar rendering
