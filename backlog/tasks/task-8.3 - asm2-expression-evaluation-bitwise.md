---
id: task-8.3
title: 'asm2 expression evaluation (+, -, *, /, bitwise)'
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
Add expression evaluation to asm2 for operands.

## TDD Approach
1. Write tests for each operator: `+`, `-`, `*`, `/`, `<<`, `>>`, `&`, `|`, `^`
2. Write tests for parentheses and operator precedence
3. Write tests for label arithmetic (e.g., `LABEL+5`, `END-START`)

## Expressions to Support
- Binary operators: `+`, `-`, `*`, `/`
- Bitwise: `&`, `|`, `^`, `<<`, `>>`
- Unary: `-`, `~`, `<` (low byte), `>` (high byte)
- Parentheses for grouping
- Label references in expressions
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Tests written first for each operator
- [ ] #2 Arithmetic operators work (+, -, *, /)
- [ ] #3 Bitwise operators work (&, |, ^, <<, >>)
- [ ] #4 Unary operators work (-, ~, <, >)
- [ ] #5 Parentheses respected for grouping
- [ ] #6 Label arithmetic works (LABEL+offset)
<!-- AC:END -->
