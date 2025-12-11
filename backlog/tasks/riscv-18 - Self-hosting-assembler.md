---
id: riscv-18
title: Self-hosting assembler
status: To Do
assignee: []
created_date: '2025-12-11 16:00'
labels:
  - riscv
  - assembler
  - self-hosting
dependencies:
  - riscv-16
  - riscv-17
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Port the RISC-V assembler to run natively on the RISC-V emulator, enabling self-hosting development.

**Goals:**
- Assembler runs on the emulator itself
- Can assemble source files from disk
- Outputs executable files to disk
- Enables development without host tools

**Implementation Approach:**
1. **Stage 0**: Current TypeScript assembler (host)
2. **Stage 1**: Minimal assembler in RISC-V assembly (hand-written or generated)
3. **Stage 2**: Full assembler assembled by Stage 1

**Minimal Assembler Features (Stage 1):**
- Basic instructions (LUI, ADDI, ADD, SUB, LW, SW, BEQ, JAL, ECALL)
- Labels and forward references
- Simple directives (.byte, .word, .ascii)
- Single-pass or two-pass

**Bootstrap Process:**
1. Write Stage 1 assembler in RISC-V assembly
2. Assemble Stage 1 using host assembler → stage1.bin
3. Write Stage 2 assembler source (more complete)
4. Run stage1.bin on emulator to assemble Stage 2 → stage2.bin
5. Stage 2 can now assemble itself (self-hosting achieved)
<!-- SECTION:DESCRIPTION:END -->

## Subtasks

- [ ] riscv-18.1: Design minimal assembler subset for Stage 1
- [ ] riscv-18.2: Implement Stage 1 assembler in RISC-V assembly
- [ ] riscv-18.3: Implement Stage 2 assembler with full features
- [ ] riscv-18.4: Verify self-hosting (Stage 2 assembles itself)

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] Stage 1 assembler runs on emulator
- [ ] Stage 1 can assemble basic programs
- [ ] Stage 2 assembler has full feature set
- [ ] Stage 2 can assemble its own source code
- [ ] Output matches host assembler output
- [ ] Development workflow documented
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
