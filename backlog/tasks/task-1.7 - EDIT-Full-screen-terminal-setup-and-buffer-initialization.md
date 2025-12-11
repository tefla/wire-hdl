---
id: task-1.7
title: 'EDIT: Full-screen terminal setup and buffer initialization'
status: To Do
assignee: []
created_date: '2025-12-09 13:35'
labels:
  - 6502
  - editor
  - terminal
  - foundation
dependencies: []
parent_task_id: task-1
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Set up the foundational full-screen terminal mode and text buffer management for EDIT.COM. This is the first full-screen terminal application in WireOS, so we need to establish proper patterns.

Key considerations:
- Clear screen and take over full 80x25 display
- Initialize text buffer at TEXT_BUF ($2000) with proper bounds checking
- Set up screen regions: header (line 0), edit area (lines 1-23), status bar (line 24)
- Initialize cursor position tracking (screen position vs buffer position)
- Disable normal shell echo/line editing behavior
- Handle raw keyboard input mode
- Ensure clean exit restores terminal to normal state

This task establishes the foundation that all other EDIT features will build upon.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Screen is cleared and full 80x25 display is used
- [ ] #2 Header line displays at row 0
- [ ] #3 Edit area spans rows 1-23 (23 lines)
- [ ] #4 Status bar displays at row 24
- [ ] #5 Text buffer initialized at $2000 with size tracking
- [ ] #6 Cursor position tracked separately for screen and buffer
- [ ] #7 Clean exit restores terminal state
- [ ] #8 Unit tests verify screen layout and buffer initialization
<!-- AC:END -->
