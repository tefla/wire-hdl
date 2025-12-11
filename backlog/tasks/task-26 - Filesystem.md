---
id: task-26
title: Simple filesystem
status: Done
assignee: []
created_date: '2025-12-11 16:00'
labels:
  - riscv
  - filesystem
  - storage
dependencies:
  - task-25
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a simple filesystem for organizing programs and data on disk. This is optional - the shell can work with raw sector numbers initially.

**Filesystem Design (WireFS-RV):**
- FAT-like structure optimized for simplicity
- 512-byte sectors
- Single directory (flat namespace)
- 8.3 filenames (8 char name + 3 char extension)

**Disk Layout:**
```
Sector 0:      Boot sector / superblock
Sector 1-4:    File allocation table (FAT)
Sector 5:      Root directory (16 entries)
Sector 6+:     Data area
```

**Directory Entry (32 bytes):**
```
Offset  Size  Description
0x00    8     Filename (padded with spaces)
0x08    3     Extension
0x0B    1     Attributes (R/W/H/S)
0x0C    4     File size in bytes
0x10    2     First sector
0x12    14    Reserved
```

**Alternative: Simpler Slot-Based System**
- Fixed slots for programs (slot 0 = shell, slot 1-15 = programs)
- Each slot is a fixed size (e.g., 8KB)
- No directory needed, just slot numbers
<!-- SECTION:DESCRIPTION:END -->

## Subtasks

- [x] task-26.1: Design filesystem layout (FAT-like with superblock, FAT, root dir)
- [x] task-26.2: Implement filesystem driver (WireFS class)
- [x] task-26.3: Implement file operations (create, read, write, delete, list)
- [ ] task-26.4: Create disk image tool (deferred)

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [x] Filesystem format is documented (WireFS with 512-byte sectors, 8.3 names)
- [x] Can list files in directory
- [x] Can read file contents
- [x] Can write new files
- [x] Can delete files
- [ ] Shell dir command shows files (shell integration deferred)
- [ ] Shell can run programs by name (shell integration deferred)
- [x] 15+ tests for filesystem operations (30 tests implemented)
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
