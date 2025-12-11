---
id: task-29
title: Native RISC-V shell commands
status: Backlog
assignee: []
created_date: '2025-12-11 18:00'
labels:
  - riscv
  - shell
  - native
dependencies:
  - task-28
  - task-27.4
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement shell commands as native RISC-V programs that run on the CPU instead of TypeScript built-ins.

Currently, commands like `cat`, `ls`, `asm` are implemented in TypeScript in `InteractiveSystem`. This task converts them to real RISC-V assembly programs that:
- Are compiled at boot disk creation time using `NativeAssembler`
- Are stored as .BIN executables on the filesystem
- Are loaded and executed by the shell when invoked

**Benefits:**
- Proves the emulator can run real programs
- Moves toward a self-contained system
- Educational value showing how shell commands work at CPU level

**Implementation approach:**
1. Define syscall interface for file operations (open, read, write, close)
2. Write assembly source for each command
3. Compile with NativeAssembler and include in boot disk
4. Shell loads and runs .BIN files instead of built-in handlers

**Syscalls needed:**
- File open (returns file handle)
- File read (reads bytes to buffer)
- File write (writes bytes from buffer)
- File close
- Directory list (iterate files)
- Memory allocate (for buffers)
<!-- SECTION:DESCRIPTION:END -->

## Subtasks

- [ ] task-29.1: Define file operation syscalls
- [ ] task-29.2: Implement native `cat` command
- [ ] task-29.3: Implement native `ls` command
- [ ] task-29.4: Implement native `echo` command
- [ ] task-29.5: Implement native `asm` command (blocked by task-27.4: self-hosting assembler)

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] File syscalls implemented (open, read, write, close, readdir)
- [ ] `cat` runs as native RISC-V code
- [ ] `ls` runs as native RISC-V code
- [ ] `echo` runs as native RISC-V code
- [ ] Commands produce same output as TypeScript versions
- [ ] 10+ tests for native commands
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
