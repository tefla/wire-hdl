---
id: task-20
title: Keyboard controller and CPU integration
status: To Do
assignee: []
created_date: '2025-12-11 16:00'
labels:
  - riscv
  - hardware
  - input
dependencies:
  - task-9
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a memory-mapped keyboard controller that allows programs to read keyboard input.

**Memory Map:**
- 0x30000000: Keyboard registers base

**Registers:**
- 0x00: STATUS (bit 0 = key available)
- 0x04: DATA (ASCII code of pressed key, reading clears status)
- 0x08: MODIFIER (shift, ctrl, alt state)

**Implementation:**
- Create KeyboardController class with ring buffer
- Wire to CPU memory bus at 0x30000000
- Connect to browser keyboard events in React UI
- Support basic ASCII keys + special keys (Enter, Backspace, Escape)
<!-- SECTION:DESCRIPTION:END -->

## Subtasks

- [ ] task-20.1: Implement KeyboardController class
- [ ] task-20.2: Wire keyboard to CPU memory bus
- [ ] task-20.3: Connect browser keyboard events to controller

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] CPU can read keyboard status via LW to 0x30000000
- [ ] CPU can read key data via LW to 0x30000004
- [ ] Key buffer holds multiple keypresses
- [ ] Browser keyboard input reaches the emulator
- [ ] 10+ tests for keyboard controller
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
