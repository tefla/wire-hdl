---
id: task-10
title: 'Hello World program for RISC-V emulator'
status: To Do
assignee: []
created_date: '2025-12-11 14:00'
labels:
  - riscv
  - demo
  - assembly
dependencies:
  - task-9.1
  - task-9.2
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a simple "Hello World" program that demonstrates the RISC-V emulator's graphics capabilities by writing text to the screen.

**Goals:**
- Write "Hello, World!" to the text mode display
- Demonstrate VRAM addressing
- Show character and attribute writing
- Serve as a template for more complex programs

**Program Flow:**
1. Initialize graphics mode (text mode is default)
2. Set cursor position (optional)
3. Write each character + attribute to VRAM
4. Characters appear on screen via Screen component
<!-- SECTION:DESCRIPTION:END -->

## Implementation Details

<!-- SECTION:NOTES:BEGIN -->
**Text VRAM Layout:**
- Base address: 0x10001000
- Each cell: 2 bytes (character + attribute)
- Row 0, Col 0: offset 0
- Row y, Col x: offset (y * 80 + x) * 2

**Attribute Byte:**
- Bits 0-3: Foreground color (0-15)
- Bits 4-7: Background color (0-15)
- 0x0F = White on black
- 0x1F = White on blue
- 0x4E = Yellow on red

**Assembly Approach:**
```asm
# Load VRAM base address
lui   a0, 0x10001        # a0 = 0x10001000

# Write 'H' with white-on-black attribute
li    t0, 0x0F48         # 'H' (0x48) + attr (0x0F)
sh    t0, 0(a0)          # Store halfword to VRAM

# Write 'e'
li    t0, 0x0F65         # 'e' (0x65) + attr (0x0F)
sh    t0, 2(a0)          # Next cell
# ... continue for rest of string
```

**Alternative with loop:**
- Store string in memory
- Loop through characters
- Calculate VRAM offset
- Write each char+attr
<!-- SECTION:NOTES:END -->

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] Program assembles without errors
- [ ] Program runs in emulator
- [ ] "Hello, World!" appears on screen
- [ ] Text is readable (correct colors)
- [ ] Program halts cleanly (ECALL)
- [ ] Source code is well-commented as example
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
