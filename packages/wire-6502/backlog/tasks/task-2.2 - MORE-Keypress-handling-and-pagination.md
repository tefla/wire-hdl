---
id: task-2.2
title: 'MORE: Keypress handling and pagination'
status: To Do
assignee: []
created_date: '2025-12-09 13:34'
labels:
  - shell
  - pager
dependencies:
  - task-2.1
parent_task_id: task-2
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the interactive pagination - waiting for keypress and showing subsequent pages.

Key considerations:
- Display "--More--" prompt at bottom of screen after each page
- Wait for any keypress to continue
- Q or q quits immediately and returns to shell
- Space advances one full page
- Enter could advance one line (optional enhancement)
- Clear "--More--" prompt before showing next page
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Shows '--More--' prompt after each page
- [ ] #2 Any key advances to next page
- [ ] #3 Q key exits immediately to shell
- [ ] #4 Properly clears prompt before next page
- [ ] #5 Unit tests verify keypress handling and page advancement
<!-- AC:END -->
