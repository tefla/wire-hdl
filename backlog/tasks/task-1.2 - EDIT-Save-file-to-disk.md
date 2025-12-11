---
id: task-1.2
title: 'EDIT: Save file to disk'
status: To Do
assignee: []
created_date: '2025-12-09 13:16'
updated_date: '2025-12-09 13:36'
labels:
  - 6502
  - editor
  - filesystem
dependencies:
  - task-1.7
parent_task_id: task-1
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement file save functionality. When the user presses Ctrl+S (or responds Y to quit prompt), the current text buffer should be written back to the disk.

Key considerations:
- Need to find the file's directory entry (or create new if new file)
- Update file size in directory entry
- Write text buffer contents to disk sectors
- May need to allocate additional sectors if file grew
- Handle the Ctrl+S keybind in main loop
- Update modified flag after successful save
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ctrl+S saves the current file to disk
- [ ] #2 File size is updated in directory entry
- [ ] #3 Modified flag is cleared after save
- [ ] #4 Save prompt on quit (Y/N) works correctly
- [ ] #5 Error handling for disk write failures

- [ ] #6 Unit tests verify file save writes correct data to disk
- [ ] #7 Tests verify directory entry is updated with new file size
<!-- AC:END -->
