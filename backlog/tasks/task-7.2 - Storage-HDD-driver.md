---
id: task-7.2
title: 'Storage: HDD driver with tests'
status: To Do
assignee: []
created_date: '2025-12-11 12:00'
labels:
  - riscv
  - storage
  - hdd
  - tdd
dependencies:
  - task-7.1
parent_task_id: task-7
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a hard disk drive (HDD) driver that implements the block device interface. TDD approach.

**Features:**
- 512-byte sector size (standard)
- Configurable disk size (default 64MB)
- Persistent storage via browser IndexedDB or File API
- Partition table support (MBR style)
- Raw disk image format (.img)
- LBA addressing (no CHS)

**Disk Image Format:**
- Raw binary file, sector-aligned
- No headers, direct 1:1 mapping to sectors
- Can be created with `dd` or similar tools
<!-- SECTION:DESCRIPTION:END -->

## Test Cases Required

<!-- SECTION:NOTES:BEGIN -->
**Basic operations:**
1. Create HDD with specified size
2. Read sector 0 (boot sector)
3. Write sector 0, read back
4. Read multiple consecutive sectors
5. Write multiple consecutive sectors
6. Random access read/write

**Geometry tests:**
1. sectorSize returns 512
2. sectorCount matches disk size
3. isReadOnly returns false

**Persistence tests:**
1. Write data, flush, "restart", read same data
2. Changes persist across sessions
3. Flush actually commits to storage

**Disk image tests:**
1. Load existing disk image
2. Created disk image is valid raw format
3. Disk image size matches geometry
4. Export disk image to file

**MBR partition tests:**
1. Read partition table from sector 0
2. Identify partition boundaries
3. Boot signature (0x55AA) detected

**Error handling:**
1. Access beyond disk size
2. Invalid sector number
3. Storage quota exceeded
4. Corrupted disk image handling
<!-- SECTION:NOTES:END -->

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] Implements BlockDevice interface correctly
- [ ] 512-byte sectors work correctly
- [ ] Read/write operations are reliable
- [ ] Persistence via IndexedDB works
- [ ] Disk images can be imported/exported
- [ ] MBR boot sector is accessible
- [ ] 30+ test cases for HDD driver
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
