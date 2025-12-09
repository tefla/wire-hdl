---
id: task-1.3
title: 'EDIT: Screen scrolling for long files'
status: To Do
assignee: []
created_date: '2025-12-09 13:16'
updated_date: '2025-12-09 13:18'
labels:
  - editor
  - scrolling
dependencies:
  - task-1.1
parent_task_id: task-1
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement vertical scrolling so files larger than the screen buffer (23 usable rows) can be viewed and edited. The screen should scroll to keep the cursor visible.

Key considerations:
- Track top-of-screen line number (ZP_TOP_LO/HI already defined)
- Scroll up when cursor moves above visible area
- Scroll down when cursor moves below visible area
- Redraw visible portion of text when scrolling occurs
- Consider scrolling by single line vs page for smoother experience
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Screen scrolls down when cursor moves below line 23
- [ ] #2 Screen scrolls up when cursor moves above line 1
- [ ] #3 Current scroll position is tracked accurately
- [ ] #4 Text is redrawn correctly after scrolling
- [ ] #5 Files with 50+ lines can be navigated end-to-end

- [ ] #6 Unit tests verify scrolling triggers at correct boundaries
- [ ] #7 Tests verify screen content after scrolling up/down
<!-- AC:END -->
