---
id: task-9.2
title: 'Integration: Add Screen component to React UI'
status: To Do
assignee: []
created_date: '2025-12-11 14:00'
labels:
  - riscv
  - integration
  - react
  - ui
dependencies:
  - task-6.5
  - task-9.1
parent_task_id: task-9
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Integrate the Screen component into the main App.tsx so users can see graphics output from running programs.

**Implementation:**
- Import Screen component into App.tsx
- Pass GPU instance from CPU to Screen
- Add Screen to the UI layout
- Handle render updates during program execution
- Add scale selector (1x, 2x, 3x)

**UI Layout:**
- Screen should be prominent (main display area)
- Controls (step, run, reset) below or beside screen
- Register view in sidebar or collapsible panel
<!-- SECTION:DESCRIPTION:END -->

## Test Cases Required

<!-- SECTION:NOTES:BEGIN -->
1. Screen component renders in App
2. Screen updates when program writes to VRAM
3. Scale selector changes screen size
4. Cursor blinks when enabled
5. Mode switch (text/graphics) updates display
6. Screen is responsive/resizable
<!-- SECTION:NOTES:END -->

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] Screen visible in main UI
- [ ] Screen renders text mode output
- [ ] Screen renders graphics mode output
- [ ] Scale selector works (1x, 2x, 3x)
- [ ] Cursor animation works
- [ ] UI is usable and well-organized
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
