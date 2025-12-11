---
id: task-5.4
title: 'Assembler: Binary encoding for all instruction types with tests'
status: To Do
assignee: []
created_date: '2025-12-11 12:00'
labels:
  - riscv
  - assembler
  - tdd
dependencies:
  - task-5.3
parent_task_id: task-5
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement binary encoding for all RV32I instructions. Each instruction type has a specific encoding format. TDD approach - verify against RISC-V specification.

**Encoding Formats:**
- R-type: funct7[6:0] | rs2[4:0] | rs1[4:0] | funct3[2:0] | rd[4:0] | opcode[6:0]
- I-type: imm[11:0] | rs1[4:0] | funct3[2:0] | rd[4:0] | opcode[6:0]
- S-type: imm[11:5] | rs2[4:0] | rs1[4:0] | funct3[2:0] | imm[4:0] | opcode[6:0]
- B-type: imm[12|10:5] | rs2[4:0] | rs1[4:0] | funct3[2:0] | imm[4:1|11] | opcode[6:0]
- U-type: imm[31:12] | rd[4:0] | opcode[6:0]
- J-type: imm[20|10:1|11|19:12] | rd[4:0] | opcode[6:0]
<!-- SECTION:DESCRIPTION:END -->

## Test Cases Required

<!-- SECTION:NOTES:BEGIN -->
**R-type encoding tests:**
- ADD x1, x2, x3 -> 0x003100B3
- SUB x1, x2, x3 -> 0x403100B3
- Test each R-type instruction

**I-type encoding tests:**
- ADDI x1, x2, 100 -> verify encoding
- LW x1, 4(x2) -> verify encoding
- Negative immediates

**S-type encoding tests:**
- SW x1, 0(x2) -> verify encoding
- Negative offsets
- Maximum offset values

**B-type encoding tests:**
- BEQ x1, x2, +8 -> verify encoding
- Negative branch offsets
- Maximum branch range

**U-type encoding tests:**
- LUI x1, 0x12345 -> verify encoding
- AUIPC x1, 0x12345 -> verify encoding

**J-type encoding tests:**
- JAL x1, +100 -> verify encoding
- Negative offsets
- Maximum jump range

**Reference encodings:**
Use RISC-V specification or cross-check with existing assembler (gas) output.
<!-- SECTION:NOTES:END -->

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] All R-type instructions encode correctly
- [ ] All I-type instructions encode correctly
- [ ] All S-type instructions encode correctly (split immediate)
- [ ] All B-type instructions encode correctly (scrambled immediate)
- [ ] All U-type instructions encode correctly
- [ ] All J-type instructions encode correctly (scrambled immediate)
- [ ] Immediate range validation with clear errors
- [ ] 50+ encoding tests verified against spec
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
