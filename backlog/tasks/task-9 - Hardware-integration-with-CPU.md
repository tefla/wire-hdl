---
id: task-9
title: Hardware integration with CPU memory bus
status: In Progress
assignee: []
created_date: '2025-12-11 14:00'
labels:
  - riscv
  - integration
  - hardware
dependencies:
  - task-6
  - task-7
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Wire up the graphics card and storage controller to the CPU's memory bus so programs can interact with hardware via memory-mapped I/O.

**Current State:**
- Graphics card implemented but isolated
- Storage controller implemented but isolated
- CPU has no knowledge of these peripherals

**Goal:**
- CPU load/store instructions to peripheral addresses route to correct hardware
- Programs can write to VRAM and see output on screen
- Programs can read/write storage devices
<!-- SECTION:DESCRIPTION:END -->

## Subtasks

- [ ] task-9.1: Connect graphics card to CPU memory bus
- [ ] task-9.2: Add Screen component to React UI
- [ ] task-9.3: Connect storage controller to CPU memory bus

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] CPU SW to 0x10000000+ writes to graphics card
- [ ] CPU LW from 0x10000000+ reads from graphics card
- [ ] Screen component renders graphics card output
- [ ] CPU SW to 0x20000000+ writes to storage controller
- [ ] CPU LW from 0x20000000+ reads from storage controller
- [ ] All existing tests still pass
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
