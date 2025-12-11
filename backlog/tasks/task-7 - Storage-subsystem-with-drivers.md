---
id: task-7
title: Storage subsystem with drivers (USB, CD-ROM, HDD)
status: To Do
assignee: []
created_date: '2025-12-11 12:00'
labels:
  - riscv
  - storage
  - drivers
  - feature
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a storage subsystem for the RISC-V emulator supporting multiple storage types: USB memory sticks, CD-ROM, and HDD. Includes a block device abstraction layer and individual device drivers.

**TDD Approach:** All storage logic must be developed test-first with comprehensive unit tests.

**Storage Types:**
1. **USB Memory Stick** - Removable FAT32-formatted storage
2. **CD-ROM** - ISO9660 read-only optical media
3. **HDD** - Persistent hard disk with partitions

**Architecture:**
- Block Device Abstraction Layer (common interface)
- Device-specific drivers implementing the interface
- Memory-mapped I/O for device control
- DMA support for bulk transfers (optional)
- Interrupt support for async operations

**Memory Map (proposed):**
- Storage controller: 0x20000000 - 0x200000FF
- Device 0 (HDD): 0x20001000 - 0x200010FF
- Device 1 (CD-ROM): 0x20002000 - 0x200020FF
- Device 2 (USB): 0x20003000 - 0x200030FF
- DMA buffer: 0x20010000 - 0x2001FFFF (64KB)
<!-- SECTION:DESCRIPTION:END -->

## Subtasks

- [ ] task-7.1: Block device abstraction layer with tests
- [ ] task-7.2: HDD driver with tests
- [ ] task-7.3: USB memory stick driver with tests
- [ ] task-7.4: CD-ROM driver with tests
- [ ] task-7.5: Storage controller and integration tests

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] All three storage types can be read from
- [ ] HDD and USB can be written to
- [ ] CD-ROM is correctly read-only
- [ ] Block device interface is consistent across devices
- [ ] Emulator can boot from any storage type
- [ ] Test coverage > 90% for storage subsystem
- [ ] Browser can load/save disk images
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->

## Technical Notes

<!-- SECTION:NOTES:BEGIN -->
**Block Device Interface:**
```typescript
interface BlockDevice {
  readonly sectorSize: number;      // Usually 512 or 2048
  readonly sectorCount: number;     // Total sectors
  readonly isReadOnly: boolean;

  read(sector: number, count: number): Uint8Array;
  write(sector: number, data: Uint8Array): void;
  flush(): void;
}
```

**Storage Controller Registers:**
| Offset | Name | Description |
|--------|------|-------------|
| 0x00 | DEVICE_SELECT | Active device (0=HDD, 1=CD, 2=USB) |
| 0x04 | COMMAND | Command register |
| 0x08 | STATUS | Status/error flags |
| 0x0C | SECTOR_LO | Sector number (low 32 bits) |
| 0x10 | SECTOR_HI | Sector number (high 32 bits) |
| 0x14 | COUNT | Sector count |
| 0x18 | DMA_ADDR | DMA buffer address |

**Commands:**
- 0x00: NOP
- 0x01: READ
- 0x02: WRITE
- 0x03: FLUSH
- 0x04: GET_INFO (returns device geometry)
<!-- SECTION:NOTES:END -->
