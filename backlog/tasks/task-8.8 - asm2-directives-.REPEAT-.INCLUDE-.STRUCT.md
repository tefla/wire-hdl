---
id: task-8.8
title: 'asm2 directives (.REPEAT, .INCLUDE, .STRUCT)'
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
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add remaining extended directives for asm2.

## TDD Approach
1. Write tests for .REPEAT/.ENDREP with count
2. Write tests for .INCLUDE with mock file system
3. Write tests for .STRUCT/.ENDSTRUCT field offsets

## Directives

### .REPEAT
```asm
.REPEAT 8
    ASL A
.ENDREP
```

### .INCLUDE
```asm
.INCLUDE "macros.asm"
```

### .STRUCT
```asm
.STRUCT Point
    X .BYTE
    Y .BYTE
.ENDSTRUCT
; Point_X = 0, Point_Y = 1, Point_SIZE = 2
```
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Tests written first for each directive
- [ ] #2 .REPEAT expands code N times
- [ ] #3 .REPEAT counter available as \\#
- [ ] #4 .INCLUDE pulls in external file content
- [ ] #5 .STRUCT generates field offset constants
- [ ] #6 .STRUCT generates _SIZE constant
<!-- AC:END -->
