---
id: task-8.4
title: asm2 local labels (scoped to global labels)
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
Add scoped local labels that reset at each global label.

## TDD Approach
1. Write tests for local label syntax (e.g., `.loop`, `@loop`, or `1:`)
2. Write tests verifying local labels reset at global labels
3. Write tests for forward/backward references to local labels

## Local Label Syntax Options
- `.name` - dot-prefixed local labels
- `@name` - at-prefixed local labels  
- Numeric labels `1:`, `2:` with `1b`, `1f` references (back/forward)

Pick one syntax and implement consistently.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Tests written first for local label behavior
- [ ] #2 Local labels scoped to nearest global label
- [ ] #3 Forward references to local labels work
- [ ] #4 Backward references to local labels work
- [ ] #5 Local labels can be reused after next global label
<!-- AC:END -->
