; ============================================================
; Stage 0 Assembler - Bootstrap Assembler for Wire-HDL
; ============================================================
; A minimal two-pass assembler that fits in ~850 bytes
; Designed to be entered via hex loader
;
; Memory Map:
;   $0800-$0BFF  Assembler code (1KB)
;   $3000-$37FF  Symbol table (128 entries x 16 bytes)
;   $5000-$6FFF  Source buffer (8KB)
;   $7000-$7FFF  Output buffer (4KB)
;
; Zero Page Usage:
;   $30-$31  Source pointer
;   $32-$33  Output pointer
;   $34-$35  Current address (PC)
;   $36-$37  Symbol table pointer
;   $38-$39  Temp pointer
;   $3A      Pass number (1 or 2)
;   $3B      Line buffer index
;   $3C-$3D  Operand value
;   $3E      Addressing mode
;   $3F      Current opcode
;   $40-$4F  Line buffer (16 bytes)
;
; Addressing Modes:
;   0 = Implied
;   1 = Immediate (#$xx)
;   2 = Zero page ($xx)
;   3 = Absolute ($xxxx)
;
; BIOS Routines:
;   $F000  PUTCHAR
;   $F040  GETCHAR
;   $F080  NEWLINE
; ============================================================

.ORG $0800

; Zero page locations
SRC_LO      = $30
SRC_HI      = $31
OUT_LO      = $32
OUT_HI      = $33
PC_LO       = $34
PC_HI       = $35
SYM_LO      = $36
SYM_HI      = $37
TMP_LO      = $38
TMP_HI      = $39
PASS        = $3A
LINE_IDX    = $3B
OP_LO       = $3C
OP_HI       = $3D
ADDR_MODE   = $3E
OPCODE      = $3F
LINE_BUF    = $40

; Memory locations
SYM_TABLE   = $3000
SRC_BUF     = $5000
OUT_BUF     = $7000

; ============================================================
; MAIN - Entry point
; ============================================================
MAIN:
    ; Initialize
    JSR INIT

    ; Pass 1 - collect labels
    LDA #$01
    STA PASS
    JSR ASM_PASS

    ; Pass 2 - generate code
    LDA #$02
    STA PASS
    JSR ASM_PASS

    ; Print done message
    LDA #$44            ; 'D'
    JSR $F000
    LDA #$4F            ; 'O'
    JSR $F000
    LDA #$4E            ; 'N'
    JSR $F000
    LDA #$45            ; 'E'
    JSR $F000
    JSR $F080           ; NEWLINE

    ; Print output size
    SEC
    LDA OUT_LO
    SBC #$00            ; OUT_BUF low
    TAX
    LDA OUT_HI
    SBC #$70            ; OUT_BUF high ($7000)

    ; Print as decimal (simple version)
    JSR PRINT_HEX
    TXA
    JSR PRINT_HEX
    JSR $F080

    HLT

; ============================================================
; INIT - Initialize assembler state
; ============================================================
INIT:
    ; Source pointer to $5000
    LDA #$00
    STA SRC_LO
    LDA #$50
    STA SRC_HI

    ; Output pointer to $7000
    LDA #$00
    STA OUT_LO
    LDA #$70
    STA OUT_HI

    ; PC starts at $0800 (default)
    LDA #$00
    STA PC_LO
    LDA #$08
    STA PC_HI

    ; Symbol table at $3000
    LDA #$00
    STA SYM_LO
    LDA #$30
    STA SYM_HI

    RTS

; ============================================================
; ASM_PASS - Run one pass of assembly
; ============================================================
ASM_PASS:
    ; Reset source pointer
    LDA #$00
    STA SRC_LO
    LDA #$50
    STA SRC_HI

    ; Reset PC
    LDA #$00
    STA PC_LO
    LDA #$08
    STA PC_HI

ASM_LOOP:
    ; Read a line into LINE_BUF
    JSR READ_LINE
    BCS ASM_DONE        ; End of source

    ; Skip empty lines and comments
    LDA LINE_BUF
    CMP #$00            ; Empty line
    BEQ ASM_LOOP
    CMP #$3B            ; ';' comment
    BEQ ASM_LOOP

    ; Check for label (ends with ':')
    JSR CHECK_LABEL

    ; Skip whitespace
    JSR SKIP_WS

    ; Check for directives
    LDA LINE_BUF,X
    CMP #$2E            ; '.'
    BEQ HANDLE_DIR

    ; Check for mnemonic
    CMP #$00            ; Empty after label
    BEQ ASM_LOOP

    ; Parse mnemonic
    JSR PARSE_MNEM
    BCS ASM_ERROR       ; Unknown mnemonic

    ; Parse operand
    JSR PARSE_OPER

    ; Generate code (pass 2 only)
    LDA PASS
    CMP #$02
    BNE SKIP_GEN
    JSR GEN_CODE
SKIP_GEN:

    ; Advance PC based on instruction size
    JSR ADV_PC

    JMP ASM_LOOP

ASM_DONE:
    RTS

ASM_ERROR:
    ; Print error
    LDA #$45            ; 'E'
    JSR $F000
    LDA #$52            ; 'R'
    JSR $F000
    LDA #$52            ; 'R'
    JSR $F000
    JSR $F080
    HLT

; ============================================================
; HANDLE_DIR - Handle directives (.ORG, .DB, etc)
; ============================================================
HANDLE_DIR:
    INX                 ; Skip '.'
    ; Check for ORG
    LDA LINE_BUF,X
    CMP #$4F            ; 'O'
    BNE NOT_ORG

    ; .ORG directive
    INX
    INX
    INX                 ; Skip "ORG"
    JSR SKIP_WS
    JSR PARSE_VALUE     ; Get address
    LDA OP_LO
    STA PC_LO
    LDA OP_HI
    STA PC_HI
    JMP ASM_LOOP

NOT_ORG:
    ; Check for DB (define byte)
    CMP #$44            ; 'D'
    BNE DIR_DONE
    LDA LINE_BUF+1,X
    CMP #$42            ; 'B'
    BNE DIR_DONE

    INX
    INX                 ; Skip "DB"
    JSR SKIP_WS

DB_LOOP:
    JSR PARSE_VALUE
    ; Store byte (pass 2)
    LDA PASS
    CMP #$02
    BNE DB_SKIP
    LDA OP_LO
    LDY #$00
    STA (OUT_LO),Y
    INC OUT_LO
    BNE DB_NOINC
    INC OUT_HI
DB_NOINC:
DB_SKIP:
    INC PC_LO
    BNE DB_NOINC2
    INC PC_HI
DB_NOINC2:
    ; Check for comma
    LDA LINE_BUF,X
    CMP #$2C            ; ','
    BNE DIR_DONE
    INX
    JSR SKIP_WS
    JMP DB_LOOP

DIR_DONE:
    JMP ASM_LOOP

; ============================================================
; CHECK_LABEL - Check for and store label
; ============================================================
CHECK_LABEL:
    LDX #$00
CL_SCAN:
    LDA LINE_BUF,X
    BEQ CL_NONE         ; End of line
    CMP #$3A            ; ':'
    BEQ CL_FOUND
    CMP #$20            ; Space
    BEQ CL_NONE
    INX
    CPX #$08            ; Max label length
    BCC CL_SCAN
CL_NONE:
    LDX #$00
    RTS

CL_FOUND:
    ; X = length of label
    ; Store in symbol table (pass 1 only)
    LDA PASS
    CMP #$01
    BNE CL_SKIP

    ; Copy label to symbol table
    STX TMP_LO          ; Save length
    LDY #$00
CL_COPY:
    LDA LINE_BUF,Y
    STA (SYM_LO),Y
    INY
    CPY TMP_LO
    BCC CL_COPY

    ; Pad with zeros
CL_PAD:
    LDA #$00
    STA (SYM_LO),Y
    INY
    CPY #$08
    BCC CL_PAD

    ; Store address at offset 8
    LDY #$08
    LDA PC_LO
    STA (SYM_LO),Y
    INY
    LDA PC_HI
    STA (SYM_LO),Y

    ; Advance symbol pointer by 16 bytes
    CLC
    LDA SYM_LO
    ADC #$10
    STA SYM_LO
    BCC CL_SKIP
    INC SYM_HI

CL_SKIP:
    ; Advance X past ':'
    INX
    RTS

; ============================================================
; SKIP_WS - Skip whitespace in line buffer
; ============================================================
SKIP_WS:
    LDA LINE_BUF,X
    CMP #$20            ; Space
    BNE SW_DONE
    INX
    JMP SKIP_WS
SW_DONE:
    RTS

; ============================================================
; READ_LINE - Read a line from source into LINE_BUF
; ============================================================
READ_LINE:
    LDY #$00
RL_LOOP:
    LDA (SRC_LO),Y
    BEQ RL_END          ; End of source
    CMP #$0D            ; CR
    BEQ RL_EOL
    CMP #$0A            ; LF
    BEQ RL_EOL
    STA LINE_BUF,Y
    INY
    CPY #$0F            ; Max line length 15
    BCC RL_LOOP
RL_EOL:
    ; Terminate line
    LDA #$00
    STA LINE_BUF,Y

    ; Advance source pointer past line
    INY
RL_ADV:
    CLC
    TYA
    ADC SRC_LO
    STA SRC_LO
    BCC RL_DONE
    INC SRC_HI
RL_DONE:
    CLC                 ; Success
    RTS

RL_END:
    ; Check if any chars read
    CPY #$00
    BEQ RL_EOF
    LDA #$00
    STA LINE_BUF,Y
    JMP RL_ADV

RL_EOF:
    SEC                 ; End of file
    RTS

; ============================================================
; PARSE_MNEM - Parse mnemonic and set OPCODE
; ============================================================
PARSE_MNEM:
    ; Get 3-letter mnemonic from LINE_BUF at X
    LDA LINE_BUF,X
    STA TMP_LO
    LDA LINE_BUF+1,X
    STA TMP_HI
    LDA LINE_BUF+2,X

    ; Save third char
    PHA

    ; Compare against opcode table
    LDY #$00
PM_LOOP:
    LDA OPCODE_TAB,Y
    BEQ PM_FAIL         ; End of table
    CMP TMP_LO          ; First char
    BNE PM_NEXT
    LDA OPCODE_TAB+1,Y
    CMP TMP_HI          ; Second char
    BNE PM_NEXT
    PLA                 ; Get third char back
    PHA
    CMP OPCODE_TAB+2,Y  ; Third char
    BNE PM_NEXT2

    ; Found! Get opcode info
    PLA
    LDA OPCODE_TAB+3,Y  ; Base opcode
    STA OPCODE
    INX
    INX
    INX                 ; Skip mnemonic
    CLC
    RTS

PM_NEXT:
    PLA
    PHA
PM_NEXT2:
    ; Next entry (4 bytes each)
    TYA
    CLC
    ADC #$04
    TAY
    JMP PM_LOOP

PM_FAIL:
    PLA
    SEC
    RTS

; ============================================================
; PARSE_OPER - Parse operand and set ADDR_MODE, OP_LO/HI
; ============================================================
PARSE_OPER:
    JSR SKIP_WS

    ; Check for implied (no operand)
    LDA LINE_BUF,X
    BEQ PO_IMP
    CMP #$3B            ; ';' comment
    BEQ PO_IMP

    ; Check for immediate (#)
    CMP #$23            ; '#'
    BEQ PO_IMM

    ; Must be address (zp or abs)
    JSR PARSE_VALUE

    ; Determine zp or abs based on high byte
    LDA OP_HI
    BNE PO_ABS

    ; Zero page
    LDA #$02
    STA ADDR_MODE
    RTS

PO_ABS:
    LDA #$03
    STA ADDR_MODE
    RTS

PO_IMM:
    INX                 ; Skip '#'
    JSR PARSE_VALUE
    LDA #$01
    STA ADDR_MODE
    RTS

PO_IMP:
    LDA #$00
    STA ADDR_MODE
    RTS

; ============================================================
; PARSE_VALUE - Parse hex value or label into OP_LO/OP_HI
; ============================================================
PARSE_VALUE:
    LDA #$00
    STA OP_LO
    STA OP_HI

    ; Check for '$' prefix
    LDA LINE_BUF,X
    CMP #$24            ; '$'
    BNE PV_LABEL

    INX                 ; Skip '$'
    ; Parse hex digits
PV_HEX:
    LDA LINE_BUF,X
    JSR IS_HEX
    BCS PV_DONE         ; Not hex

    ; Shift result left 4 bits
    ASL OP_LO
    ROL OP_HI
    ASL OP_LO
    ROL OP_HI
    ASL OP_LO
    ROL OP_HI
    ASL OP_LO
    ROL OP_HI

    ; Convert and add new digit
    JSR HEX_VAL
    ORA OP_LO
    STA OP_LO
    INX
    JMP PV_HEX

PV_DONE:
    RTS

PV_LABEL:
    ; Look up label in symbol table
    STX LINE_IDX        ; Save position

    ; Get label from LINE_BUF
    LDY #$00
PVL_SCAN:
    LDA LINE_BUF,X
    BEQ PVL_LOOKUP
    CMP #$20            ; Space
    BEQ PVL_LOOKUP
    CMP #$2C            ; Comma
    BEQ PVL_LOOKUP
    CMP #$3B            ; Semicolon
    BEQ PVL_LOOKUP
    INX
    INY
    CPY #$08
    BCC PVL_SCAN

PVL_LOOKUP:
    ; Y = label length, X = new position
    STY TMP_LO          ; Label length

    ; Search symbol table
    LDA #$00
    STA TMP_HI
    LDA #$30            ; Symbol table at $3000
    STA $39             ; TMP_HI+1 (using $39 as high byte)
    LDA #$00
    STA $38             ; TMP_LO as pointer low

PVL_SEARCH:
    ; Check if at end of symbols
    LDA $38
    CMP SYM_LO
    BNE PVL_CMP
    LDA $39
    CMP SYM_HI
    BEQ PVL_NOTFOUND    ; Reached end

PVL_CMP:
    ; Compare label
    LDY #$00
    LDX LINE_IDX
PVL_CMPLOOP:
    LDA LINE_BUF,X
    CMP ($38),Y
    BNE PVL_NEXTENT
    INX
    INY
    CPY TMP_LO
    BCC PVL_CMPLOOP

    ; Check symbol is terminated
    LDA ($38),Y
    BNE PVL_NEXTENT

    ; Found! Get value
    LDY #$08
    LDA ($38),Y
    STA OP_LO
    INY
    LDA ($38),Y
    STA OP_HI

    ; Restore X to end of label
    RTS

PVL_NEXTENT:
    ; Advance to next symbol entry (+16)
    CLC
    LDA $38
    ADC #$10
    STA $38
    BCC PVL_SEARCH
    INC $39
    JMP PVL_SEARCH

PVL_NOTFOUND:
    ; Symbol not found - use 0 (will be resolved pass 2)
    LDX LINE_IDX
    ; Advance X past label
PVLN_SKIP:
    LDA LINE_BUF,X
    BEQ PVLN_DONE
    CMP #$20
    BEQ PVLN_DONE
    CMP #$2C
    BEQ PVLN_DONE
    CMP #$3B
    BEQ PVLN_DONE
    INX
    JMP PVLN_SKIP
PVLN_DONE:
    RTS

; ============================================================
; GEN_CODE - Generate code for current instruction
; ============================================================
GEN_CODE:
    ; Get base opcode
    LDA OPCODE

    ; Adjust for addressing mode
    LDY ADDR_MODE
    BEQ GC_IMP          ; Implied

    ; Immediate mode - add $00 or $08 depending on opcode
    CPY #$01
    BNE GC_ZP
    ; For LDA/etc, immediate is base + $09 (for some)
    ; Use mode table lookup
    JMP GC_EMIT

GC_ZP:
    ; Zero page - opcode usually same or +$04
    CPY #$02
    BNE GC_ABS
    ; Some opcodes need adjustment
    JMP GC_EMIT

GC_ABS:
    ; Absolute - opcode usually +$08 from zp
    ; For most ops, abs = zp + $08 or base + $0C
    CLC
    ADC #$08
    JMP GC_EMIT

GC_IMP:
    ; Implied - use base opcode as-is

GC_EMIT:
    ; Write opcode
    LDY #$00
    STA (OUT_LO),Y
    JSR INC_OUT

    ; Write operand bytes
    LDA ADDR_MODE
    BEQ GC_DONE         ; Implied - no operand

    ; Write low byte
    LDA OP_LO
    LDY #$00
    STA (OUT_LO),Y
    JSR INC_OUT

    ; For absolute, write high byte
    LDA ADDR_MODE
    CMP #$03
    BNE GC_DONE
    LDA OP_HI
    LDY #$00
    STA (OUT_LO),Y
    JSR INC_OUT

GC_DONE:
    RTS

; ============================================================
; ADV_PC - Advance PC based on addressing mode
; ============================================================
ADV_PC:
    LDA ADDR_MODE
    BEQ AP_1            ; Implied = 1 byte
    CMP #$03
    BEQ AP_3            ; Absolute = 3 bytes
    ; Immediate or ZP = 2 bytes
    INC PC_LO
    BNE AP_1
    INC PC_HI
AP_1:
    INC PC_LO
    BNE AP_DONE
    INC PC_HI
AP_DONE:
    RTS
AP_3:
    INC PC_LO
    BNE AP_3A
    INC PC_HI
AP_3A:
    INC PC_LO
    BNE AP_3B
    INC PC_HI
AP_3B:
    INC PC_LO
    BNE AP_DONE
    INC PC_HI
    RTS

; ============================================================
; INC_OUT - Increment output pointer
; ============================================================
INC_OUT:
    INC OUT_LO
    BNE IO_DONE
    INC OUT_HI
IO_DONE:
    RTS

; ============================================================
; IS_HEX - Check if A is hex digit, set carry if not
; ============================================================
IS_HEX:
    CMP #$30            ; '0'
    BCC IH_NO
    CMP #$3A            ; '9'+1
    BCC IH_YES
    CMP #$41            ; 'A'
    BCC IH_NO
    CMP #$47            ; 'F'+1
    BCC IH_YES
    CMP #$61            ; 'a'
    BCC IH_NO
    CMP #$67            ; 'f'+1
    BCC IH_YES
IH_NO:
    SEC
    RTS
IH_YES:
    CLC
    RTS

; ============================================================
; HEX_VAL - Convert hex char in A to value (0-15)
; ============================================================
HEX_VAL:
    CMP #$41            ; 'A'
    BCS HV_ALPHA
    SEC
    SBC #$30            ; '0'
    RTS
HV_ALPHA:
    CMP #$61            ; 'a'
    BCS HV_LOWER
    SEC
    SBC #$37            ; 'A' - 10
    RTS
HV_LOWER:
    SEC
    SBC #$57            ; 'a' - 10
    RTS

; ============================================================
; PRINT_HEX - Print A as 2 hex digits
; ============================================================
PRINT_HEX:
    PHA
    LSR A
    LSR A
    LSR A
    LSR A
    JSR PH_DIGIT
    PLA
    AND #$0F
PH_DIGIT:
    CMP #$0A
    BCC PH_NUM
    CLC
    ADC #$37            ; 'A' - 10
    JMP $F000
PH_NUM:
    CLC
    ADC #$30            ; '0'
    JMP $F000

; ============================================================
; OPCODE TABLE
; ============================================================
; Format: 3-char mnemonic + base opcode
; Simplified - only common opcodes
; ============================================================
OPCODE_TAB:
    ; Load/Store
    .DB $4C, $44, $41, $A5   ; LDA zp=$A5, imm=$A9, abs=$AD
    .DB $53, $54, $41, $85   ; STA zp=$85, abs=$8D
    .DB $4C, $44, $58, $A6   ; LDX zp=$A6, imm=$A2, abs=$AE
    .DB $4C, $44, $59, $A4   ; LDY zp=$A4, imm=$A0, abs=$AC
    .DB $53, $54, $58, $86   ; STX zp=$86, abs=$8E
    .DB $53, $54, $59, $84   ; STY zp=$84, abs=$8C

    ; Arithmetic
    .DB $41, $44, $43, $65   ; ADC zp=$65, imm=$69, abs=$6D
    .DB $53, $42, $43, $E5   ; SBC zp=$E5, imm=$E9, abs=$ED
    .DB $43, $4D, $50, $C5   ; CMP zp=$C5, imm=$C9, abs=$CD
    .DB $41, $4E, $44, $25   ; AND zp=$25, imm=$29, abs=$2D
    .DB $4F, $52, $41, $05   ; ORA zp=$05, imm=$09, abs=$0D
    .DB $45, $4F, $52, $45   ; EOR zp=$45, imm=$49, abs=$4D

    ; Inc/Dec
    .DB $49, $4E, $58, $E8   ; INX implied=$E8
    .DB $44, $45, $58, $CA   ; DEX implied=$CA
    .DB $49, $4E, $59, $C8   ; INY implied=$C8
    .DB $44, $45, $59, $88   ; DEY implied=$88
    .DB $49, $4E, $43, $E6   ; INC zp=$E6, abs=$EE
    .DB $44, $45, $43, $C6   ; DEC zp=$C6, abs=$CE

    ; Jumps
    .DB $4A, $4D, $50, $4C   ; JMP abs=$4C
    .DB $4A, $53, $52, $20   ; JSR abs=$20
    .DB $52, $54, $53, $60   ; RTS implied=$60

    ; Branches
    .DB $42, $45, $51, $F0   ; BEQ rel=$F0
    .DB $42, $4E, $45, $D0   ; BNE rel=$D0
    .DB $42, $43, $53, $B0   ; BCS rel=$B0
    .DB $42, $43, $43, $90   ; BCC rel=$90

    ; Flags
    .DB $53, $45, $43, $38   ; SEC implied=$38
    .DB $43, $4C, $43, $18   ; CLC implied=$18
    .DB $53, $45, $49, $78   ; SEI implied=$78
    .DB $43, $4C, $49, $58   ; CLI implied=$58

    ; Stack
    .DB $50, $48, $41, $48   ; PHA implied=$48
    .DB $50, $4C, $41, $68   ; PLA implied=$68

    ; Transfer
    .DB $54, $41, $58, $AA   ; TAX implied=$AA
    .DB $54, $58, $41, $8A   ; TXA implied=$8A
    .DB $54, $41, $59, $A8   ; TAY implied=$A8
    .DB $54, $59, $41, $98   ; TYA implied=$98

    ; Misc
    .DB $4E, $4F, $50, $EA   ; NOP implied=$EA
    .DB $48, $4C, $54, $02   ; HLT (BRK) implied=$02

    .DB $00                  ; End of table

; ============================================================
; End of Stage 0 Assembler
; ============================================================
