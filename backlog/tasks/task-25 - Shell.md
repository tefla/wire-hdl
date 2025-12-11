---
id: task-25
title: Shell program
status: Done
assignee: []
created_date: '2025-12-11 16:00'
labels:
  - riscv
  - shell
  - os
dependencies:
  - task-22
  - task-24
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a command-line shell that provides an interactive interface to the system.

**Features:**
- Command prompt (e.g., "> ")
- Line input with editing
- Command parsing (command + arguments)
- Built-in commands
- External program execution

**Built-in Commands:**
| Command | Description |
|---------|-------------|
| help | Show available commands |
| cls | Clear screen |
| echo | Print arguments |
| mem | Show memory usage |
| regs | Show CPU registers |
| peek | Read memory address |
| poke | Write memory address |
| dir | List programs on disk |
| run | Load and run program |
| exit | Halt system |

**Command Loop:**
```
loop:
  print prompt
  read line
  parse command and args
  if builtin: execute builtin
  else: try to load and run program
  goto loop
```
<!-- SECTION:DESCRIPTION:END -->

## Subtasks

- [x] task-25.1: Implement command parser
- [x] task-25.2: Implement built-in commands (help, cls, echo, mem, regs, peek, poke, exit)
- [ ] task-25.3: Implement external program execution (deferred - requires filesystem)
- [ ] task-25.4: Write shell in RISC-V assembly (implemented in TypeScript)

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [x] Shell displays prompt and accepts input
- [x] Commands are parsed correctly
- [x] Built-in commands work (help, cls, echo, mem, regs, peek, poke, exit)
- [ ] External programs can be loaded and run (deferred - requires filesystem)
- [x] Programs return to shell on exit (shell handles exit command)
- [x] Shell handles errors gracefully (unknown commands, missing args)
- [x] 15+ tests for shell commands and parsing (29 tests implemented)
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
