---
id: task-2.1
title: 'MORE: File loading and page display'
status: To Do
assignee: []
created_date: '2025-12-09 13:34'
labels:
  - 6502
  - shell
  - pager
dependencies: []
parent_task_id: task-2
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the core file loading and paged display logic for MORE.COM.

Key considerations:
- Parse filename argument from command line (reuse pattern from TYPE/EDIT)
- Load file from disk into memory buffer
- Display first 23 lines of content
- Track current position in file for pagination
- Handle files smaller than one page (just display and exit)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Parses filename from 'MORE filename' command
- [ ] #2 Loads file content from disk
- [ ] #3 Displays up to 23 lines of text
- [ ] #4 Handles files shorter than one page
- [ ] #5 Unit tests verify file loading and initial display
<!-- AC:END -->
