---
id: task-28
title: Boot disk with shell and commands
status: Done
assignee: []
created_date: '2025-12-11 17:00'
labels:
  - riscv
  - boot
  - shell
  - usb
dependencies:
  - task-23
  - task-25
  - task-26
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a bootable USB disk image containing the shell and basic commands. The system should boot from this disk and provide an interactive environment.

**Boot Flow:**
1. CPU starts at 0x0000 (bootloader)
2. Bootloader loads shell from USB disk
3. Shell starts and shows prompt
4. User can run built-in commands and programs

**Disk Contents:**
- Shell executable (loaded at boot)
- Basic command programs:
  - `cat` - Display file contents
  - `ls` / `dir` - List files
  - `edit` - Simple text editor
  - `asm` - Assembler (compile .asm to .bin)
  - `run` - Execute a program

**UI Integration:**
- Add "Boot" button to start the system
- Screen shows shell output
- Keyboard input goes to shell
- Real-time interaction loop

**Implementation:**
1. Create boot disk image with WireFS
2. Write shell as executable on disk
3. Add command programs to disk
4. Wire bootloader to load from USB
5. Connect UI to boot sequence
<!-- SECTION:DESCRIPTION:END -->

## Subtasks

- [x] task-28.1: Create bootable disk image with shell
- [x] task-28.2: Implement basic commands (cat, ls, run)
- [x] task-28.3: Add assembler command
- [x] task-28.4: Integrate with frontend UI (Boot button, interaction loop)
- [ ] task-28.5: Add simple text editor command (deferred)

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [x] System boots from USB disk
- [x] Shell displays prompt and accepts commands
- [x] `help` shows available commands
- [x] `ls` lists files on disk
- [x] `cat` displays file contents
- [x] `run` executes programs
- [x] `asm` assembles source files
- [x] Frontend has Boot button
- [x] Keyboard input works in UI
- [x] 15+ tests for boot disk and commands (32 tests)
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
