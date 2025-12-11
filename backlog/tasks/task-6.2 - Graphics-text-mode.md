---
id: task-6.2
title: 'Graphics: Text mode rendering with tests'
status: To Do
assignee: []
created_date: '2025-12-11 12:00'
labels:
  - riscv
  - graphics
  - tdd
dependencies:
  - task-6.1
parent_task_id: task-6
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement 80x25 text mode display with character attributes (colors). TDD approach.

**Features:**
- 80 columns x 25 rows text grid
- Each cell: character byte + attribute byte
- 16 foreground colors, 16 background colors (CGA palette)
- Font rendering using built-in 8x16 bitmap font
- Efficient dirty-region tracking for rendering

**Attribute Byte Format:**
- Bits 0-3: Foreground color (0-15)
- Bits 4-7: Background color (0-15)

**CGA Color Palette:**
0=Black, 1=Blue, 2=Green, 3=Cyan, 4=Red, 5=Magenta, 6=Brown, 7=LightGray,
8=DarkGray, 9=LightBlue, 10=LightGreen, 11=LightCyan, 12=LightRed, 13=LightMagenta, 14=Yellow, 15=White
<!-- SECTION:DESCRIPTION:END -->

## Test Cases Required

<!-- SECTION:NOTES:BEGIN -->
**Character display tests:**
1. Write character to position (0,0), verify correct location
2. Write character to position (79,24), verify correct location
3. All printable ASCII characters render correctly
4. Non-printable characters show placeholder glyph

**Attribute tests:**
1. Foreground color 0-15 all display correctly
2. Background color 0-15 all display correctly
3. Combined fg/bg attributes work correctly
4. Default attribute (white on black) works

**VRAM tests:**
1. Sequential writes fill screen left-to-right, top-to-bottom
2. Random access writes work correctly
3. Reading VRAM returns previously written values
4. Screen clears correctly (fill with spaces)

**Performance tests:**
1. Full screen update completes in reasonable time
2. Dirty region tracking minimizes redraw
3. Repeated writes to same location don't accumulate

**Edge cases:**
1. Characters with descenders (g, j, p, q, y)
2. Box-drawing characters (if supported)
3. Extended ASCII (128-255)
<!-- SECTION:NOTES:END -->

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] 80x25 character grid renders correctly
- [ ] All 16 foreground colors work
- [ ] All 16 background colors work
- [ ] Character glyphs are readable and correct
- [ ] VRAM read/write matches expected behavior
- [ ] 30+ test cases for text mode
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
