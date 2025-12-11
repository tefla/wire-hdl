---
id: task-29.3
title: Implement native ls command
status: Done
assignee: []
created_date: '2025-12-11 18:00'
labels:
  - riscv
  - shell
  - native
parent: task-29
dependencies:
  - task-29.1
priority: medium
---

## Description

Implement the `ls` command as a native RISC-V program that lists directory contents.

**Program flow:**
1. Call readdir syscall to get first entry
2. Loop: print filename, size; call readdir for next
3. Exit when no more entries

**Output format:**
```
FILENAME.EXT   1234 bytes
```

## Acceptance Criteria

- [x] LS.BIN is a real RISC-V executable
- [x] Lists all files on disk
- [x] Shows filename and size
- [x] Same output as TypeScript built-in version
- [x] 3+ tests for native ls
