---
id: task-7.3
title: 'Storage: USB memory stick driver with tests'
status: Done
assignee: []
created_date: '2025-12-11 12:00'
labels:
  - riscv
  - storage
  - usb
  - tdd
dependencies:
  - task-7.1
parent_task_id: task-7
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a USB mass storage driver (memory stick/flash drive) that implements the block device interface. TDD approach.

**Features:**
- 512-byte sector size
- Hot-pluggable (can be inserted/removed at runtime)
- Configurable size (default 16MB)
- FAT32 filesystem ready (raw block access)
- Disk image format (.img)
- Status detection (inserted/ejected)

**USB-specific Features:**
- Device present/absent status
- Eject support (safe removal)
- Re-insertion support
- Multiple USB devices (future)
<!-- SECTION:DESCRIPTION:END -->

## Test Cases Required

<!-- SECTION:NOTES:BEGIN -->
**Basic operations:**
1. Create USB device with specified size
2. Read sector 0
3. Write sector 0, read back
4. Read/write multiple sectors

**Hot-plug tests:**
1. Device initially not present
2. Insert device, status changes
3. Access after insertion works
4. Eject device, status changes
5. Access after ejection fails gracefully
6. Re-insert device, access works

**Geometry tests:**
1. sectorSize returns 512
2. sectorCount matches device size
3. isReadOnly returns false (normally)
4. Write-protected mode supported

**Disk image tests:**
1. Load existing disk image as USB
2. "Insert" disk image at runtime
3. "Eject" saves current state
4. Swap disk images

**Status register tests:**
1. STATUS shows device present/absent
2. STATUS shows read/write in progress
3. STATUS shows errors

**Error handling:**
1. Access when device not present
2. Write to write-protected device
3. Device removed during operation
<!-- SECTION:NOTES:END -->

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] Implements BlockDevice interface correctly
- [ ] Hot-plug insert/eject works
- [ ] Status detection works correctly
- [ ] Write protection mode works
- [ ] Disk images can be loaded/saved
- [ ] Graceful handling of device removal
- [ ] 25+ test cases for USB driver
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
