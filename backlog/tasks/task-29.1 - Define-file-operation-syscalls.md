---
id: task-29.1
title: Define file operation syscalls
status: To Do
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

- [ ] Syscall numbers defined in syscall handler
- [ ] fopen implemented with read/write modes
- [ ] fread/fwrite work with memory buffers
- [ ] fclose releases handle
- [ ] readdir iterates directory entries
- [ ] 10+ tests for file syscalls
