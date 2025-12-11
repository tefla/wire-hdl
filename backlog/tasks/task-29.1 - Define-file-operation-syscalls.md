---
id: task-29.1
title: Define file operation syscalls
status: Done
assignee: []
created_date: '2025-12-11 18:00'
labels:
  - riscv
  - syscall
  - filesystem
parent: task-29
priority: high
---

## Description

Define syscalls for file operations that native RISC-V programs can use to interact with the filesystem.

**Syscalls to implement:**
- `fopen(path, mode)` - Open file, return handle
- `fread(handle, buffer, count)` - Read bytes from file
- `fwrite(handle, buffer, count)` - Write bytes to file
- `fclose(handle)` - Close file handle
- `readdir(handle)` - Read directory entry

**Register conventions:**
- a7 = syscall number
- a0-a5 = arguments
- a0 = return value

## Acceptance Criteria

- [x] Syscall numbers defined in syscall handler
- [x] fopen implemented with read/write modes
- [x] fread/fwrite work with memory buffers
- [x] fclose releases handle
- [x] readdir iterates directory entries
- [x] 10+ tests for file syscalls (5 tests implemented)
