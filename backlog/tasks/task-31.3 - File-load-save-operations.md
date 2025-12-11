---
id: task-31.3
title: File load/save operations
status: To Do
assignee: []
created_date: '2025-12-11 15:00'
labels:
  - riscv
  - editor
  - filesystem
parent: task-31
dependencies:
  - task-31.2
priority: high
---

## Description

Implement file loading and saving functionality using the filesystem syscalls.

**Load File Operation:**
1. Open file with FOPEN syscall (mode 0 = read)
2. Read file content with FREAD
3. Split content into lines at newline characters
4. Populate text buffer with lines
5. Close file with FCLOSE
6. Handle file-not-found (create new buffer)

**Save File Operation:**
1. Open file with FOPEN (mode 1 = write)
2. Write each line from buffer
3. Add newline after each line
4. Close file
5. Clear modified flag on success

**Edge Cases:**
- File doesn't exist (new file) - create empty buffer
- File is empty - single empty line
- File is too large - handle gracefully (error or truncate)
- Permission errors - report to user
- Disk full - handle write errors

**Functions to Implement:**
- `loadFile(filename, buffer)` - Load file into buffer
- `saveFile(filename, buffer)` - Save buffer to file
- `fileExists(filename)` - Check if file exists

## Acceptance Criteria

- [ ] Can load existing file into text buffer
- [ ] Can save text buffer to file
- [ ] Handles non-existent files (new file)
- [ ] Handles empty files
- [ ] Preserves line endings correctly
- [ ] Reports errors for I/O failures
- [ ] Clears modified flag after successful save
- [ ] 6+ tests for file operations
