---
id: task-1.5
title: 'EDIT: Dynamic status bar with line/column'
status: To Do
assignee: []
created_date: '2025-12-09 13:16'
updated_date: '2025-12-09 13:18'
labels:
  - editor
  - ui
dependencies:
  - task-1.1
parent_task_id: task-1
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update the status bar to show real-time line and column numbers as the cursor moves. Currently the status bar shows static "Line: 1  Col: 1".

Key considerations:
- Convert cursor buffer position to line/column numbers
- Update status bar after each cursor movement
- Show modified indicator (e.g., asterisk) when file has unsaved changes
- Keep status bar on line 24 as currently implemented
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Status bar shows current line number (1-based)
- [ ] #2 Status bar shows current column number (1-based)
- [ ] #3 Line/column updates in real-time as cursor moves
- [ ] #4 Modified indicator shows when file has unsaved changes

- [ ] #5 Unit tests verify status bar updates after cursor movement
- [ ] #6 Tests verify modified indicator appears after edits
<!-- AC:END -->
