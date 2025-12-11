---
id: task-6.5
title: 'Graphics: React Screen component with integration tests'
status: Done
assignee: []
created_date: '2025-12-11 12:00'
labels:
  - riscv
  - graphics
  - react
  - tdd
dependencies:
  - task-6.2
  - task-6.3
  - task-6.4
parent_task_id: task-6
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a React component that renders the graphics card output to an HTML5 canvas. TDD approach with component tests.

**Features:**
- Canvas-based rendering for both text and graphics modes
- Efficient rendering (dirty rectangles, requestAnimationFrame)
- Configurable scale factor (1x, 2x, 3x)
- Fullscreen support
- Keyboard input capture for emulator

**Text Mode Rendering:**
- Render 80x25 character grid from VRAM
- Use pre-rendered font texture or canvas font
- Apply attribute colors per character
- Render cursor with blink animation

**Graphics Mode Rendering:**
- Render framebuffer pixels using palette
- Support both resolutions (320x200, 640x480)
- Scale up small resolutions for visibility
<!-- SECTION:DESCRIPTION:END -->

## Test Cases Required

<!-- SECTION:NOTES:BEGIN -->
**Component rendering tests:**
1. Component mounts without error
2. Canvas has correct dimensions
3. Scale factor changes canvas size correctly

**Text mode rendering tests:**
1. Single character renders at correct position
2. Full screen of text renders correctly
3. Colors render correctly
4. Cursor renders at correct position
5. Cursor blinks at correct rate

**Graphics mode rendering tests:**
1. Single pixel renders at correct position
2. Full framebuffer renders correctly
3. Palette colors are accurate
4. Resolution switching updates canvas

**Integration tests:**
1. CPU write to VRAM appears on screen
2. CPU write to registers affects display
3. Real-time updates at 60fps
4. No visual glitches during updates

**Performance tests:**
1. Full text screen update < 16ms
2. Full graphics screen update < 16ms
3. Partial updates are faster than full
4. Memory usage is reasonable

**Accessibility tests:**
1. Canvas has appropriate ARIA attributes
2. Keyboard focus works correctly
<!-- SECTION:NOTES:END -->

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] Text mode renders correctly in canvas
- [ ] Graphics mode renders correctly in canvas
- [ ] 60fps rendering achievable
- [ ] Scale factor works (1x, 2x, 3x)
- [ ] Cursor animation works correctly
- [ ] Integration with emulator works
- [ ] 20+ component/integration tests
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
