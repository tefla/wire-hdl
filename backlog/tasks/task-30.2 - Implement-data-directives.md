---
id: task-30.2
title: Implement data directives (.byte, .word, .string)
status: To Do
assignee: []
created_date: '2025-12-11 14:25'
labels:
  - riscv
  - assembler
  - enhancement
parent: task-30
dependencies:
  - task-30.1
priority: high
---

## Description

Extend the existing `.byte`, `.word`, `.ascii`, `.asciiz` directives with improved syntax and add `.string` as an alias.

**Enhanced Syntax:**
```assembly
.byte 0x12, 0x34, 0x56    ; Multiple bytes
.word 0x1000, 0x2000      ; Multiple words
.string "Hello, World!"   ; Alias for .asciiz
```

**Current Support:**
- `.byte` - Single byte
- `.word` - 32-bit word
- `.ascii` - String without null terminator
- `.asciiz` - String with null terminator
- `.space` - Reserve bytes

**Enhancements Needed:**
- Allow comma-separated multiple values
- `.string` as alias for `.asciiz`
- Better string escaping (\n, \t, \r, \\, \")

## Acceptance Criteria

- [x] .byte supports multiple comma-separated values
- [x] .word supports multiple comma-separated values
- [x] .string works as alias for .asciiz
- [x] String escape sequences work (\n, \t, \r, \\, \")
- [x] 4+ tests for enhanced data directives
