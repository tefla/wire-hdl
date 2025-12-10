---
id: task-3.4
title: 'Stage 3: Extended vocabulary and self-improvement'
status: To Do
assignee: []
created_date: '2025-12-09 14:55'
updated_date: '2025-12-09 14:58'
labels:
  - forth
  - bootstrap
  - self-hosting
dependencies:
  - task-3.3
parent_task_id: task-3
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement extended FORTH vocabulary including string handling, formatted output, and utilities. At this stage, FORTH should be capable of writing its own extensions and tools.

This is the "self-hosting" milestone where the FORTH system can improve itself.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 String words: S" and ." for string literals, TYPE, COUNT, COMPARE
- [ ] #2 Formatted output: .R, U., U.R, SPACES
- [ ] #3 Pictured numeric output: <# # #S #> HOLD SIGN
- [ ] #4 CREATE DOES> for defining defining words
- [ ] #5 VALUE and TO for named values
- [ ] #6 DEFER and IS for deferred execution
- [ ] #7 MARKER for vocabulary checkpoints
- [ ] #8 Simple assembler words for CODE definitions
- [ ] #9 Can write new tools/utilities in FORTH itself
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### 1. String Literals
Implement S" and ." for string handling:
```forth
: S"      ( "string" -- addr len )  \ compile time
    STATE @ IF
        ['] LITSTRING ,
        [CHAR] " PARSE   \ get string
        DUP ,            \ compile length
        HERE SWAP        \ ( here len )
        DUP ALLOT        \ reserve space
        MOVE             \ copy string to dictionary
        ALIGN            \ align HERE
    ELSE
        [CHAR] " PARSE   \ interpret time - leave on stack
    THEN
; IMMEDIATE

: ."      ( "string" -- )
    STATE @ IF
        ['] LITSTRING ,
        [CHAR] " PARSE
        DUP ,
        HERE SWAP DUP ALLOT MOVE ALIGN
        ['] TYPE ,
    ELSE
        [CHAR] " PARSE TYPE
    THEN
; IMMEDIATE
```

### 2. String Operations
```forth
: COUNT   ( addr -- addr+1 len )  DUP 1+ SWAP C@ ;

: TYPE    ( addr len -- )
    0 ?DO
        DUP C@ EMIT 1+
    LOOP
    DROP
;

: COMPARE ( addr1 len1 addr2 len2 -- n )
    \ return 0 if equal, -1 if str1<str2, 1 if str1>str2
    ROT 2DUP MIN >R     \ R: min-length
    2>R                 \ R: min-len len1 len2
    R@ 0 ?DO
        OVER C@ OVER C@ - ?DUP IF
            NIP NIP
            R> R> R> 2DROP DROP
            DUP ABS /  \ normalize to -1 or 1
            UNLOOP EXIT
        THEN
        1+ SWAP 1+ SWAP
    LOOP
    2DROP
    R> R> R> DROP       \ ( len1 len2 )
    - DUP IF DUP ABS / THEN
;

: SEARCH  ( addr1 len1 addr2 len2 -- addr3 len3 flag )
    \ search for string2 in string1
;
```

### 3. Formatted Output
```forth
: SPACES  ( n -- )  0 ?DO SPACE LOOP ;

: .R      ( n width -- )  \ right-justified in field
    >R DUP ABS 0         \ ( n |n| 0 )
    BEGIN
        SWAP 10 /MOD SWAP
        ROT 1+ ROT        \ count digits
        OVER 0=
    UNTIL
    DROP                  \ ( n digit-count )
    R> SWAP - SPACES      \ print leading spaces
    .                     \ print number
;

: U.      ( u -- )        \ print unsigned
    0 <# #S #> TYPE SPACE
;

: U.R     ( u width -- )  \ unsigned right-justified
    >R 0 <# #S #>
    R> OVER - SPACES TYPE
;
```

### 4. Pictured Numeric Output
```forth
VARIABLE HLD              \ pointer into output buffer

: <#      ( -- )
    PAD HLD !             \ start at end of PAD
;

: HOLD    ( char -- )
    HLD @ 1- DUP HLD !
    C!
;

: #       ( ud -- ud' )
    BASE @ UD/MOD         \ divide by base
    ROT                   \ ( ud' rem )
    9 OVER < IF
        7 +               \ A-F for hex
    THEN
    48 + HOLD             \ convert to ASCII
;

: #S      ( ud -- 0 0 )
    BEGIN
        #
        2DUP OR 0=
    UNTIL
;

: SIGN    ( n -- )
    0< IF 45 HOLD THEN
;

: #>      ( ud -- addr len )
    2DROP
    HLD @ PAD OVER -
;
```

