---
id: task-23
title: Simple bootloader
status: Done
assignee: []
created_date: '2025-12-11 16:00'
labels:
  - riscv
  - boot
  - loader
dependencies:
  - task-21
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a simple bootloader that initializes the system and loads the shell or OS from disk.

**Boot Sequence:**
1. CPU starts at address 0x0000
2. Bootloader initializes stack pointer
3. Bootloader prints boot message
4. Bootloader loads shell from disk sector(s)
5. Bootloader jumps to shell entry point

**Memory Layout:**
```
0x0000 - 0x0FFF: Bootloader (4KB)
0x1000 - 0x7FFF: Program area (28KB)
0x8000 - 0xFFFF: Stack (grows down from 0xFFFF)
```

**Disk Layout:**
- Sector 0: Boot sector (unused, or boot signature)
- Sector 1-N: Shell program
- Sector N+: User programs and data

**Implementation:**
- Write bootloader in RISC-V assembly
- Assemble and embed in emulator as ROM
- Or load from virtual "ROM" address space
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [x] CPU boots and runs bootloader
- [x] Bootloader initializes stack
- [x] Bootloader displays boot message
- [x] Bootloader loads program from disk
- [x] Control transfers to loaded program
- [x] Boot process completes in < 1 second (< 50000 cycles)
- [x] 10+ tests for bootloader (11 tests implemented)
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
