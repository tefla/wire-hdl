---
id: task-1.1
title: 'EDIT: Arrow key cursor navigation'
status: To Do
assignee: []
created_date: '2025-12-09 13:16'
updated_date: '2025-12-09 13:36'
labels:
  - 6502
  - editor
  - navigation
dependencies:
  - task-1.7
parent_task_id: task-1
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement arrow key navigation in the EDIT text editor. The editor should respond to arrow key codes (Up: $91, Down: $92, Left: $93, Right: $94 as defined in App.tsx) and move the cursor accordingly within the text buffer.

Key considerations:
- Cursor must track both screen position and buffer position
- Left/Right should move within a line and wrap to previous/next line at boundaries  
- Up/Down should move to the same column on the previous/next line (or end of line if shorter)
- Need to convert between linear buffer position and line/column for display
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Arrow Up moves cursor to same column on previous line
- [ ] #2 Arrow Down moves cursor to same column on next line
- [ ] #3 Arrow Left moves cursor left one character, wrapping to end of previous line
- [ ] #4 Arrow Right moves cursor right one character, wrapping to start of next line
- [ ] #5 Cursor movement updates status bar line/column display
- [ ] #6 Cursor stops at document boundaries (start and end)

- [ ] #7 Unit tests verify arrow key navigation behavior
- [ ] #8 Tests cover boundary conditions (start/end of file, line wrapping)
<!-- AC:END -->
