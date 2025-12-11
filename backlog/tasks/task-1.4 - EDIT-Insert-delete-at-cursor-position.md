---
id: task-1.4
title: 'EDIT: Insert/delete at cursor position'
status: To Do
assignee: []
created_date: '2025-12-09 13:16'
updated_date: '2025-12-09 13:18'
labels:
  - 6502
  - editor
  - editing
dependencies:
  - task-1.1
parent_task_id: task-1
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix character insertion and deletion to work at the current cursor position rather than just appending to the buffer end. This requires proper gap buffer or shift operations.

Current state: Characters are appended to end of buffer regardless of cursor position.

Key considerations:
- When inserting, shift all characters after cursor position forward
- When deleting, shift all characters after cursor position backward
- Handle newline insertion (Enter) properly
- Backspace should delete character before cursor and shift remaining text
- Delete key could delete character at cursor (optional enhancement)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Typing inserts characters at cursor position, not end of file
- [ ] #2 Backspace deletes character before cursor
- [ ] #3 Enter inserts newline at cursor position
- [ ] #4 Text after cursor shifts appropriately on insert/delete
- [ ] #5 Modified flag is set when edits are made

- [ ] #6 Unit tests verify insertion at beginning, middle, and end of file
- [ ] #7 Tests verify backspace and text shifting behavior
<!-- AC:END -->
