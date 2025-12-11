---
id: task-8.7
title: asm2 conditional assembly (.IF/.IFDEF/.ELSE/.ENDIF)
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
Add .IF/.ELSE/.ENDIF and .IFDEF/.IFNDEF conditional assembly.

## TDD Approach
1. Write tests for .IF with constant expressions
2. Write tests for .IFDEF/.IFNDEF with defined/undefined symbols
3. Write tests for .ELSE branches
4. Write tests for nested conditionals

## Syntax
```asm
DEBUG = 1

.IF DEBUG
    JSR PrintDebug
.ELSE
    NOP
.ENDIF

.IFDEF FEATURE_X
    ; include feature X code
.ENDIF
```
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Tests written first
- [ ] #2 .IF with non-zero includes code
- [ ] #3 .IF with zero excludes code
- [ ] #4 .ELSE provides alternate path
- [ ] #5 .IFDEF checks symbol existence
- [ ] #6 .IFNDEF checks symbol non-existence
- [ ] #7 Nested conditionals work correctly
<!-- AC:END -->
