---
id: task-5.1
title: 'Assembler: Lexer/tokenizer with comprehensive tests'
status: Done
assignee: []
created_date: '2025-12-11 12:00'
labels:
  - riscv
  - assembler
  - tdd
dependencies: []
parent_task_id: task-5
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a lexer/tokenizer for RISC-V assembly source code using TDD. Write tests first, then implement.

**Token Types to Support:**
- Instructions (ADD, LW, BEQ, etc.)
- Registers (x0-x31, zero, ra, sp, etc. aliases)
- Labels (identifier followed by colon)
- Label references (identifiers in operand position)
- Numeric literals (decimal, hex 0x, binary 0b)
- String literals (for .ascii/.asciiz)
- Directives (.org, .byte, .word, etc.)
- Operators (comma, parentheses for addressing)
- Comments (; or # to end of line)
- Newlines (significant for statement separation)
<!-- SECTION:DESCRIPTION:END -->

## Test Cases Required

<!-- SECTION:NOTES:BEGIN -->
**Minimum test coverage:**
1. Single instruction tokenization (e.g., "ADD x1, x2, x3")
2. Register aliases (zero, ra, sp, gp, tp, t0-t6, s0-s11, a0-a7)
3. Numeric formats: decimal (42), hex (0x2A), binary (0b101010)
4. Negative numbers and expressions
5. Label definitions ("main:", "_start:")
6. Label references in operands
7. Memory addressing syntax: "LW x1, 4(x2)"
8. Directives with arguments: ".org 0x1000", ".word 0xDEADBEEF"
9. String literals: ".ascii \"Hello\""
10. Comments: full line and inline
11. Empty lines and whitespace handling
12. Error cases: invalid tokens, unterminated strings
<!-- SECTION:NOTES:END -->

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] All token types correctly identified
- [ ] Line and column numbers tracked for error reporting
- [ ] Register aliases map to correct register numbers
- [ ] Hex, decimal, and binary literals parsed correctly
- [ ] Comments stripped but line numbers preserved
- [ ] Comprehensive test suite with 20+ test cases
- [ ] Edge cases handled (empty input, whitespace-only lines)
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
