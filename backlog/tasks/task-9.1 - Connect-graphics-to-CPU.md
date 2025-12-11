---
id: task-9.1
title: 'Integration: Connect graphics card to CPU memory bus'
status: In Progress
assignee: []
created_date: '2025-12-11 14:00'
labels:
  - riscv
  - integration
  - graphics
  - tdd
dependencies:
  - task-6
parent_task_id: task-9
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Modify the CPU to route memory accesses in the graphics address range (0x10000000+) to the GraphicsCard.

**Implementation:**
- Add GraphicsCard instance to CPU or create a MemoryBus abstraction
- Intercept load/store in the graphics address range
- Route to GraphicsCard.mmioRead/mmioWrite methods
- Support byte, halfword, and word access

**Memory Ranges:**
- 0x10000000-0x100000FF: Graphics registers
- 0x10001000-0x10001F9F: Text VRAM
- 0x10002000-0x100023FF: Palette
- 0x10010000-0x1005AFFF: Framebuffer
<!-- SECTION:DESCRIPTION:END -->

## Test Cases Required

<!-- SECTION:NOTES:BEGIN -->
1. CPU SW to MODE register changes display mode
2. CPU SW to CURSOR_X/Y moves cursor
3. CPU SW to text VRAM displays character
4. CPU LW from registers returns correct values
5. CPU SB/SH/SW all work correctly
6. CPU LB/LH/LW all work correctly
7. Addresses outside graphics range still go to RAM
8. Integration test: write "A" to VRAM, verify in graphics card
<!-- SECTION:NOTES:END -->

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] Graphics card accessible via CPU load/store
- [ ] All access sizes (byte/half/word) work
- [ ] Existing CPU tests still pass
- [ ] 10+ integration tests for graphics access
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
