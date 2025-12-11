---
id: task-6
title: Graphics card and display subsystem
status: To Do
assignee: []
created_date: '2025-12-11 12:00'
labels:
  - riscv
  - graphics
  - hardware
  - feature
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a memory-mapped graphics card for the RISC-V emulator with text and graphics modes. The display will render in the browser using a React component.

**TDD Approach:** All hardware emulation logic must be developed test-first with comprehensive unit tests.

**Features:**
- Memory-mapped I/O registers for control
- Text mode: 80x25 character display with attributes
- Graphics mode: Framebuffer-based pixel display
- Hardware cursor support
- VGA-compatible palette (256 colors)
- Screen component for browser rendering

**Memory Map (proposed):**
- Control registers: 0x10000000 - 0x100000FF
- Text VRAM: 0x10001000 - 0x10001F9F (80*25*2 bytes)
- Framebuffer: 0x10010000 - 0x1004AFFF (640x480 pixels)
- Palette: 0x10002000 - 0x100023FF (256 * 4 bytes RGBA)
<!-- SECTION:DESCRIPTION:END -->

## Subtasks

- [ ] task-6.1: Graphics registers and memory map with tests
- [ ] task-6.2: Text mode rendering with tests
- [ ] task-6.3: Graphics mode framebuffer with tests
- [ ] task-6.4: Hardware cursor and attributes with tests
- [ ] task-6.5: React Screen component with integration tests

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] Text mode displays 80x25 characters correctly
- [ ] Character attributes (colors) work correctly
- [ ] Graphics mode renders pixels correctly
- [ ] Mode switching works correctly
- [ ] Hardware cursor visible and positionable
- [ ] Test coverage > 90% for graphics subsystem
- [ ] Screen component renders at 60fps
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->

## Technical Notes

<!-- SECTION:NOTES:BEGIN -->
**Control Registers:**
| Offset | Name | Description |
|--------|------|-------------|
| 0x00 | MODE | 0=text, 1=graphics |
| 0x04 | CURSOR_X | Cursor column (0-79) |
| 0x08 | CURSOR_Y | Cursor row (0-24) |
| 0x0C | CURSOR_CTRL | Cursor enable/blink |
| 0x10 | WIDTH | Screen width in pixels |
| 0x14 | HEIGHT | Screen height in pixels |

**Text Mode Character Format:**
- Byte 0: ASCII character code
- Byte 1: Attribute (fg[3:0], bg[7:4])

**Reference:** VGA text mode and CGA color attributes
<!-- SECTION:NOTES:END -->
