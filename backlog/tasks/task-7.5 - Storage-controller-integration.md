---
id: task-7.5
title: 'Storage: Controller and integration tests'
status: To Do
assignee: []
created_date: '2025-12-11 12:00'
labels:
  - riscv
  - storage
  - tdd
dependencies:
  - task-7.2
  - task-7.3
  - task-7.4
parent_task_id: task-7
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the storage controller that manages all storage devices and provides memory-mapped I/O for the CPU. TDD approach with integration tests.

**Features:**
- Device selection (HDD, CD-ROM, USB)
- Unified command interface
- Memory-mapped registers
- DMA buffer for bulk transfers
- Status and error reporting
- Interrupt support (optional)

**Integration Requirements:**
- Connect to CPU memory bus
- Handle all storage I/O addresses
- Route commands to correct device
- Manage DMA buffer memory
<!-- SECTION:DESCRIPTION:END -->

## Test Cases Required

<!-- SECTION:NOTES:BEGIN -->
**Register access tests:**
1. Write DEVICE_SELECT, read back
2. Write COMMAND, operation executes
3. Read STATUS after operation
4. Sector number registers work

**Device selection tests:**
1. Select HDD (device 0), operations go to HDD
2. Select CD-ROM (device 1), operations go to CD-ROM
3. Select USB (device 2), operations go to USB
4. Invalid device selection handled

**Command execution tests:**
1. READ command transfers data to DMA buffer
2. WRITE command transfers data from DMA buffer
3. FLUSH command flushes device
4. GET_INFO returns device geometry

**DMA buffer tests:**
1. Read fills DMA buffer correctly
2. Write reads from DMA buffer correctly
3. Multi-sector transfers work
4. DMA address is configurable

**Integration tests:**
1. CPU SW writes to register address
2. CPU LW reads from register address
3. CPU reads DMA buffer after READ
4. Complete read workflow (select, setup, command, get data)
5. Complete write workflow

**Multi-device tests:**
1. Switch between devices rapidly
2. Operations on different devices interleave
3. Device-specific features preserved

**Error handling tests:**
1. Command to absent device
2. Invalid command code
3. Sector out of range
4. Device error propagates to STATUS
<!-- SECTION:NOTES:END -->

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] All registers read/write correctly
- [ ] Device selection works for all three types
- [ ] READ/WRITE/FLUSH commands work
- [ ] DMA buffer correctly transfers data
- [ ] Integration with CPU memory bus works
- [ ] Status and errors reported correctly
- [ ] 30+ integration test cases
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
