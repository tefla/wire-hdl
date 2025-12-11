---
id: task-5
title: RISC-V assembler for BIOS and bootloader development
status: Done
assignee: []
created_date: '2025-12-11 12:00'
labels:
  - riscv
  - assembler
  - tooling
  - feature
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build a RISC-V RV32I assembler in TypeScript that can assemble BIOS and bootloader code. The assembler must support all RV32I instructions and common assembler directives.

**TDD Approach:** Every component must be developed test-first with comprehensive unit tests before implementation.

**Target Use Cases:**
- Assemble BIOS ROM code
- Assemble bootloader for various storage media
- Support for modular assembly with includes

**Key Requirements:**
- Full RV32I instruction set support
- Label and symbol resolution
- Numeric literals (decimal, hex, binary)
- Assembler directives (.org, .byte, .half, .word, .ascii, .asciiz, .align, .equ)
- Clear error messages with line numbers
- Binary output suitable for ROM/RAM loading
<!-- SECTION:DESCRIPTION:END -->

## Subtasks

- [ ] task-5.1: Lexer/tokenizer with comprehensive tests
- [ ] task-5.2: Parser for RV32I instructions with tests
- [ ] task-5.3: Symbol table and label resolution with tests
- [ ] task-5.4: Binary encoding for all instruction types with tests
- [ ] task-5.5: Assembler directives with tests
- [ ] task-5.6: Integration tests and CLI interface

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] All RV32I instructions can be assembled correctly
- [ ] Labels resolve correctly (forward and backward references)
- [ ] Directives work as expected (.org, .byte, .word, etc.)
- [ ] Error messages include line numbers and clear descriptions
- [ ] Test coverage > 90% for all assembler modules
- [ ] Can successfully assemble a simple bootloader
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->

## Technical Notes

<!-- SECTION:NOTES:BEGIN -->
**Instruction Formats to Support:**
- R-type: ADD, SUB, AND, OR, XOR, SLL, SRL, SRA, SLT, SLTU
- I-type: ADDI, ANDI, ORI, XORI, SLTI, SLTIU, SLLI, SRLI, SRAI, LB, LH, LW, LBU, LHU, JALR
- S-type: SB, SH, SW
- B-type: BEQ, BNE, BLT, BGE, BLTU, BGEU
- U-type: LUI, AUIPC
- J-type: JAL
- System: ECALL, EBREAK

**Pseudo-instructions to consider:**
- NOP (ADDI x0, x0, 0)
- LI (load immediate - may need LUI + ADDI)
- LA (load address)
- MV (move register)
- J (unconditional jump)
- RET (return)
- CALL (function call)
<!-- SECTION:NOTES:END -->
