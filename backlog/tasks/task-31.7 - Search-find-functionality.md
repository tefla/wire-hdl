---
id: task-31.7
title: Search/find functionality
status: To Do
assignee: []
created_date: '2025-12-11 15:00'
labels:
  - riscv
  - editor
  - search
parent: task-31
dependencies:
  - task-31.2
  - task-31.4
  - task-31.6
priority: medium
---

## Description

Implement text search functionality to find strings within the file.

**Search Features:**
- Press Ctrl+F to activate search
- Prompt for search string in status bar area
- Find next occurrence from cursor position
- Wrap around to beginning if not found
- Highlight or position cursor at match
- Press F3 or Ctrl+F again to find next

**Search Algorithm:**
1. Get search string from user input
2. Starting from current cursor position
3. Search forward through lines
4. Use simple substring search (no regex needed initially)
5. If found, move cursor to match position
6. If not found, wrap to beginning or show "Not found"

**UI Interaction:**
- Show "Search: _____" prompt in status bar
- Read characters until Enter pressed
- ESC cancels search
- Show "Not found" message if no match
- Show "Wrapped" indicator if wrapping to beginning

**Functions to Implement:**
- `promptSearch()` - Get search string from user
- `findNext(buffer, searchStr, startRow, startCol)` - Find next occurrence
- `highlightMatch(row, col, length)` - Show match location
- `strstr(haystack, needle)` - Substring search helper

**Search Options (future):**
- Case-insensitive search
- Replace functionality
- Regular expressions

## Acceptance Criteria

- [ ] Ctrl+F activates search prompt
- [ ] Can enter search string
- [ ] Finds first occurrence after cursor
- [ ] Cursor moves to match position
- [ ] F3 or repeated Ctrl+F finds next match
- [ ] Wraps to beginning when reaching end
- [ ] Shows "Not found" when no match
- [ ] ESC cancels search
- [ ] 6+ tests for search functionality
