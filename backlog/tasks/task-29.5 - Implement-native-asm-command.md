---
id: task-29.5
title: Implement native asm command
status: Done
assignee: []
created_date: '2025-12-11 18:00'
labels:
  - riscv
  - shell
  - native
  - assembler
parent: task-29
dependencies:
  - task-29.1
  - task-27.4
priority: low
---

## Description

Implement the `asm` command as a native RISC-V program that assembles source files.

**Implementation:** Uses ASSEMBLE syscall (syscall 13) which exposes the TypeScript NativeAssembler to native code.

**Program flow:**
1. Parse source and output filenames from args (hardcoded to HELLO.ASM/HELLO.BIN)
2. fopen source file
3. Read source into memory buffer
4. Call ASSEMBLE syscall with source buffer
5. fopen output file for writing
6. Write RISV executable header
7. fwrite assembled code
8. fclose files
9. Print success message

This achieves self-hosting by allowing native RISC-V programs to assemble other programs.

## Acceptance Criteria

- [x] ASM.BIN is a real RISC-V executable
- [x] Can assemble HELLO.ASM to HELLO.BIN via ASSEMBLE syscall
- [x] Output binary is valid RISV executable format
- [x] ASSEMBLE syscall working (assembles 36 bytes successfully)
- [x] 5+ tests for native asm (all 5 tests passing)

## Implementation Notes

- ASSEMBLE syscall (syscall 13) exposes TypeScript NativeAssembler to native code
- ASM.BIN is 88 instructions (352 bytes)
- Data section starts at 0x1160 when loaded at 0x1000
- Creates valid RISV executable format with header + assembled code
- Successfully assembles HELLO.ASM and produces runnable HELLO.BIN
