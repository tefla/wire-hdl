---
id: task-3.2
title: 'Stage 1: Core FORTH words in FORTH'
status: To Do
assignee: []
created_date: '2025-12-09 14:55'
updated_date: '2025-12-09 14:58'
labels:
  - 6502
  - forth
  - bootstrap
dependencies:
  - task-3.1
parent_task_id: task-3
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Using the Stage 0 kernel primitives, implement the core FORTH vocabulary in FORTH itself. This demonstrates the bootstrapping capability and builds out the standard word set.

This stage adds:
- Arithmetic and comparison words built from primitives
- Additional stack manipulation
- Control flow structures
- String handling basics
- Compiler words for defining new words
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Arithmetic: NEGATE, ABS, MIN, MAX, */
- [ ] #2 Comparison: 0=, 0<, 0>, =, <>, <, >, U<
- [ ] #3 Stack: NIP, TUCK, 2DUP, 2DROP, 2SWAP, 2OVER, ?DUP
- [ ] #4 Logic: TRUE, FALSE, INVERT
- [ ] #5 Compiler: : (colon) and ; (semicolon) for word definitions
- [ ] #6 Compiler: IMMEDIATE, [ and ] for compile/interpret mode switching
- [ ] #7 Control: IF, ELSE, THEN compiled as branches
- [ ] #8 Control: BEGIN, UNTIL, WHILE, REPEAT
- [ ] #9 Control: DO, LOOP, +LOOP, I, J, LEAVE
- [ ] #10 Memory: HERE, ALLOT, , (comma), C, (c-comma)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### 1. Compiler Infrastructure
First, implement STATE variable and compilation mode:
```forth
VARIABLE STATE    \ 0 = interpreting, non-zero = compiling
: [ 0 STATE ! ; IMMEDIATE
: ] 1 STATE ! ;
```

Implement comma operators to compile values:
```forth
: HERE   ( -- addr ) DP @ ;           \ DP = dictionary pointer variable
: ALLOT  ( n -- )   DP +! ;           \ advance dictionary pointer
: ,      ( x -- )   HERE !  2 ALLOT ; \ compile 16-bit value
: C,     ( c -- )   HERE C! 1 ALLOT ; \ compile 8-bit value
```

### 2. Colon Compiler (: and ;)
The colon definition compiler:
```forth
: :
    CREATE          \ make dictionary entry
    DOCOL ,         \ compile DOCOL as code field
    ]               \ enter compile mode
;

: ;
    ['] EXIT ,      \ compile EXIT
    [               \ return to interpret mode
; IMMEDIATE
```

Note: CREATE, DOCOL address, and ['] need assembly support initially.

### 3. Control Flow - Branching Primitives
Implement in assembly:
- BRANCH: unconditional branch (IP += offset)
- 0BRANCH: branch if TOS = 0

Then build control structures:
```forth
: IF      ( -- addr )  ['] 0BRANCH ,  HERE  0 , ; IMMEDIATE
: THEN    ( addr -- )  HERE SWAP ! ; IMMEDIATE
: ELSE    ( addr1 -- addr2 )  ['] BRANCH ,  HERE 0 ,  SWAP HERE SWAP ! ; IMMEDIATE
```

### 4. Control Flow - Loops
BEGIN/UNTIL/WHILE/REPEAT:
```forth
: BEGIN   ( -- addr )  HERE ; IMMEDIATE
: UNTIL   ( addr -- )  ['] 0BRANCH ,  , ; IMMEDIATE
: WHILE   ( addr1 -- addr1 addr2 )  ['] 0BRANCH ,  HERE 0 , ; IMMEDIATE
: REPEAT  ( addr1 addr2 -- )  ['] BRANCH ,  SWAP ,  HERE SWAP ! ; IMMEDIATE
```

DO/LOOP (requires return stack manipulation):
```forth
: DO      ( -- addr )  ['] >R , ['] >R ,  HERE ; IMMEDIATE
: LOOP    ( addr -- )  ['] R> , ['] 1+ , ['] R> , 
          ['] 2DUP , ['] = , ['] 0BRANCH ,  ,
          ['] 2DROP , ; IMMEDIATE
: I       ( -- n )  R> R> DUP >R SWAP >R ; 
```

### 5. Arithmetic Extensions
Build from primitives:
```forth
: NEGATE  ( n -- -n )     0 SWAP - ;
: ABS     ( n -- |n| )    DUP 0< IF NEGATE THEN ;
: MIN     ( a b -- min )  2DUP > IF SWAP THEN DROP ;
: MAX     ( a b -- max )  2DUP < IF SWAP THEN DROP ;
: */      ( a b c -- a*b/c )  >R * R> / ;
```

### 6. Comparison Words
```forth
: 0=      ( n -- flag )  0 = ;
: 0<      ( n -- flag )  0 < ;
: 0>      ( n -- flag )  0 > ;
: <>      ( a b -- flag ) = NOT ;
: <=      ( a b -- flag ) > NOT ;
: >=      ( a b -- flag ) < NOT ;
```

For signed comparison, need to handle sign bit:
```forth
: <       ( a b -- flag )  - 0< ;
: >       ( a b -- flag )  SWAP < ;
```

### 7. Extended Stack Operations
```forth
: NIP     ( a b -- b )      SWAP DROP ;
: TUCK    ( a b -- b a b )  SWAP OVER ;
: 2DUP    ( a b -- a b a b ) OVER OVER ;
: 2DROP   ( a b -- )        DROP DROP ;
: 2SWAP   ( a b c d -- c d a b )  >R ROT ROT R> ROT ROT ;
: 2OVER   ( a b c d -- a b c d a b )  >R >R 2DUP R> R> 2SWAP ;
: ?DUP    ( n -- n n | 0 )  DUP IF DUP THEN ;
```

### 8. Logic Words
```forth
: TRUE    ( -- -1 )  -1 ;
: FALSE   ( -- 0 )   0 ;
: INVERT  ( n -- ~n ) -1 XOR ;
: NOT     ( n -- flag ) 0= ;
```

### 9. IMMEDIATE Flag
Implement in assembly: IMMEDIATE sets bit 7 of most recent word's length byte.

### 10. Integration
- Create `asm/forth-core.fth` with these definitions
- Load automatically after kernel boots
- Test each word category independently

### Files to Create/Modify
- `asm/forth-core.fth` - Stage 1 FORTH definitions
- Modify `asm/forth.asm` to auto-load core definitions
<!-- SECTION:PLAN:END -->
