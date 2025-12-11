---
id: task-5.2
title: 'Assembler: Parser for RV32I instructions with tests'
status: Done
assignee: []
created_date: '2025-12-11 12:00'
labels:
  - riscv
  - assembler
  - tdd
dependencies:
  - task-5.1
parent_task_id: task-5
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a parser that converts tokens into an AST representing assembly statements. TDD approach - write tests first.

**Statement Types:**
- Instruction statements (opcode + operands)
- Label definitions
- Directive statements
- Empty statements (blank lines/comments only)

**Operand Types:**
- Register operands
- Immediate operands (numeric or label reference)
- Memory operands (offset + base register)
<!-- SECTION:DESCRIPTION:END -->

## Test Cases Required

<!-- SECTION:NOTES:BEGIN -->
**R-type instruction tests:**
- ADD x1, x2, x3
- SUB, AND, OR, XOR, SLL, SRL, SRA, SLT, SLTU

**I-type instruction tests:**
- ADDI x1, x2, 100
- LW x1, 0(x2)
- LB, LH, LBU, LHU with various offsets
- JALR x1, x2, 0

**S-type instruction tests:**
- SW x1, 0(x2)
- SB, SH with positive and negative offsets

**B-type instruction tests:**
- BEQ x1, x2, label
- BNE, BLT, BGE, BLTU, BGEU

**U-type instruction tests:**
- LUI x1, 0x12345
- AUIPC x1, 0x12345

**J-type instruction tests:**
- JAL x1, label
- JAL ra, label (using alias)

**Error handling tests:**
- Wrong number of operands
- Invalid register names
- Immediate out of range
- Invalid instruction names
<!-- SECTION:NOTES:END -->

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] All RV32I instructions parse correctly
- [ ] Operand validation (correct types, ranges)
- [ ] AST nodes contain source location for errors
- [ ] Error messages are clear and actionable
- [ ] 40+ test cases covering all instruction types
- [ ] Edge cases: max/min immediates, all registers
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
