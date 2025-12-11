---
id: task-6.4
title: 'Graphics: Hardware cursor and attributes with tests'
status: In Progress
assignee: []
created_date: '2025-12-11 12:00'
labels:
  - riscv
  - graphics
  - tdd
dependencies:
  - task-6.2
parent_task_id: task-6
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement hardware cursor for text mode with configurable appearance and blinking. TDD approach.

**Cursor Features:**
- Position control (CURSOR_X, CURSOR_Y registers)
- Enable/disable cursor visibility
- Cursor shape: underline, block, or custom scanlines
- Blink rate control (or solid/no blink)
- Cursor color (uses current attribute or separate)

**Cursor Control Register (CURSOR_CTRL):**
- Bit 0: Enable cursor
- Bit 1: Enable blink
- Bits 4-7: Blink rate (frames per toggle)
- Bits 8-11: Cursor start scanline
- Bits 12-15: Cursor end scanline
<!-- SECTION:DESCRIPTION:END -->

## Test Cases Required

<!-- SECTION:NOTES:BEGIN -->
**Position tests:**
1. Set cursor to (0,0), verify position
2. Set cursor to (79,24), verify position
3. Set cursor beyond bounds, verify clamping
4. Move cursor and verify render position

**Visibility tests:**
1. Enable cursor, verify visible
2. Disable cursor, verify hidden
3. Toggle visibility rapidly

**Shape tests:**
1. Underline cursor (scanlines 14-15)
2. Block cursor (scanlines 0-15)
3. Half-block cursor (scanlines 8-15)
4. Custom scanline range

**Blink tests:**
1. Blink enabled, verify alternates visibility
2. Blink disabled, verify always visible
3. Different blink rates work
4. Blink timing is consistent

**Interaction tests:**
1. Cursor renders over character correctly
2. Cursor uses correct colors
3. Cursor visible after screen scroll
4. Cursor hidden in graphics mode
<!-- SECTION:NOTES:END -->

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] Cursor position controllable via registers
- [ ] Cursor visibility toggle works
- [ ] Cursor blink works at configurable rate
- [ ] Cursor shape (scanlines) configurable
- [ ] Cursor renders correctly over text
- [ ] 20+ test cases for cursor functionality
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
