---
id: task-1.6
title: 'EDIT: Comprehensive test suite'
status: To Do
assignee: []
created_date: '2025-12-09 13:16'
updated_date: '2025-12-09 13:17'
labels:
  - 6502
  - editor
  - testing
dependencies:
  - task-1.1
  - task-1.2
  - task-1.3
  - task-1.4
  - task-1.5
parent_task_id: task-1
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a comprehensive test suite for the EDIT editor similar to the shell.test.ts pattern. Tests should cover all editor functionality using the emulated CPU with stub BIOS routines.

Key test scenarios:
- Opening files with various sizes
- Arrow key navigation within a file
- Scrolling through long files
- Character insertion at different positions
- Backspace and delete operations
- Save functionality
- Quit with/without modifications

Test infrastructure:
- Reuse shell.test.ts patterns for stubbing BIOS and disk I/O
- Create helper functions for simulating keystrokes
- Verify output buffer for screen content
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Test file exists at tests/edit.test.ts
- [ ] #2 Tests for file open with content verification
- [ ] #3 Tests for arrow key navigation
- [ ] #4 Tests for scrolling through files > 23 lines
- [ ] #5 Tests for character insertion at cursor
- [ ] #6 Tests for backspace deletion
- [ ] #7 Tests for file save functionality
- [ ] #8 All tests pass with npm test
<!-- AC:END -->
