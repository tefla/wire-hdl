---
id: task-7.4
title: 'Storage: CD-ROM driver with tests'
status: To Do
assignee: []
created_date: '2025-12-11 12:00'
labels:
  - riscv
  - storage
  - cdrom
  - tdd
dependencies:
  - task-7.1
parent_task_id: task-7
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a CD-ROM driver that implements the block device interface for read-only optical media. TDD approach.

**Features:**
- 2048-byte sector size (ISO9660 standard)
- Read-only (isReadOnly = true)
- ISO image format (.iso)
- Hot-swappable (disc insert/eject)
- Audio CD tracks (future, optional)
- Multi-session support (optional)

**CD-ROM Specific:**
- Disc present/absent status
- Tray open/closed status
- Eject command support
- Load (close tray) command support
<!-- SECTION:DESCRIPTION:END -->

## Test Cases Required

<!-- SECTION:NOTES:BEGIN -->
**Basic operations:**
1. Load ISO image as CD-ROM
2. Read sector 0
3. Read multiple consecutive sectors
4. Write attempt returns error (read-only)

**Geometry tests:**
1. sectorSize returns 2048
2. sectorCount matches ISO size
3. isReadOnly returns true

**Disc handling tests:**
1. No disc initially
2. Insert disc (load ISO), status changes
3. Read works after disc inserted
4. Eject disc, status changes
5. Read fails after eject
6. Insert different disc

**ISO image tests:**
1. Load standard ISO image
2. ISO sector count calculated correctly
3. Primary volume descriptor readable (sector 16)
4. ISO9660 magic number detectable

**Tray status tests:**
1. Tray open/closed status readable
2. Eject command opens tray
3. Load command closes tray
4. Manual tray operations (UI triggered)

**Error handling:**
1. Read with no disc
2. Read beyond disc size
3. Invalid ISO image detection
4. Corrupted ISO handling
<!-- SECTION:NOTES:END -->

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] Implements BlockDevice interface correctly
- [ ] 2048-byte sectors work correctly
- [ ] Read-only enforced (writes rejected)
- [ ] ISO images can be loaded
- [ ] Disc insert/eject works
- [ ] Tray status is accurate
- [ ] 25+ test cases for CD-ROM driver
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
