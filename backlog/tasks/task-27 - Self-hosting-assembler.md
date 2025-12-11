---
id: task-27
title: Self-hosting assembler
status: Done
assignee: []
created_date: '2025-12-11 16:00'
labels:
  - riscv
  - assembler
  - self-hosting
dependencies:
  - task-25
  - task-26
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

- [x] task-27.1: Design minimal assembler subset for Stage 1
- [x] task-27.2: Implement NativeAssembler with full RV32I support
- [x] task-27.3: Implement file operations (read source, write binary)
- [ ] task-27.4: Compile NativeAssembler to native RISC-V code (deferred)

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [x] NativeAssembler runs with CPU and filesystem integration
- [x] Assembler can assemble basic programs (all RV32I instructions)
- [x] Full instruction set support (LUI, AUIPC, JAL, JALR, branches, loads, stores, ALU)
- [x] Labels, directives (.byte, .word, .ascii, .asciiz, .space), comments
- [x] File operations (read source, write binary)
- [x] Register aliases (x0-x31, ABI names)
- [x] 30+ tests for assembler operations (33 tests implemented)
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
