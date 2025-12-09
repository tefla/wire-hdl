---
id: task-2
title: Fully functional MORE.COM pager
status: To Do
assignee: []
created_date: '2025-12-09 13:34'
labels:
  - shell
  - wireos
  - feature
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build a paged file viewer for WireOS similar to the Unix `more` command. Displays file contents one screen at a time and waits for a keypress before showing the next page.

Use case: Viewing long files like assembly source code without content scrolling off the screen.

Behavior:
- Display 23 lines of content (leaving room for header/status)
- Show "--More--" prompt at bottom
- Press any key to show next page
- Press Q to quit early
- Return to shell when end of file reached
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Can view files via 'MORE filename' command
- [ ] #2 Displays one page (23 lines) at a time
- [ ] #3 Waits for keypress before showing next page
- [ ] #4 Q key quits and returns to shell
- [ ] #5 Shows current position or percentage in file
- [ ] #6 All functionality covered by automated tests
<!-- AC:END -->
