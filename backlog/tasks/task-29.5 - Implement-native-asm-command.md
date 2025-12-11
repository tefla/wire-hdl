---
id: task-29.5
title: Implement native asm command
status: To Do
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

**Requires:** task-27.4 (self-hosting assembler) - the assembler must be compiled to native RISC-V code first.

**Program flow:**
1. Parse source and output filenames from args
2. fopen source file
3. Run assembler on source
4. fopen output file
5. fwrite assembled binary
6. fclose both files
7. Exit

This is the most complex native command as it requires the full assembler to run natively.

## Acceptance Criteria

- [ ] ASM.BIN is a real RISC-V executable
- [ ] Can assemble HELLO.ASM to HELLO.BIN
- [ ] Output binary is valid RISV executable
- [ ] Assembled program runs correctly
- [ ] Same output as TypeScript built-in version
- [ ] 5+ tests for native asm
