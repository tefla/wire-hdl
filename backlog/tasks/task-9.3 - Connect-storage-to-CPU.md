---
id: task-9.3
title: 'Integration: Connect storage controller to CPU memory bus'
status: To Do
assignee: []
created_date: '2025-12-11 14:00'
labels:
  - riscv
  - integration
  - storage
  - tdd
dependencies:
  - task-7
parent_task_id: task-9
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Modify the CPU to route memory accesses in the storage address range (0x20000000+) to the StorageController.

**Implementation:**
- Add StorageController instance to CPU or MemoryBus
- Intercept load/store in the storage address range
- Route to StorageController.mmioRead/mmioWrite methods
- Support byte, halfword, and word access

**Memory Ranges:**
- 0x20000000-0x200000FF: Storage registers
- 0x20010000-0x2001FFFF: DMA buffer (64KB)
<!-- SECTION:DESCRIPTION:END -->

## Test Cases Required

<!-- SECTION:NOTES:BEGIN -->
1. CPU SW to DEVICE_SELECT selects device
2. CPU SW to COMMAND executes operation
3. CPU LW from STATUS returns operation result
4. CPU LW from DMA buffer reads transferred data
5. CPU SW to DMA buffer writes data for transfer
6. Full read workflow via CPU instructions
7. Full write workflow via CPU instructions
8. Addresses outside storage range still go to RAM
<!-- SECTION:NOTES:END -->

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] Storage controller accessible via CPU load/store
- [ ] All access sizes (byte/half/word) work
- [ ] DMA buffer readable/writable via CPU
- [ ] Existing CPU tests still pass
- [ ] 10+ integration tests for storage access
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
