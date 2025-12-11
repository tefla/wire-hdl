---
id: task-6.3
title: 'Graphics: Graphics mode framebuffer with tests'
status: Done
assignee: []
created_date: '2025-12-11 12:00'
labels:
  - riscv
  - graphics
  - tdd
dependencies:
  - task-6.1
parent_task_id: task-6
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement graphics mode with a linear framebuffer for pixel-based rendering. TDD approach.

**Features:**
- 320x200 (Mode 13h style) and 640x480 resolutions
- 8-bit indexed color (256 color palette)
- Linear framebuffer memory layout
- Programmable palette (RGB values)
- Double buffering support (optional)

**Memory Layout:**
- Each pixel is one byte (palette index)
- Row-major order (left to right, top to bottom)
- 320x200 = 64,000 bytes
- 640x480 = 307,200 bytes
<!-- SECTION:DESCRIPTION:END -->

## Test Cases Required

<!-- SECTION:NOTES:BEGIN -->
**Pixel operations:**
1. Set single pixel at (0,0), verify framebuffer byte
2. Set pixel at (319,199), verify correct offset
3. Set pixel with each palette index (0-255)
4. Read pixel returns correct value

**Framebuffer layout:**
1. Pixel (x,y) maps to offset y*width + x
2. Row boundaries are correct
3. Full framebuffer size matches resolution

**Palette tests:**
1. Set palette entry 0 to red, verify RGB
2. Set all 256 palette entries
3. Read palette entries back correctly
4. Default palette is reasonable (VGA colors)

**Resolution tests:**
1. Switch to 320x200 mode, verify size
2. Switch to 640x480 mode, verify size
3. Mode switch clears/preserves framebuffer (configurable)

**Rendering tests:**
1. Fill entire screen with single color
2. Horizontal line renders correctly
3. Vertical line renders correctly
4. Rectangle fill works correctly
5. Pattern fill (checkerboard) verifies addressing
<!-- SECTION:NOTES:END -->

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] 320x200 and 640x480 resolutions work
- [ ] Pixel addressing is correct for all coordinates
- [ ] 256-color palette fully programmable
- [ ] Framebuffer read/write works correctly
- [ ] Mode switching works correctly
- [ ] 25+ test cases for graphics mode
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