### 5. CREATE DOES> - Defining Words
CREATE makes a new dictionary entry, DOES> changes its runtime behavior:
```forth
: CREATE  ( "name" -- )
    BL WORD             \ parse name
    DUP C@ 1+ ALLOT     \ copy name to dictionary
    HERE LATEST @ ,     \ link field
    LATEST !            \ update LATEST
    ['] DOVAR ,         \ default behavior: push PFA
;

\ DOES> requires assembly support for DODOES
: DOES>   ( -- )
    R>                  \ get return address (points to new behavior)
    LATEST @ >CFA       \ get code field of most recent word
    ['] DODOES SWAP !   \ change code field to DODOES
    LATEST @ >CFA CELL+ ! \ store behavior address in next cell
; IMMEDIATE
```

Example - defining CONSTANT:
```forth
: CONSTANT  ( n "name" -- )
    CREATE ,            \ create word, compile value
    DOES> @             \ runtime: fetch the value
;
```

### 6. VALUE and TO
```forth
: VALUE   ( n "name" -- )
    CREATE ,
    DOES> @
;

: TO      ( n "name" -- )
    '                   \ get xt
    >BODY               \ get to parameter field
    STATE @ IF
        ['] LIT , ,     \ compile address
        ['] ! ,         \ compile store
    ELSE
        !               \ immediate store
    THEN
; IMMEDIATE
```

### 7. DEFER and IS
Deferred words for late binding:
```forth
: DEFER   ( "name" -- )
    CREATE ['] ABORT ,  \ default to ABORT
    DOES> @ EXECUTE
;

: IS      ( xt "name" -- )
    STATE @ IF
        ['] LIT , ' >BODY ,
        ['] ! ,
    ELSE
        ' >BODY !
    THEN
; IMMEDIATE
```

### 8. MARKER - Vocabulary Checkpoints
```forth
: MARKER  ( "name" -- )
    HERE                \ save current HERE
    LATEST @            \ save current LATEST
    CREATE , ,          \ store in new word
    DOES>
        DUP @ LATEST !  \ restore LATEST
        CELL+ @ DP !    \ restore HERE
;
```

Usage: `MARKER EMPTY` ... make definitions ... `EMPTY` removes them all.

### 9. Inline Assembler
Allow CODE words with inline assembly:
```forth
: CODE    ( "name" -- )
    CREATE
    LATEST @ >CFA       \ get code field
    HERE SWAP !         \ point code field to HERE
;

: END-CODE ( -- )
    \ just mark end, nothing special needed
;

\ Example:
CODE 2*   ( n -- n*2 )
    \ inline 6502 assembly here
    \ ASL A
    \ ...
END-CODE
```

For full assembler, define words that compile opcodes:
```forth
: LDA#    ( n -- )  $A9 C, C, ;    \ LDA immediate
: STA     ( addr -- ) $8D C, , ;   \ STA absolute
: JMP     ( addr -- ) $4C C, , ;   \ JMP absolute
: RTS     ( -- )     $60 C, ;      \ RTS
\ ... etc
```

### 10. Self-Improvement Examples
Demonstrate FORTH extending itself:

```forth
\ Define a simple local variables facility
: LOCALS|  ( -- )
    BEGIN
        BL WORD DUP C@ 
        [CHAR] | OVER C@ 1+ + C@ <>
    WHILE
        \ compile code to pop value to return stack
    REPEAT
    DROP
; IMMEDIATE

\ Define a simple OOP system
: CLASS   ( "name" -- )  CREATE HERE 0 , 0 , ;
: METHOD  ( offset "name" -- )  CREATE , DOES> @ + @ EXECUTE ;
: VAR     ( size "name" -- )  CREATE OVER , + DOES> @ + ;
: END-CLASS ( class -- )  DROP ;

\ Define a mini test framework
: ASSERT  ( flag -- )
    0= IF ." FAILED" CR ABORT THEN
;
```

### Files to Create/Modify
- `asm/forth-strings.fth` - String handling words
- `asm/forth-format.fth` - Formatted output
- `asm/forth-meta.fth` - CREATE DOES>, VALUE, DEFER
- `asm/forth-asm.fth` - Inline assembler
- `asm/examples/` - Example FORTH programs demonstrating self-extension
<!-- SECTION:PLAN:END -->
