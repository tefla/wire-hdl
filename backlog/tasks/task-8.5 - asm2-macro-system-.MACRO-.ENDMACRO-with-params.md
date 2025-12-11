---
id: task-8.5
title: asm2 macro system (.MACRO/.ENDMACRO with params)
status: To Do
assignee: []
created_date: '2025-12-11 09:25'
labels:
  - '6502'
  - assembler
  - tdd
dependencies:
  - task-8.1
parent_task_id: task-8
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement core macro system with .MACRO/.ENDMACRO and parameter substitution.

## TDD Approach
1. Write tests for simple parameterless macros
2. Write tests for macros with 1, 2, 3 parameters
3. Write tests for macro invocation and expansion
4. Write tests for nested macro calls (macro A calls macro B)

## Syntax
```asm
.MACRO PUSH_AX
    PHA
    TXA
    PHA
.ENDMACRO

.MACRO ADD16 lo, hi
    CLC
    LDA \lo
    ADC #1
    STA \lo
    LDA \hi
    ADC #0
    STA \hi
.ENDMACRO
```
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Tests written first for macro functionality
- [ ] #2 Parameterless macros work
- [ ] #3 Macros with 1-3 parameters work
- [ ] #4 Parameter substitution uses backslash syntax (\param)
- [ ] #5 Nested macro calls expand correctly
- [ ] #6 Macro redefinition produces error
<!-- AC:END -->
