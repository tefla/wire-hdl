---
id: task-2.3
title: 'MORE: Progress indicator and EOF handling'
status: To Do
assignee: []
created_date: '2025-12-09 13:34'
labels:
  - 6502
  - shell
  - pager
  - ui
dependencies:
  - task-2.2
parent_task_id: task-2
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add progress indication and proper end-of-file behavior.

Key considerations:
- Show percentage or line count in the "--More--" prompt (e.g., "--More-- (50%)")
- Calculate percentage based on bytes read vs total file size
- Clean exit when end of file is reached
- Optional: show "(END)" message before returning to shell
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Progress indicator shows percentage through file
- [ ] #2 Clean return to shell at end of file
- [ ] #3 Optional (END) message displayed
- [ ] #4 Unit tests verify progress calculation and EOF handling
<!-- AC:END -->
