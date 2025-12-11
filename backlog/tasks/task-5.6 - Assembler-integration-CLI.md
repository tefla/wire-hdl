---
id: task-5.6
title: 'Assembler: Integration tests and CLI interface'
status: To Do
assignee: []
created_date: '2025-12-11 12:00'
labels:
  - riscv
  - assembler
  - tdd
dependencies:
  - task-5.5
parent_task_id: task-5
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create integration tests with complete assembly programs and a simple CLI interface for the assembler. TDD approach.

**CLI Features:**
- Input file argument
- Output file argument (-o)
- Binary output format
- Optional hex dump output for debugging
- Error reporting to stderr
- Return code 0 on success, non-zero on error

**Integration Test Programs:**
- Minimal program (single instruction)
- Program with data section
- Program with branches and loops
- Program calling subroutines
- Complete bootloader skeleton
<!-- SECTION:DESCRIPTION:END -->

## Test Cases Required

<!-- SECTION:NOTES:BEGIN -->
**Integration test programs:**

1. **hello_cpu.asm** - Minimal test
```asm
.org 0x0000
    li x1, 42      ; Load immediate
    addi x2, x1, 1 ; x2 = 43
    ebreak         ; Stop
```

2. **loop.asm** - Branch test
```asm
.org 0x0000
    li x1, 10      ; Counter
loop:
    addi x1, x1, -1
    bnez x1, loop  ; Branch if not zero
    ebreak
```

3. **subroutine.asm** - Call/return test
```asm
.org 0x0000
    jal ra, double
    ebreak
double:
    add a0, a0, a0
    ret
```

4. **data.asm** - Data section test
```asm
.org 0x0000
    la x1, message
    lb x2, 0(x1)
    ebreak
.org 0x0100
message:
    .asciiz "Hello"
```

5. **bootloader_skeleton.asm** - Real-world test
```asm
; RISC-V Bootloader Skeleton
.org 0x0000
_start:
    ; Set up stack pointer
    lui sp, 0x10000
    ; Jump to main
    jal ra, main
    ; Halt
    ebreak
main:
    ; Bootloader code here
    ret
```

**Error handling tests:**
1. Syntax error produces clear message
2. Undefined label produces clear message
3. Invalid instruction produces clear message
4. File not found handled gracefully
<!-- SECTION:NOTES:END -->

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] CLI accepts input/output file arguments
- [ ] Binary output matches expected bytes
- [ ] All integration test programs assemble correctly
- [ ] Output can be loaded into emulator and executed
- [ ] Error messages include filename and line number
- [ ] Exit codes are correct (0 success, 1 error)
- [ ] 10+ integration tests with real programs
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
