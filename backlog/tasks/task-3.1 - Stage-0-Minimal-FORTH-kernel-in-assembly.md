---
id: task-3.1
title: 'Stage 0: Minimal FORTH kernel in assembly'
status: To Do
assignee: []
created_date: '2025-12-09 14:54'
updated_date: '2025-12-09 14:58'
labels:
  - forth
  - assembly
  - bootstrap
dependencies: []
parent_task_id: task-3
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the minimal FORTH kernel in 6502 assembly. This is the foundation that everything else builds upon.

The kernel implements:
- Direct threaded code (DTC) interpreter
- Data stack and return stack management
- Core primitives that cannot be written in FORTH
- Basic I/O for terminal interaction
- Dictionary structure for word lookup

This stage should be as small as possible while still being capable of bootstrapping the next stage.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Direct threaded code interpreter (NEXT, DOCOL, EXIT)
- [ ] #2 Data stack with push/pop operations (8-bit or 16-bit cells)
- [ ] #3 Return stack for nested word calls
- [ ] #4 Dictionary structure with linked list of words
- [ ] #5 FIND word to look up words in dictionary
- [ ] #6 NUMBER to parse numeric literals
- [ ] #7 KEY and EMIT for single character I/O
- [ ] #8 Core primitives: LIT, @, !, C@, C!, +, -, AND, OR, XOR
- [ ] #9 Stack operations: DUP, DROP, SWAP, OVER, >R, R>
- [ ] #10 Outer interpreter loop (read word, find/execute or parse number)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### 1. Memory Layout Design
- Define zero page usage for interpreter registers:
  - IP (Instruction Pointer) - 2 bytes
  - W (Working register) - 2 bytes  
  - SP (Data stack pointer) - 1 byte (stack in page $02)
  - RP (Return stack pointer) - 1 byte (stack in page $03)
- Data stack grows downward from $02FF
- Return stack grows downward from $03FF
- Dictionary starts at $0400, grows upward
- HERE pointer tracks end of dictionary

### 2. Threading Model (Direct Threaded Code)
Implement the inner interpreter:
```
NEXT:   LDY #0
        LDA (IP),Y      ; fetch low byte of next word address
        STA W
        INY
        LDA (IP),Y      ; fetch high byte
        STA W+1
        CLC
        LDA IP
        ADC #2          ; advance IP past this cell
        STA IP
        BCC +
        INC IP+1
+       JMP (W)         ; jump to code field
```

### 3. DOCOL and EXIT
DOCOL pushes IP to return stack, sets IP to parameter field:
```
DOCOL:  LDA IP+1        ; push current IP to return stack
        PHA
        LDA IP
        PHA
        CLC
        LDA W           ; W points to code field
        ADC #2          ; parameter field is 2 bytes after
        STA IP
        LDA W+1
        ADC #0
        STA IP+1
        JMP NEXT
```

EXIT pops IP from return stack:
```
EXIT:   PLA
        STA IP
        PLA
        STA IP+1
        JMP NEXT
```

### 4. Dictionary Structure
Each word entry contains:
- Link field (2 bytes) - pointer to previous word
- Name length + flags (1 byte) - bit 7=immediate, bit 6=hidden, bits 0-5=length
- Name (variable length, up to 31 chars)
- Code field (2 bytes) - address of machine code (DOCOL for colon defs)
- Parameter field (variable) - for colon defs, list of word addresses

### 5. Stack Primitives
Implement in assembly:
- PUSH: decrement SP, store to stack
- POP: load from stack, increment SP
- DUP, DROP, SWAP, OVER, >R, R>

### 6. Memory Access Primitives
- @ (fetch): pop address, push 16-bit value at address
- ! (store): pop address, pop value, store value at address
- C@ (char-fetch): pop address, push byte at address
- C! (char-store): pop address, pop value, store low byte

### 7. Arithmetic Primitives
- + : pop two values, push sum
- - : pop two values, push difference (NOS - TOS)
- AND, OR, XOR: bitwise operations

### 8. I/O Primitives
- KEY: call BIOS keyboard input, push character
- EMIT: pop character, call BIOS character output

### 9. Outer Interpreter
Main loop:
1. WORD - read whitespace-delimited token into buffer
2. FIND - search dictionary for token
3. If found and executing: execute word
4. If found and compiling: compile word address (or execute if immediate)
5. If not found: try NUMBER to parse as numeric literal
6. If number and executing: push to stack
7. If number and compiling: compile LIT followed by value
8. If neither: print error

### 10. Initial Dictionary
Build initial dictionary with assembly primitives:
- Link words together at assembly time
- Use macros for consistent word header format
- Start with: DUP DROP SWAP OVER >R R> @ ! C@ C! + - AND OR XOR KEY EMIT LIT EXIT

### Files to Create
- `asm/forth.asm` - main FORTH kernel source
- Update `src/bootstrap/disk-image.ts` to include FORTH.COM
<!-- SECTION:PLAN:END -->
