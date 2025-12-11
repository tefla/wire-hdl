---
id: riscv-15
title: Program loader
status: To Do
assignee: []
created_date: '2025-12-11 16:00'
labels:
  - riscv
  - loader
  - executable
dependencies:
  - riscv-14
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a program loader that can load and execute programs from disk.

**Executable Format (Simple):**
```
Offset  Size  Description
0x00    4     Magic number (0x52495356 = "RISV")
0x04    4     Entry point offset
0x08    4     Code size in bytes
0x0C    4     Data size in bytes
0x10    4     BSS size (zero-initialized)
0x14    4     Stack size requested
0x18    N     Code section
0x18+N  M     Data section (initialized)
```

**Loading Process:**
1. Read header from disk
2. Validate magic number
3. Allocate memory for code + data + bss + stack
4. Load code and data sections
5. Zero BSS section
6. Set up stack pointer
7. Jump to entry point

**Return to Shell:**
- Program calls exit syscall
- Loader regains control
- Memory is freed (or just reused)
<!-- SECTION:DESCRIPTION:END -->

## Subtasks

- [ ] riscv-15.1: Define executable format and header structure
- [ ] riscv-15.2: Implement loader in shell/OS
- [ ] riscv-15.3: Create tool to build executable images

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] Executable format is documented
- [ ] Loader validates executable header
- [ ] Loader correctly loads code and data
- [ ] BSS section is zeroed
- [ ] Stack is set up correctly
- [ ] Program executes and can return to shell
- [ ] 10+ tests for loader
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
