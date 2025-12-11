---
id: task-25
title: Shell program
status: To Do
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

- [ ] task-25.1: Implement command parser
- [ ] task-25.2: Implement built-in commands
- [ ] task-25.3: Implement external program execution
- [ ] task-25.4: Write shell in RISC-V assembly

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] Shell displays prompt and accepts input
- [ ] Commands are parsed correctly
- [ ] Built-in commands work (help, cls, echo, mem)
- [ ] External programs can be loaded and run
- [ ] Programs return to shell on exit
- [ ] Shell handles errors gracefully
- [ ] 15+ tests for shell commands and parsing
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
