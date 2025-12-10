---
id: task-1
title: Fully functional EDIT.COM text editor
status: To Do
assignee: []
created_date: '2025-12-09 13:15'
labels:
  - editor
  - wireos
  - feature
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build a complete, tested text editor for WireOS that can open, edit, navigate, and save files. The editor must support files that don't fit on a single screen and must be compatible with editing assembly source files for the Stage 1 assembler (asm.asm).

Current state: Basic editing exists with file loading and character insertion/deletion, but lacks proper cursor navigation, scrolling, and file saving.

Target: A functional editor suitable for editing assembly source code within WireOS.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Can open existing files from disk via 'EDIT filename' command
- [ ] #2 Can navigate the file using arrow keys (up/down/left/right)
- [ ] #3 Screen scrolls when cursor moves beyond visible area
- [ ] #4 Can insert and delete characters at cursor position
- [ ] #5 Can save modified files back to disk
- [ ] #6 Status bar shows current line and column position
- [ ] #7 All functionality covered by automated tests
<!-- AC:END -->
