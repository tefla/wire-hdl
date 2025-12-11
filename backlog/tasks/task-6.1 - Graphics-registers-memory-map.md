---
id: task-6.1
title: 'Graphics: Registers and memory map with tests'
status: Done
assignee: []
created_date: '2025-12-11 12:00'
labels:
  - riscv
  - graphics
  - tdd
dependencies: []
parent_task_id: task-6
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Define and implement the graphics card's memory-mapped I/O registers and integrate them into the CPU's memory bus. TDD approach.

**Registers to Implement:**
- MODE: Display mode selection (text/graphics)
- CURSOR_X, CURSOR_Y: Text cursor position
- CURSOR_CTRL: Cursor visibility and blink rate
- WIDTH, HEIGHT: Display dimensions (read-only in text mode)
- STATUS: VBlank status, busy flags

**Memory Regions:**
- Register block: control and status registers
- Text VRAM: character and attribute bytes
- Framebuffer: pixel data for graphics mode
- Palette: color lookup table
<!-- SECTION:DESCRIPTION:END -->

## Test Cases Required

<!-- SECTION:NOTES:BEGIN -->
**Register read/write tests:**
1. Write MODE register, read back correct value
2. Write CURSOR_X/Y, verify in range clamping
3. Read WIDTH/HEIGHT returns correct defaults
4. STATUS register reflects correct state

**Memory mapping tests:**
1. Writes to register region go to graphics card
2. Writes to VRAM region store correctly
3. Writes outside mapped region don't affect graphics
4. Byte, halfword, and word access all work

**Integration tests:**
1. CPU can write to graphics registers via SW instruction
2. CPU can read from graphics registers via LW instruction
3. Memory bus correctly routes addresses to graphics card
4. Invalid addresses cause appropriate behavior

**Boundary tests:**
1. Access at region boundaries
2. Misaligned access handling
3. Out-of-bounds VRAM access
<!-- SECTION:NOTES:END -->

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] All control registers read/write correctly
- [ ] Memory regions are correctly sized and mapped
- [ ] Integration with CPU memory bus works
- [ ] Byte/halfword/word access all supported
- [ ] Out-of-bounds access handled gracefully
- [ ] 25+ test cases covering all register operations
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
