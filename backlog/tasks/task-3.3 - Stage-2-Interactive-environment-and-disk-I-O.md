---
id: task-3.3
title: 'Stage 2: Interactive environment and disk I/O'
status: To Do
assignee: []
created_date: '2025-12-09 14:55'
updated_date: '2025-12-09 14:58'
labels:
  - forth
  - disk
  - repl
dependencies:
  - task-3.2
parent_task_id: task-3
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build out the interactive development environment and add disk I/O capabilities so FORTH programs can be loaded from and saved to disk.

This stage makes FORTH practical for development by adding:
- Source file loading
- Word listing and inspection
- Error handling
- Block-based or file-based disk storage
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 WORDS command lists all defined words
- [ ] #2 SEE word shows definition/decompiles a word
- [ ] #3 LOAD reads and executes FORTH source from disk file
- [ ] #4 SAVE-SYSTEM creates bootable FORTH image
- [ ] #5 Error messages for undefined words
- [ ] #6 Error messages for stack underflow
- [ ] #7 ABORT and ABORT" for error handling
- [ ] #8 Query/refill input from keyboard or file
- [ ] #9 . (dot) prints top of stack as number
- [ ] #10 .S prints entire stack non-destructively
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### 1. Numeric Output
Implement . (dot) to print numbers:
```forth
: .       ( n -- )
    DUP 0< IF          \ handle negative
        45 EMIT        \ print '-'
        NEGATE
    THEN
    0                  \ push digit count
    BEGIN
        SWAP 10 /MOD   \ n/10, n%10
        48 +           \ convert to ASCII
        SWAP 1+        \ increment count
        OVER 0=        \ until quotient is 0
    UNTIL
    DROP
    BEGIN
        DUP 0>
    WHILE
        EMIT           \ print digits in reverse
        1-
    REPEAT
    DROP
    32 EMIT            \ trailing space
;

: .S      ( -- )       \ print stack non-destructively
    60 EMIT            \ '<'
    DEPTH .            \ print depth
    62 EMIT 32 EMIT    \ '> '
    DEPTH 0 ?DO
        DEPTH I - 1- PICK .
    LOOP
;
```

### 2. Error Handling
Implement ABORT:
```forth
VARIABLE 'ABORT        \ holds abort handler address

: ABORT   ( -- )
    SP0 SP!            \ reset data stack
    RP0 RP!            \ reset return stack
    'ABORT @ EXECUTE   \ run abort handler (usually QUIT)
;

: ABORT"  ( flag -- )  \ abort with message if flag true
    IF
        [CHAR] " PARSE TYPE
        ABORT
    ELSE
        [CHAR] " PARSE 2DROP
    THEN
; IMMEDIATE
```

### 3. Input Buffer and WORD
Enhance input handling:
```forth
VARIABLE TIB     80 ALLOT   \ terminal input buffer
VARIABLE #TIB               \ chars in buffer
VARIABLE >IN                \ parse position

: REFILL  ( -- flag )
    TIB 80 ACCEPT           \ read line from keyboard
    #TIB !
    0 >IN !
    TRUE
;

: SOURCE  ( -- addr len )  TIB #TIB @ ;

: WORD    ( char -- addr )
    \ skip leading delimiters, parse to delimiter
    \ return counted string in HERE
;
```

### 4. FIND and Dictionary Lookup
```forth
: FIND    ( addr -- addr 0 | xt 1 | xt -1 )
    \ addr is counted string
    \ returns: 0 if not found
    \          1 if immediate
    \         -1 if normal
    LATEST @           \ start at most recent word
    BEGIN
        DUP
    WHILE
        2DUP           \ ( str link str link )
        \ compare names...
        IF             \ found it
            NIP        \ ( link )
            DUP >CFA   \ get code field address
            SWAP       \ ( xt link )
            \ check immediate flag
            RETURN
        THEN
        @              \ follow link to previous
    REPEAT
    DROP 0             \ not found
;
```

### 5. WORDS Command
```forth
: WORDS   ( -- )
    CR
    LATEST @           \ start at most recent
    BEGIN
        DUP
    WHILE
        DUP            \ ( link link )
        COUNT TYPE     \ print name (after link field)
        SPACE
        @              \ follow link
    REPEAT
    DROP
;
```

### 6. SEE - Decompiler
```forth
: SEE     ( "name" -- )
    '                  \ get execution token
    DUP @ DOCOL = IF   \ is it a colon definition?
        ." : " DUP >NAME TYPE SPACE
        >BODY          \ get to parameter field
        BEGIN
            DUP @ DUP EXIT-XT <>
        WHILE
            DUP @ >NAME TYPE SPACE
            CELL+
        REPEAT
        DROP
        ." ; "
    ELSE
        ." Primitive or CODE word"
    THEN
    CR
;
```

### 7. Disk I/O - File Loading
Integrate with WireOS filesystem:
```forth
VARIABLE SOURCE-ID     \ 0=keyboard, >0=file handle

: OPEN-FILE   ( addr len mode -- handle ior )
    \ call WireOS file open syscall
;

: READ-LINE   ( addr len handle -- len2 flag ior )
    \ call WireOS file read syscall
;

: CLOSE-FILE  ( handle -- ior )
    \ call WireOS file close syscall
;

: INCLUDE  ( "filename" -- )
    BL WORD COUNT       \ parse filename
    R/O OPEN-FILE       \ open for reading
    THROW               \ abort on error
    SOURCE-ID !
    BEGIN
        TIB 80 SOURCE-ID @ READ-LINE
        THROW           \ abort on error
    WHILE
        #TIB !
        0 >IN !
        INTERPRET       \ process line
    REPEAT
    SOURCE-ID @ CLOSE-FILE THROW
    0 SOURCE-ID !       \ back to keyboard
;
```

Simpler block-based alternative:
```forth
: LOAD    ( blk# -- )
    BLOCK             \ get block buffer address
    1024 EVALUATE     \ interpret the block
;
```

### 8. SAVE-SYSTEM
Save current dictionary state as loadable image:
```forth
: SAVE-SYSTEM  ( "filename" -- )
    BL WORD COUNT
    W/O CREATE-FILE THROW
    \ write header with HERE, LATEST pointers
    \ write dictionary from $0400 to HERE
    CLOSE-FILE THROW
;
```

### 9. QUIT - Outer Interpreter Loop
```forth
: QUIT    ( -- )
    RP0 RP!            \ reset return stack
    0 SOURCE-ID !      \ keyboard input
    BEGIN
        REFILL
    WHILE
        INTERPRET
        STATE @ 0= IF
            ."  ok" CR
        THEN
    REPEAT
    BYE                \ exit to WireOS
;
```

### 10. Error Messages
```forth
: ?STACK  ( -- )
    DEPTH 0< IF
        ." Stack underflow" ABORT
    THEN
;

: INTERPRET ( -- )
    BEGIN
        BL WORD DUP C@
    WHILE
        FIND ?DUP IF
            STATE @ IF
                0> IF EXECUTE ELSE , THEN
            ELSE
                DROP EXECUTE
            THEN
        ELSE
            NUMBER?
            IF
                STATE @ IF ['] LIT , , THEN
            ELSE
                TYPE ."  ?" ABORT
            THEN
        THEN
        ?STACK
    REPEAT
    DROP
;
```

### Files to Create/Modify
- `asm/forth-io.fth` - I/O and interactive words
- Modify `asm/forth.asm` - add file I/O primitives using WireOS syscalls
- Create sample `.fth` files for testing INCLUDE
<!-- SECTION:PLAN:END -->
