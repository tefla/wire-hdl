---
id: task-5.5
title: 'Assembler: Directives with tests'
status: To Do
assignee: []
created_date: '2025-12-11 12:00'
labels:
  - riscv
  - assembler
  - tdd
dependencies:
  - task-5.4
parent_task_id: task-5
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement assembler directives for data definition, alignment, and organization. TDD approach.

**Directives to Implement:**
- .org ADDRESS - set assembly origin
- .byte VALUE [, VALUE...] - emit byte(s)
- .half VALUE [, VALUE...] - emit halfword(s) (16-bit)
- .word VALUE [, VALUE...] - emit word(s) (32-bit)
- .ascii "STRING" - emit string bytes (no null terminator)
- .asciiz "STRING" - emit null-terminated string
- .string "STRING" - alias for .asciiz
- .align N - align to 2^N byte boundary
- .space N - reserve N bytes (filled with zeros)
- .equ NAME, VALUE - define constant
- .global NAME - mark symbol as global (for future linking)
- .section NAME - switch to named section (for future use)
<!-- SECTION:DESCRIPTION:END -->

## Test Cases Required

<!-- SECTION:NOTES:BEGIN -->
**Origin tests:**
1. .org sets correct starting address
2. Multiple .org directives
3. .org with hex address

**Data emission tests:**
1. .byte with single value
2. .byte with multiple values
3. .half alignment behavior
4. .word alignment behavior
5. Negative values in .byte/.half/.word
6. Hex and binary literals in data

**String tests:**
1. .ascii emits correct bytes
2. .asciiz adds null terminator
3. Escape sequences: \n, \r, \t, \\, \"
4. Empty string

**Alignment tests:**
1. .align 2 (4-byte boundary)
2. .align when already aligned
3. .space reserves correct amount

**Constant tests:**
1. .equ defines usable constant
2. Constant used in instruction immediate
3. Constant used in .word
<!-- SECTION:NOTES:END -->

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] All listed directives implemented
- [ ] .org correctly sets program counter
- [ ] Data directives emit correct bytes
- [ ] Alignment works correctly
- [ ] Escape sequences in strings work
- [ ] Constants can be used anywhere immediates are valid
- [ ] 30+ test cases for directives
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
