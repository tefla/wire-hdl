---
id: task-5.3
title: 'Assembler: Symbol table and label resolution with tests'
status: Done
assignee: []
created_date: '2025-12-11 12:00'
labels:
  - riscv
  - assembler
  - tdd
dependencies:
  - task-5.2
parent_task_id: task-5
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement symbol table management and two-pass label resolution. TDD approach.

**Features:**
- Symbol definition (labels, .equ constants)
- Forward reference resolution (two-pass assembly)
- Backward reference resolution
- Duplicate symbol detection
- Undefined symbol detection
- Scope management (if needed for local labels)
<!-- SECTION:DESCRIPTION:END -->

## Test Cases Required

<!-- SECTION:NOTES:BEGIN -->
**Basic label tests:**
1. Define label, reference after (backward ref)
2. Reference label, define after (forward ref)
3. Multiple labels at same address
4. Labels in different sections

**Constant tests (.equ):**
1. Define constant, use in immediate
2. Forward reference to constant
3. Constant expressions (if supported)

**Error tests:**
1. Duplicate label definition
2. Undefined label reference
3. Reserved names used as labels

**Address calculation tests:**
1. Labels track correct addresses
2. .org directive updates address correctly
3. .align directive pads correctly
4. Branch offset calculation (PC-relative)
5. Jump offset calculation
<!-- SECTION:NOTES:END -->

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] Forward references resolve correctly
- [ ] Backward references resolve correctly
- [ ] PC-relative offsets calculated correctly for branches
- [ ] Absolute addresses calculated correctly for jumps
- [ ] Duplicate symbols produce clear error
- [ ] Undefined symbols produce clear error with location
- [ ] 25+ test cases for symbol resolution
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
