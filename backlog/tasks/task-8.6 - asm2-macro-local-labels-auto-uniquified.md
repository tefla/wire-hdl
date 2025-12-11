---
id: task-8.6
title: asm2 macro local labels (auto-uniquified)
status: To Do
assignee: []
created_date: '2025-12-11 09:25'
labels:
  - '6502'
  - assembler
  - tdd
dependencies:
  - task-8.5
parent_task_id: task-8
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add auto-uniquified local labels within macros to allow multiple invocations.

## TDD Approach
1. Write tests verifying macro with internal branch works once
2. Write tests verifying same macro invoked twice doesn't have label collision
3. Write tests for nested macros with local labels

## Implementation
- Labels prefixed with `\\@` or similar get unique suffix per macro expansion
- Counter incremented for each macro invocation
- E.g., `\\@loop` becomes `__M001_loop`, `__M002_loop`, etc.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Tests written first
- [ ] #2 Macro-local labels use \\@ prefix syntax
- [ ] #3 Each macro expansion gets unique label suffix
- [ ] #4 Multiple invocations of same macro don't collide
- [ ] #5 Nested macros each get their own unique scope
<!-- AC:END -->
