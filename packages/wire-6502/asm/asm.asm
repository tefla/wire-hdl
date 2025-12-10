; ==============================================================================
; Stage 1 Assembler (asm.asm) - Self-Hosting 6502 Assembler
; ==============================================================================
; This assembler can assemble itself after being assembled by Stage 0.
;
; Features:
;   - Full 6502 instruction set (56 mnemonics)
;   - All addressing modes (13 modes)
;   - Expressions: label+N, label-N, <label (low byte), >label (high byte)
;   - Directives: .ORG, .DB, .DW, .DS, EQU (=)
;   - Two-pass assembly with forward references
;   - Error messages
;
; Memory Map:
;   $0800-$1FFF  Assembler code (~6KB)
;   $2000-$3FFF  Source buffer (8KB)
;   $4000-$5FFF  Output buffer (8KB)
;   $6000-$6FFF  Symbol table (256 entries x 16 bytes = 4KB)
;   $7000-$7FFF  Line buffer, scratch space
;
; Zero Page Usage:
;   $30-$31  Source pointer
;   $32-$33  Output pointer
;   $34-$35  Current address (PC)
;   $36-$37  Symbol table pointer
;   $38      Current pass (1 or 2)
;   $39      Error flag
;   $3A-$3B  Line number
;   $3C-$3D  Operand value
;   $3E      Addressing mode
;   $3F      Current opcode
;   $40-$47  Mnemonic buffer (8 bytes)
;   $48-$4F  Label buffer (8 bytes)
;   $50-$51  Expression result
;   $52      Expression operator
;   $53      Low/high byte flag (< or >)
;   $54-$55  Symbol value temp
;   $56-$57  Temp pointer
;   $58      Character temp
;   $59      Token type
;   $5A-$5B  Numeric value temp
;   $5C      Sector buffer index
;   $5D      File handle
;   $5E-$5F  File size
; ==============================================================================

        .ORG $0800

; ------------------------------------------------------------------------------
; Constants
; ------------------------------------------------------------------------------
SRC_BUF     = $2000       ; Source buffer start
SRC_END     = $3FFF       ; Source buffer end
OUT_BUF     = $4000       ; Output buffer start
OUT_END     = $5FFF       ; Output buffer end
SYM_TAB     = $6000       ; Symbol table start
SYM_MAX     = 256         ; Max symbols
SYM_SIZE    = 16          ; Bytes per symbol entry
LINE_BUF    = $7000       ; Line buffer (256 bytes)
SCRATCH     = $7100       ; Scratch area

; BIOS entry points
PUTCHAR     = $F000
GETCHAR     = $F040
NEWLINE     = $F080
DISK_READ   = $F200
DISK_WRITE  = $F240

; Directory constants
DIR_START   = 1             ; First directory sector
DIR_SECTS   = 3             ; Number of directory sectors
DIR_BUF     = $0400         ; Directory sector buffer
CMD_BUF     = $0300         ; Command line buffer (set by shell)
CUR_DIR_LO  = $0240         ; Current directory index (low byte, from shell)
CUR_DIR_HI  = $0241         ; Current directory index (high byte, $FF = root)

; Zero page
; Note: $30-$33 are reserved for BIOS disk I/O parameters
; SRCPTR and OUTPTR moved to avoid conflict
SRCPTR      = $60
OUTPTR      = $62
CURPC       = $34
SYMPTR      = $36
PASS        = $38
ERRFLAG     = $39
LINENUM     = $3A
OPERAND     = $3C
ADDRMODE    = $3E
OPCODE      = $3F
MNEMBUF     = $40
LABELBUF    = $48
EXPRVAL     = $50
EXPROP      = $52
LOBYTE      = $53
SYMVAL      = $54
TMPPTR      = $56
CHARTMP     = $58
TOKTYPE     = $59
NUMVAL      = $5A
FILESEC     = $5C          ; File start sector
FILESIZE    = $5E          ; File size (16-bit)
DIRSEC      = $64          ; Current directory sector being searched
FNAMEOFF    = $66          ; Filename offset in CMD_BUF (preserved for SAVE_FILE)

; Token types
TOK_EOF     = 0
TOK_NEWLINE = 1
TOK_LABEL   = 2
TOK_MNEM    = 3
TOK_NUMBER  = 4
TOK_HASH    = 5
TOK_LPAREN  = 6
TOK_RPAREN  = 7
TOK_COMMA   = 8
TOK_PLUS    = 9
TOK_MINUS   = 10
TOK_EQUALS  = 11
TOK_DOT     = 12
TOK_COLON   = 13
TOK_LT      = 14
TOK_GT      = 15

; Addressing modes
AM_IMP      = 0           ; Implied
AM_ACC      = 1           ; Accumulator
AM_IMM      = 2           ; Immediate #$xx
AM_ZP       = 3           ; Zero page $xx
AM_ZPX      = 4           ; Zero page,X $xx,X
AM_ZPY      = 5           ; Zero page,Y $xx,Y
AM_ABS      = 6           ; Absolute $xxxx
AM_ABX      = 7           ; Absolute,X $xxxx,X
AM_ABY      = 8           ; Absolute,Y $xxxx,Y
AM_IND      = 9           ; Indirect ($xxxx)
AM_INX      = 10          ; Indexed indirect ($xx,X)
AM_INY      = 11          ; Indirect indexed ($xx),Y
AM_REL      = 12          ; Relative (branches)

; ==============================================================================
; Entry Point
; ==============================================================================
MAIN:
        JSR INIT          ; Initialize

        ; Print banner
        LDA #<BANNER
        LDX #>BANNER
        JSR PRINT_STR

        ; Load source file from command line argument
        JSR LOAD_FILE
        BCS MAIN_NOFILE   ; Carry set = error

        ; Pass 1 - collect symbols
        LDA #1
        STA PASS
        JSR ASSEMBLE
        LDA ERRFLAG
        BNE MAIN_ERR

        ; Pass 2 - generate code
        LDA #2
        STA PASS
        JSR ASSEMBLE
        LDA ERRFLAG
        BNE MAIN_ERR

        ; Print success
        LDA #<MSG_OK
        LDX #>MSG_OK
        JSR PRINT_STR

        ; Print output size
        SEC
        LDA OUTPTR
        SBC #<OUT_BUF
        STA FILESIZE        ; Store output size for SAVE_FILE
        PHA
        LDA OUTPTR+1
        SBC #>OUT_BUF
        STA FILESIZE+1
        TAX
        PLA
        JSR PRINT_HEX16
        LDA #<MSG_BYTES
        LDX #>MSG_BYTES
        JSR PRINT_STR

        ; Save output to .COM file
        JSR SAVE_FILE
        BCS MAIN_SAVE_ERR

        RTS

MAIN_SAVE_ERR:
        ; Save failed message already printed
        RTS

MAIN_NOFILE:
        ; Error message already printed by LOAD_FILE
        RTS

MAIN_ERR:
        LDA #<MSG_ERR
        LDX #>MSG_ERR
        JSR PRINT_STR
        RTS

; ==============================================================================
; Initialize
; ==============================================================================
INIT:
        ; Clear zero page work area
        LDA #0
        LDX #$30
INIT_ZP:
        STA $00,X
        INX
        CPX #$60
        BNE INIT_ZP

        ; Initialize pointers
        LDA #<SRC_BUF
        STA SRCPTR
        LDA #>SRC_BUF
        STA SRCPTR+1

        LDA #<OUT_BUF
        STA OUTPTR
        LDA #>OUT_BUF
        STA OUTPTR+1

        LDA #<SYM_TAB
        STA SYMPTR
        LDA #>SYM_TAB
        STA SYMPTR+1

        ; Clear symbol table
        LDA #0
        LDY #0
        LDX #>SYM_TAB
        STX TMPPTR+1
        LDA #<SYM_TAB
        STA TMPPTR
INIT_SYM:
        LDA #0
        STA (TMPPTR),Y
        INY
        BNE INIT_SYM
        INC TMPPTR+1
        LDX TMPPTR+1
        CPX #$70          ; End of symbol table area
        BNE INIT_SYM

        RTS

; ==============================================================================
; Main Assembly Loop
; ==============================================================================
ASSEMBLE:
        ; Reset source pointer for each pass
        LDA #<SRC_BUF
        STA SRCPTR
        LDA #>SRC_BUF
        STA SRCPTR+1

        ; Reset PC (will be set by .ORG)
        LDA #0
        STA CURPC
        STA CURPC+1

        ; Reset output pointer for pass 2
        LDA PASS
        CMP #2
        BNE ASM_LOOP
        LDA #<OUT_BUF
        STA OUTPTR
        LDA #>OUT_BUF
        STA OUTPTR+1

        ; Reset line number
        LDA #0
        STA LINENUM
        STA LINENUM+1

ASM_LOOP:
        JSR PARSE_LINE
        LDA TOKTYPE
        CMP #TOK_EOF
        BEQ ASM_DONE

        LDA ERRFLAG
        BNE ASM_DONE

        JMP ASM_LOOP

ASM_DONE:
        RTS

; ==============================================================================
; Parse One Line
; ==============================================================================
PARSE_LINE:
        ; Increment line number
        INC LINENUM
        BNE PL_START
        INC LINENUM+1

PL_START:
        LDY #0              ; Initialize Y for source indexing
        JSR SKIP_SPACE
        JSR GET_TOKEN

        ; Check for EOF
        LDA TOKTYPE
        CMP #TOK_EOF
        BEQ PL_DONE

        ; Check for empty line
        CMP #TOK_NEWLINE
        BEQ PL_DONE

        ; Check for comment (;)
        LDA (SRCPTR),Y
        DEY                 ; Back up to look at current char
        LDA (SRCPTR),Y
        INY
        CMP #';'
        BEQ PL_SKIP_LINE

        ; Check for label definition (starts with letter, ends with :)
        LDA TOKTYPE
        CMP #TOK_LABEL
        BNE PL_NOT_LABEL

        ; Peek ahead for : or =
        JSR SKIP_SPACE
        LDA (SRCPTR),Y
        CMP #':'
        BEQ PL_DEF_LABEL
        CMP #'='
        BEQ PL_DEF_EQU

        ; It's a mnemonic, not a label
        JMP PL_MNEMONIC

PL_DEF_LABEL:
        INY                 ; Skip ':'
        JSR DEFINE_LABEL
        JSR SKIP_SPACE
        JSR GET_TOKEN
        LDA TOKTYPE
        CMP #TOK_NEWLINE
        BEQ PL_DONE
        CMP #TOK_EOF
        BEQ PL_DONE
        JMP PL_MNEMONIC

PL_DEF_EQU:
        INY                 ; Skip '='
        JSR SKIP_SPACE
        JSR PARSE_EXPR
        JSR DEFINE_EQU
        JMP PL_DONE

PL_NOT_LABEL:
        ; Check for directive
        CMP #TOK_DOT
        BNE PL_MNEMONIC
        JMP PL_DIRECTIVE

PL_MNEMONIC:
        ; It's a mnemonic - parse instruction
        JSR PARSE_INSTR
        JMP PL_DONE

PL_SKIP_LINE:
        ; Skip to end of line
        LDA (SRCPTR),Y
        BEQ PL_DONE
        CMP #$0A
        BEQ PL_NEXT
        CMP #$0D
        BEQ PL_NEXT
        INY
        BNE PL_SKIP_LINE
        INC SRCPTR+1
        LDY #0
        JMP PL_SKIP_LINE

PL_NEXT:
        INY
        BNE PL_DONE
        INC SRCPTR+1
        LDY #0

PL_DONE:
        ; Update source pointer
        TYA
        CLC
        ADC SRCPTR
        STA SRCPTR
        LDA #0
        ADC SRCPTR+1
        STA SRCPTR+1
        RTS

; ==============================================================================
; Parse Instruction
; ==============================================================================
PARSE_INSTR:
        ; Mnemonic is already in MNEMBUF
        JSR LOOKUP_MNEM
        BCS PI_BAD_MNEM

        ; Get operand and addressing mode
        JSR SKIP_SPACE
        JSR PARSE_OPERAND

        ; Look up opcode for mnemonic + addressing mode
        JSR LOOKUP_OPCODE
        BCS PI_BAD_MODE

        ; Emit instruction
        JSR EMIT_INSTR
        RTS

PI_BAD_MNEM:
        LDA #<ERR_MNEM
        LDX #>ERR_MNEM
        JSR PRINT_ERROR
        RTS

PI_BAD_MODE:
        LDA #<ERR_MODE
        LDX #>ERR_MODE
        JSR PRINT_ERROR
        RTS

; ==============================================================================
; Parse Operand - Determine addressing mode and operand value
; ==============================================================================
PARSE_OPERAND:
        LDA #0
        STA OPERAND
        STA OPERAND+1
        STA LOBYTE

        LDA (SRCPTR),Y
        BEQ PO_IMPLIED
        CMP #$0A
        BEQ PO_IMPLIED
        CMP #$0D
        BEQ PO_IMPLIED
        CMP #';'
        BEQ PO_IMPLIED

        ; Check for accumulator mode (A)
        CMP #'A'
        BNE PO_NOT_ACC
        ; Peek next char
        INY
        LDA (SRCPTR),Y
        DEY
        CMP #' '
        BEQ PO_ACC
        CMP #$0A
        BEQ PO_ACC
        CMP #$0D
        BEQ PO_ACC
        CMP #0
        BEQ PO_ACC
        CMP #';'
        BEQ PO_ACC
        JMP PO_NOT_ACC

PO_ACC:
        INY                 ; Consume 'A'
        LDA #AM_ACC
        STA ADDRMODE
        RTS

PO_IMPLIED:
        LDA #AM_IMP
        STA ADDRMODE
        RTS

PO_NOT_ACC:
        ; Check for immediate (#)
        LDA (SRCPTR),Y
        CMP #'#'
        BNE PO_NOT_IMM
        INY
        JSR PARSE_EXPR
        LDA #AM_IMM
        STA ADDRMODE
        RTS

PO_NOT_IMM:
        ; Check for indirect (starts with ()
        CMP #'('
        BNE PO_NOT_IND
        INY                 ; Skip (
        JSR PARSE_EXPR
        LDA (SRCPTR),Y
        CMP #','
        BEQ PO_INX          ; ($xx,X)
        CMP #')'
        BNE PO_IND_ERR
        INY                 ; Skip )
        LDA (SRCPTR),Y
        CMP #','
        BEQ PO_INY          ; ($xx),Y
        ; Plain indirect
        LDA #AM_IND
        STA ADDRMODE
        RTS

PO_INX:
        INY                 ; Skip ,
        JSR SKIP_SPACE
        LDA (SRCPTR),Y
        AND #$DF            ; Uppercase
        CMP #'X'
        BNE PO_IND_ERR
        INY                 ; Skip X
        JSR SKIP_SPACE
        LDA (SRCPTR),Y
        CMP #')'
        BNE PO_IND_ERR
        INY                 ; Skip )
        LDA #AM_INX
        STA ADDRMODE
        RTS

PO_INY:
        INY                 ; Skip ,
        JSR SKIP_SPACE
        LDA (SRCPTR),Y
        AND #$DF            ; Uppercase
        CMP #'Y'
        BNE PO_IND_ERR
        INY                 ; Skip Y
        LDA #AM_INY
        STA ADDRMODE
        RTS

PO_IND_ERR:
        LDA #<ERR_SYNTAX
        LDX #>ERR_SYNTAX
        JSR PRINT_ERROR
        RTS

PO_NOT_IND:
        ; Regular address expression
        JSR PARSE_EXPR

        ; Check for ,X or ,Y
        LDA (SRCPTR),Y
        CMP #','
        BNE PO_NO_INDEX
        INY                 ; Skip ,
        JSR SKIP_SPACE
        LDA (SRCPTR),Y
        AND #$DF            ; Uppercase
        CMP #'X'
        BEQ PO_X_INDEX
        CMP #'Y'
        BEQ PO_Y_INDEX
        JMP PO_IND_ERR

PO_X_INDEX:
        INY                 ; Skip X
        ; Determine if zero page or absolute
        LDA OPERAND+1
        BNE PO_ABX
        LDA #AM_ZPX
        STA ADDRMODE
        RTS
PO_ABX:
        LDA #AM_ABX
        STA ADDRMODE
        RTS

PO_Y_INDEX:
        INY                 ; Skip Y
        LDA OPERAND+1
        BNE PO_ABY
        LDA #AM_ZPY
        STA ADDRMODE
        RTS
PO_ABY:
        LDA #AM_ABY
        STA ADDRMODE
        RTS

PO_NO_INDEX:
        ; Check if relative (for branches - handled by lookup)
        ; Determine if zero page or absolute
        LDA OPERAND+1
        BNE PO_ABS
        ; Could be zero page
        LDA #AM_ZP
        STA ADDRMODE
        RTS
PO_ABS:
        LDA #AM_ABS
        STA ADDRMODE
        RTS

; ==============================================================================
; Parse Expression
; ==============================================================================
PARSE_EXPR:
        LDA #0
        STA EXPRVAL
        STA EXPRVAL+1
        STA LOBYTE

        ; Check for < or > prefix
        LDA (SRCPTR),Y
        CMP #'<'
        BNE PE_NOT_LO
        LDA #1
        STA LOBYTE
        INY
        JMP PE_VALUE
PE_NOT_LO:
        CMP #'>'
        BNE PE_VALUE
        LDA #2
        STA LOBYTE
        INY

PE_VALUE:
        JSR PARSE_VALUE

        ; Copy to EXPRVAL
        LDA NUMVAL
        STA EXPRVAL
        LDA NUMVAL+1
        STA EXPRVAL+1

PE_LOOP:
        ; Check for + or -
        JSR SKIP_SPACE
        LDA (SRCPTR),Y
        CMP #'+'
        BEQ PE_ADD
        CMP #'-'
        BEQ PE_SUB
        JMP PE_APPLY

PE_ADD:
        INY
        JSR PARSE_VALUE
        CLC
        LDA EXPRVAL
        ADC NUMVAL
        STA EXPRVAL
        LDA EXPRVAL+1
        ADC NUMVAL+1
        STA EXPRVAL+1
        JMP PE_LOOP

PE_SUB:
        INY
        JSR PARSE_VALUE
        SEC
        LDA EXPRVAL
        SBC NUMVAL
        STA EXPRVAL
        LDA EXPRVAL+1
        SBC NUMVAL+1
        STA EXPRVAL+1
        JMP PE_LOOP

PE_APPLY:
        ; Apply < or > if needed
        LDA LOBYTE
        BEQ PE_DONE
        CMP #1
        BNE PE_HI
        ; Low byte
        LDA #0
        STA EXPRVAL+1
        JMP PE_DONE
PE_HI:
        ; High byte
        LDA EXPRVAL+1
        STA EXPRVAL
        LDA #0
        STA EXPRVAL+1

PE_DONE:
        ; Copy to OPERAND
        LDA EXPRVAL
        STA OPERAND
        LDA EXPRVAL+1
        STA OPERAND+1
        RTS

; ==============================================================================
; Parse Value - Number or Label
; ==============================================================================
PARSE_VALUE:
        JSR SKIP_SPACE
        LDA #0
        STA NUMVAL
        STA NUMVAL+1

        LDA (SRCPTR),Y
        CMP #'$'
        BEQ PV_HEX
        CMP #'%'
        BEQ PV_BIN
        CMP #'0'
        BCC PV_LABEL
        CMP #':'
        BCC PV_DEC

PV_LABEL:
        ; Parse label name
        JSR GET_LABEL
        JSR LOOKUP_LABEL
        BCS PV_UNDEF
        ; Value is in SYMVAL
        LDA SYMVAL
        STA NUMVAL
        LDA SYMVAL+1
        STA NUMVAL+1
        RTS

PV_UNDEF:
        ; Undefined label - use 0 in pass 1
        LDA PASS
        CMP #1
        BEQ PV_ZERO
        ; Error in pass 2
        LDA #<ERR_UNDEF
        LDX #>ERR_UNDEF
        JSR PRINT_ERROR
PV_ZERO:
        LDA #0
        STA NUMVAL
        STA NUMVAL+1
        RTS

PV_HEX:
        INY                 ; Skip $
        JSR PARSE_HEX
        RTS

PV_BIN:
        INY                 ; Skip %
        JSR PARSE_BIN
        RTS

PV_DEC:
        JSR PARSE_DEC
        RTS

; ==============================================================================
; Parse Hex Number
; ==============================================================================
PARSE_HEX:
        LDA #0
        STA NUMVAL
        STA NUMVAL+1
PH_LOOP:
        LDA (SRCPTR),Y
        JSR IS_HEX
        BCS PH_DONE
        JSR HEX_DIGIT
        ; Shift result left 4 bits
        ASL NUMVAL
        ROL NUMVAL+1
        ASL NUMVAL
        ROL NUMVAL+1
        ASL NUMVAL
        ROL NUMVAL+1
        ASL NUMVAL
        ROL NUMVAL+1
        ; Add digit
        ORA NUMVAL
        STA NUMVAL
        INY
        JMP PH_LOOP
PH_DONE:
        RTS

; ==============================================================================
; Parse Decimal Number
; ==============================================================================
PARSE_DEC:
        LDA #0
        STA NUMVAL
        STA NUMVAL+1
PD_LOOP:
        LDA (SRCPTR),Y
        CMP #'0'
        BCC PD_DONE
        CMP #':'            ; '9'+1
        BCS PD_DONE
        ; Multiply by 10: x*10 = x*8 + x*2
        AND #$0F
        PHA
        ; Save current value
        LDA NUMVAL
        STA TMPPTR
        LDA NUMVAL+1
        STA TMPPTR+1
        ; Multiply by 2
        ASL NUMVAL
        ROL NUMVAL+1
        ; Save x*2
        LDA NUMVAL
        PHA
        LDA NUMVAL+1
        PHA
        ; Multiply by 4 (now x*8)
        ASL NUMVAL
        ROL NUMVAL+1
        ASL NUMVAL
        ROL NUMVAL+1
        ; Add x*2
        PLA
        CLC
        ADC NUMVAL+1
        STA NUMVAL+1
        PLA
        ADC NUMVAL
        STA NUMVAL
        ; Add digit
        PLA
        CLC
        ADC NUMVAL
        STA NUMVAL
        LDA #0
        ADC NUMVAL+1
        STA NUMVAL+1
        INY
        JMP PD_LOOP
PD_DONE:
        RTS

; ==============================================================================
; Parse Binary Number
; ==============================================================================
PARSE_BIN:
        LDA #0
        STA NUMVAL
        STA NUMVAL+1
PB_LOOP:
        LDA (SRCPTR),Y
        CMP #'0'
        BEQ PB_ZERO
        CMP #'1'
        BEQ PB_ONE
        RTS
PB_ZERO:
        ASL NUMVAL
        ROL NUMVAL+1
        INY
        JMP PB_LOOP
PB_ONE:
        ASL NUMVAL
        ROL NUMVAL+1
        INC NUMVAL
        INY
        JMP PB_LOOP

; ==============================================================================
; Directive Handling
; ==============================================================================
PL_DIRECTIVE:
        ; Get directive name
        JSR SKIP_SPACE
        JSR GET_LABEL

        ; Check for .ORG
        LDA LABELBUF
        CMP #'O'
        BNE DIR_NOT_ORG
        LDA LABELBUF+1
        CMP #'R'
        BNE DIR_NOT_ORG
        LDA LABELBUF+2
        CMP #'G'
        BNE DIR_NOT_ORG
        JSR SKIP_SPACE
        JSR PARSE_EXPR
        LDA OPERAND
        STA CURPC
        LDA OPERAND+1
        STA CURPC+1
        JMP PL_DONE

DIR_NOT_ORG:
        ; Check for .DB / .BYTE
        LDA LABELBUF
        CMP #'D'
        BNE DIR_NOT_DB
        LDA LABELBUF+1
        CMP #'B'
        BEQ DIR_DB
        CMP #'W'
        BEQ DIR_DW
        CMP #'S'
        BEQ DIR_DS
        JMP DIR_NOT_DB

DIR_DB:
        JSR SKIP_SPACE
DIR_DB_LOOP:
        JSR PARSE_EXPR
        LDA OPERAND
        JSR EMIT_BYTE
        JSR SKIP_SPACE
        LDA (SRCPTR),Y
        CMP #','
        BNE DIR_DB_DONE
        INY
        JSR SKIP_SPACE
        JMP DIR_DB_LOOP
DIR_DB_DONE:
        JMP PL_DONE

DIR_DW:
        JSR SKIP_SPACE
DIR_DW_LOOP:
        JSR PARSE_EXPR
        LDA OPERAND
        JSR EMIT_BYTE
        LDA OPERAND+1
        JSR EMIT_BYTE
        JSR SKIP_SPACE
        LDA (SRCPTR),Y
        CMP #','
        BNE DIR_DW_DONE
        INY
        JSR SKIP_SPACE
        JMP DIR_DW_LOOP
DIR_DW_DONE:
        JMP PL_DONE

DIR_DS:
        JSR SKIP_SPACE
        JSR PARSE_EXPR
        ; Reserve OPERAND bytes
DIR_DS_LOOP:
        LDA OPERAND
        ORA OPERAND+1
        BEQ DIR_DS_DONE
        LDA #0
        JSR EMIT_BYTE
        LDA OPERAND
        BNE DIR_DS_DEC
        DEC OPERAND+1
DIR_DS_DEC:
        DEC OPERAND
        JMP DIR_DS_LOOP
DIR_DS_DONE:
        JMP PL_DONE

DIR_NOT_DB:
        ; Check for .BYTE
        LDA LABELBUF
        CMP #'B'
        BNE DIR_UNKNOWN
        LDA LABELBUF+1
        CMP #'Y'
        BNE DIR_UNKNOWN
        JMP DIR_DB

DIR_UNKNOWN:
        LDA #<ERR_DIR
        LDX #>ERR_DIR
        JSR PRINT_ERROR
        JMP PL_DONE

; ==============================================================================
; Define Label (at current PC)
; ==============================================================================
DEFINE_LABEL:
        ; Save Y (ADD_SYMBOL corrupts it)
        TYA
        PHA

        LDA PASS
        CMP #1
        BNE DL_DONE         ; Only define in pass 1

        ; Add to symbol table
        JSR ADD_SYMBOL
        LDA CURPC
        STA SYMVAL
        LDA CURPC+1
        STA SYMVAL+1
        JSR SET_SYMBOL

DL_DONE:
        ; Restore Y
        PLA
        TAY
        RTS

; ==============================================================================
; Define EQU (with value in OPERAND)
; ==============================================================================
DEFINE_EQU:
        ; Save Y (ADD_SYMBOL corrupts it)
        TYA
        PHA

        LDA PASS
        CMP #1
        BNE DE_DONE

        JSR ADD_SYMBOL
        LDA OPERAND
        STA SYMVAL
        LDA OPERAND+1
        STA SYMVAL+1
        JSR SET_SYMBOL

DE_DONE:
        ; Restore Y
        PLA
        TAY
        RTS

; ==============================================================================
; Symbol Table Operations
; ==============================================================================

; Add symbol name from LABELBUF, return index in X
ADD_SYMBOL:
        LDX #0
AS_LOOP:
        ; Check if slot is empty
        TXA
        PHA
        JSR GET_SYM_PTR
        LDY #0
        LDA (TMPPTR),Y
        STA CHARTMP         ; Save result (is slot empty?)
        PLA
        TAX
        LDA CHARTMP         ; Reload to set Z flag
        BEQ AS_EMPTY
        ; Check if name matches
        TXA
        PHA
        JSR MATCH_SYMBOL
        PLA
        TAX
        BCS AS_FOUND
        INX
        CPX #SYM_MAX
        BNE AS_LOOP
        ; Symbol table full
        LDA #<ERR_SYMFUL
        LDX #>ERR_SYMFUL
        JSR PRINT_ERROR
        RTS

AS_EMPTY:
        ; Copy name to this slot
        JSR GET_SYM_PTR
        LDY #0
AS_COPY:
        LDA LABELBUF,Y
        STA (TMPPTR),Y
        INY
        CPY #8
        BNE AS_COPY
AS_FOUND:
        RTS

; Set symbol value from SYMVAL
SET_SYMBOL:
        ; TMPPTR should still point to symbol
        LDY #8
        LDA SYMVAL
        STA (TMPPTR),Y
        INY
        LDA SYMVAL+1
        STA (TMPPTR),Y
        INY
        LDA #1              ; Defined flag
        STA (TMPPTR),Y
        RTS

; Lookup label in LABELBUF, set carry if not found
; Note: Preserves Y register (source offset)
LOOKUP_LABEL:
        ; Save Y (callers need it preserved for source parsing)
        TYA
        PHA

        LDX #0
LL_LOOP:
        TXA
        PHA
        JSR GET_SYM_PTR
        LDY #0
        LDA (TMPPTR),Y
        BEQ LL_NOTFOUND
        JSR MATCH_SYMBOL
        PLA
        TAX
        BCS LL_FOUND
        INX
        CPX #SYM_MAX
        BNE LL_LOOP
        ; Not found - restore Y and return with carry set
        PLA
        TAY
        SEC
        RTS

LL_NOTFOUND:
        PLA                 ; Pop X from LL_LOOP
        PLA                 ; Restore Y
        TAY
        SEC
        RTS

LL_FOUND:
        ; Get value
        LDY #8
        LDA (TMPPTR),Y
        STA SYMVAL
        INY
        LDA (TMPPTR),Y
        STA SYMVAL+1
        ; Restore Y and return with carry clear
        PLA
        TAY
        CLC
        RTS

; Get pointer to symbol X in TMPPTR
; TMPPTR = SYM_TAB + X * 16
GET_SYM_PTR:
        ; Start with base address
        LDA #<SYM_TAB
        STA TMPPTR
        LDA #>SYM_TAB
        STA TMPPTR+1
        TXA
        BEQ GSP_DONE
        ; Multiply X by 16 and add to TMPPTR
        ; X*16 = X << 4
        ; Low byte of result = (X << 4) & $FF = (X & $0F) << 4
        ; High byte of result = X >> 4
        TXA                 ; A = X
        ASL A               ; A = X*2
        ASL A               ; A = X*4
        ASL A               ; A = X*8
        ASL A               ; A = X*16 (low byte, high nibble lost)
        ; Add low byte to TMPPTR
        CLC
        ADC TMPPTR
        STA TMPPTR
        ; Calculate and add high byte
        TXA                 ; A = X
        LSR A               ; A = X/2
        LSR A               ; A = X/4
        LSR A               ; A = X/8
        LSR A               ; A = X/16 = high byte of X*16
        ADC TMPPTR+1        ; Add with carry from low byte addition
        STA TMPPTR+1
GSP_DONE:
        RTS

; Match LABELBUF against symbol at TMPPTR
MATCH_SYMBOL:
        LDY #0
MS_LOOP:
        LDA LABELBUF,Y
        CMP (TMPPTR),Y
        BNE MS_FAIL
        CMP #0
        BEQ MS_OK
        INY
        CPY #8
        BNE MS_LOOP
MS_OK:
        SEC
        RTS
MS_FAIL:
        CLC
        RTS

; ==============================================================================
; Get Label Name into LABELBUF
; ==============================================================================
GET_LABEL:
        LDX #0
GL_LOOP:
        LDA (SRCPTR),Y
        JSR IS_ALNUM
        BCS GL_DONE
        AND #$DF            ; Uppercase
        STA LABELBUF,X
        INY
        INX
        CPX #8
        BNE GL_LOOP
        ; Skip rest of name
GL_SKIP:
        LDA (SRCPTR),Y
        JSR IS_ALNUM
        BCS GL_DONE
        INY
        JMP GL_SKIP
GL_DONE:
        LDA #0
        STA LABELBUF,X
        RTS

; ==============================================================================
; Token Handling
; ==============================================================================
GET_TOKEN:
        ; Note: Y should already be set by caller (offset from SRCPTR)
        LDA (SRCPTR),Y
        BEQ GT_EOF_JMP
        CMP #$0A
        BEQ GT_NL_JMP
        CMP #$0D
        BEQ GT_NL_JMP
        CMP #'#'
        BEQ GT_HASH_JMP
        CMP #'('
        BEQ GT_LPAREN_JMP
        CMP #')'
        BEQ GT_RPAREN_JMP
        CMP #','
        BEQ GT_COMMA_JMP
        CMP #'+'
        BEQ GT_PLUS_JMP
        CMP #'-'
        BEQ GT_MINUS_JMP
        CMP #'='
        BEQ GT_EQUALS_JMP
        CMP #'.'
        BEQ GT_DOT_JMP
        CMP #':'
        BEQ GT_COLON_JMP
        CMP #'<'
        BEQ GT_LT_JMP
        CMP #'>'
        BEQ GT_GT_JMP
        CMP #';'
        BEQ GT_COMMENT_JMP
        CMP #'$'
        BEQ GT_NUMBER_JMP
        CMP #'0'
        BCC GT_LABEL
        CMP #':'
        BCC GT_NUMBER_JMP
        JMP GT_LABEL        ; Fall through to label

; Trampolines for far branches
GT_EOF_JMP:
        JMP GT_EOF
GT_NL_JMP:
        JMP GT_NL
GT_HASH_JMP:
        JMP GT_HASH
GT_LPAREN_JMP:
        JMP GT_LPAREN
GT_RPAREN_JMP:
        JMP GT_RPAREN
GT_COMMA_JMP:
        JMP GT_COMMA
GT_PLUS_JMP:
        JMP GT_PLUS
GT_MINUS_JMP:
        JMP GT_MINUS
GT_EQUALS_JMP:
        JMP GT_EQUALS
GT_DOT_JMP:
        JMP GT_DOT
GT_COLON_JMP:
        JMP GT_COLON
GT_LT_JMP:
        JMP GT_LT
GT_GT_JMP:
        JMP GT_GT
GT_COMMENT_JMP:
        JMP GT_COMMENT
GT_NUMBER_JMP:
        JMP GT_NUMBER

GT_LABEL:
        ; Identifier - could be label or mnemonic
        JSR GET_LABEL
        ; Copy to MNEMBUF as well
        LDX #0
GT_COPY:
        LDA LABELBUF,X
        STA MNEMBUF,X
        INX
        CPX #8
        BNE GT_COPY
        LDA #TOK_LABEL
        STA TOKTYPE
        RTS

GT_EOF:
        LDA #TOK_EOF
        STA TOKTYPE
        RTS
GT_NL:
        LDA #TOK_NEWLINE
        STA TOKTYPE
        INY
        RTS
GT_COMMENT:
        ; Skip to end of line, then return NEWLINE token
GT_COMMENT_SKIP:
        INY
        LDA (SRCPTR),Y
        BEQ GT_COMMENT_DONE     ; End of file
        CMP #$0A                ; LF
        BEQ GT_COMMENT_DONE
        CMP #$0D                ; CR
        BNE GT_COMMENT_SKIP
GT_COMMENT_DONE:
        LDA #TOK_NEWLINE
        STA TOKTYPE
        RTS
GT_HASH:
        LDA #TOK_HASH
        STA TOKTYPE
        INY
        RTS
GT_LPAREN:
        LDA #TOK_LPAREN
        STA TOKTYPE
        INY
        RTS
GT_RPAREN:
        LDA #TOK_RPAREN
        STA TOKTYPE
        INY
        RTS
GT_COMMA:
        LDA #TOK_COMMA
        STA TOKTYPE
        INY
        RTS
GT_PLUS:
        LDA #TOK_PLUS
        STA TOKTYPE
        INY
        RTS
GT_MINUS:
        LDA #TOK_MINUS
        STA TOKTYPE
        INY
        RTS
GT_EQUALS:
        LDA #TOK_EQUALS
        STA TOKTYPE
        INY
        RTS
GT_DOT:
        LDA #TOK_DOT
        STA TOKTYPE
        INY
        RTS
GT_COLON:
        LDA #TOK_COLON
        STA TOKTYPE
        INY
        RTS
GT_LT:
        LDA #TOK_LT
        STA TOKTYPE
        INY
        RTS
GT_GT:
        LDA #TOK_GT
        STA TOKTYPE
        INY
        RTS
GT_NUMBER:
        LDA #TOK_NUMBER
        STA TOKTYPE
        RTS

; ==============================================================================
; Skip Whitespace
; ==============================================================================
SKIP_SPACE:
        LDA (SRCPTR),Y
        CMP #' '
        BEQ SS_SKIP
        CMP #$09            ; Tab
        BEQ SS_SKIP
        RTS
SS_SKIP:
        INY
        BNE SKIP_SPACE
        INC SRCPTR+1
        LDY #0
        JMP SKIP_SPACE

; ==============================================================================
; Character Tests
; ==============================================================================
IS_ALNUM:
        ; Returns carry set if NOT alphanumeric
        CMP #'0'
        BCC IA_NO
        CMP #':'            ; '9'+1
        BCC IA_YES
        CMP #'A'
        BCC IA_NO
        CMP #'['            ; 'Z'+1
        BCC IA_YES
        CMP #'_'
        BEQ IA_YES
        CMP #'a'
        BCC IA_NO
        CMP #'{'            ; 'z'+1
        BCC IA_YES
IA_NO:
        SEC
        RTS
IA_YES:
        CLC
        RTS

IS_HEX:
        ; Returns carry set if NOT hex digit
        CMP #'0'
        BCC IH_NO
        CMP #':'            ; '9'+1
        BCC IH_YES
        AND #$DF            ; Uppercase
        CMP #'A'
        BCC IH_NO
        CMP #'G'
        BCS IH_NO
IH_YES:
        CLC
        RTS
IH_NO:
        SEC
        RTS

HEX_DIGIT:
        ; Convert hex char in A to value 0-15
        CMP #'A'
        BCC HD_DIG
        AND #$DF            ; Uppercase
        SEC
        SBC #'A'-10
        RTS
HD_DIG:
        AND #$0F
        RTS

; ==============================================================================
; Mnemonic Lookup - Find mnemonic index
; ==============================================================================
; Note: Preserves Y register (source offset)
LOOKUP_MNEM:
        ; Save Y - callers need it for source parsing
        TYA
        PHA

        LDX #0
LM_LOOP:
        ; Get pointer to mnemonic entry
        TXA
        ASL A
        ASL A               ; X * 4
        CLC
        ADC #<MNEM_TABLE
        STA TMPPTR
        LDA #>MNEM_TABLE
        ADC #0
        STA TMPPTR+1

        ; Compare 3 characters
        LDY #0
        LDA (TMPPTR),Y
        BEQ LM_NOTFOUND     ; End of table
        CMP MNEMBUF
        BNE LM_NEXT
        INY
        LDA (TMPPTR),Y
        CMP MNEMBUF+1
        BNE LM_NEXT
        INY
        LDA (TMPPTR),Y
        CMP MNEMBUF+2
        BNE LM_NEXT

        ; Found it!
        STX OPCODE          ; Save index
        PLA                 ; Restore Y
        TAY
        CLC
        RTS

LM_NEXT:
        INX
        CPX #56             ; 56 mnemonics
        BNE LM_LOOP

LM_NOTFOUND:
        PLA                 ; Restore Y
        TAY
        SEC
        RTS

; ==============================================================================
; Opcode Lookup - Find opcode for mnemonic + addressing mode
; ==============================================================================
LOOKUP_OPCODE:
        ; OPCODE has mnemonic index, ADDRMODE has addressing mode
        ; Look up in opcode table
        ; Save Y - callers need it for source parsing
        TYA
        PHA
        LDA OPCODE
        ASL A
        ASL A
        ASL A
        ASL A               ; * 16 (13 modes + padding)
        CLC
        ADC ADDRMODE
        TAX

        ; Get base pointer
        LDA #<OPCODE_TABLE
        CLC
        ADC OPCODE
        STA TMPPTR
        LDA #>OPCODE_TABLE
        ADC #0
        STA TMPPTR+1

        ; Actually we need a different approach - use mode lookup
        ; For now, use simple lookup table

        ; Check if this mnemonic supports this mode
        ; Branch instructions only support relative
        ; Branches are: BCC(3), BCS(4), BEQ(5), BMI(7), BNE(8), BPL(9), BVC(11), BVS(12)
        LDA OPCODE
        CMP #3              ; BCC
        BEQ LO_IS_BRANCH
        CMP #4              ; BCS
        BEQ LO_IS_BRANCH
        CMP #5              ; BEQ
        BEQ LO_IS_BRANCH
        CMP #7              ; BMI
        BEQ LO_IS_BRANCH
        CMP #8              ; BNE
        BEQ LO_IS_BRANCH
        CMP #9              ; BPL
        BEQ LO_IS_BRANCH
        CMP #11             ; BVC
        BEQ LO_IS_BRANCH
        CMP #12             ; BVS
        BEQ LO_IS_BRANCH
        JMP LO_NORMAL

LO_IS_BRANCH:
        ; It's a branch - use relative mode
        LDA #AM_REL
        STA ADDRMODE

LO_NORMAL:
        ; Look up in full opcode table
        ; Each mnemonic has 13 possible opcodes (one per mode)
        LDA OPCODE
        ASL A               ; * 2
        TAX
        LDA MNEM_MODES,X
        STA TMPPTR
        LDA MNEM_MODES+1,X
        STA TMPPTR+1

        ; Get opcode for this mode
        LDY ADDRMODE
        LDA (TMPPTR),Y
        CMP #$FF            ; Invalid mode
        BEQ LO_INVALID

        STA OPCODE          ; Now OPCODE is the actual opcode byte
        PLA                 ; Restore Y
        TAY
        CLC
        RTS

LO_INVALID:
        PLA                 ; Restore Y
        TAY
        SEC
        RTS

; ==============================================================================
; Emit Instruction
; ==============================================================================
EMIT_INSTR:
        ; Output opcode
        LDA OPCODE
        JSR EMIT_BYTE

        ; Output operand based on addressing mode
        LDA ADDRMODE
        CMP #AM_IMP
        BEQ EI_DONE_JMP
        CMP #AM_ACC
        BEQ EI_DONE_JMP
        CMP #AM_REL
        BEQ EI_REL_JMP
        JMP EI_CHK_OTHER
EI_DONE_JMP:
        JMP EI_DONE
EI_REL_JMP:
        JMP EI_REL
EI_CHK_OTHER:
        CMP #AM_IMM
        BEQ EI_ONE
        CMP #AM_ZP
        BEQ EI_ONE
        CMP #AM_ZPX
        BEQ EI_ONE
        CMP #AM_ZPY
        BEQ EI_ONE
        CMP #AM_INX
        BEQ EI_ONE
        CMP #AM_INY
        BEQ EI_ONE

        ; Two-byte operand
        LDA OPERAND
        JSR EMIT_BYTE
        LDA OPERAND+1
        JSR EMIT_BYTE
        RTS

EI_ONE:
        LDA OPERAND
        JSR EMIT_BYTE
        RTS

EI_REL:
        ; Calculate relative offset
        ; Offset = target - (PC after instruction)
        ; Note: CURPC already incremented by 1 after emitting opcode,
        ; so we only add 1 more to get address after operand byte
        LDA CURPC
        CLC
        ADC #1
        STA TMPPTR
        LDA CURPC+1
        ADC #0
        STA TMPPTR+1

        SEC
        LDA OPERAND
        SBC TMPPTR
        PHA
        LDA OPERAND+1
        SBC TMPPTR+1

        ; In pass 1, skip range check (forward refs may be undefined)
        PHA                 ; Save high byte result
        LDA PASS
        CMP #1
        BNE EI_CHK_RANGE
        ; Pass 1 - emit placeholder
        PLA                 ; Discard high byte
        PLA                 ; Get low byte
        JSR EMIT_BYTE
        RTS

EI_CHK_RANGE:
        PLA                 ; Restore high byte for check
        ; Check range (-128 to +127)
        BEQ EI_REL_POS
        CMP #$FF
        BNE EI_REL_ERR
        ; Negative offset
        PLA
        JSR EMIT_BYTE
        RTS

EI_REL_POS:
        PLA
        CMP #$80
        BCS EI_REL_ERR
        JSR EMIT_BYTE
        RTS

EI_REL_ERR:
        PLA
        LDA #<ERR_RANGE
        LDX #>ERR_RANGE
        JSR PRINT_ERROR
        LDA #0
        JSR EMIT_BYTE

EI_DONE:
        RTS

; ==============================================================================
; Emit Byte
; ==============================================================================
EMIT_BYTE:
        ; Only emit in pass 2
        ; Save Y - callers need it for source parsing
        PHA
        TYA
        PHA
        LDA PASS
        CMP #2
        BNE EB_SKIP

        ; Get byte to emit (from stack)
        TSX
        LDA $0102,X         ; Byte is 2 entries up
        LDY #0
        STA (OUTPTR),Y
        INC OUTPTR
        BNE EB_SKIP
        INC OUTPTR+1

EB_SKIP:
        ; Restore Y
        PLA
        TAY
        ; Get original byte
        PLA
        ; Always increment PC
        INC CURPC
        BNE EB_DONE
        INC CURPC+1
EB_DONE:
        RTS

; ==============================================================================
; Output Routines
; ==============================================================================
PRINT_STR:
        STA TMPPTR
        STX TMPPTR+1
        LDY #0
PS_LOOP:
        LDA (TMPPTR),Y
        BEQ PS_DONE
        JSR PUTCHAR
        INY
        BNE PS_LOOP
PS_DONE:
        RTS

PRINT_HEX16:
        ; Print 16-bit value in A (low) and X (high)
        PHA
        TXA
        JSR PRINT_HEX8
        PLA
        JSR PRINT_HEX8
        RTS

PRINT_HEX8:
        PHA
        LSR A
        LSR A
        LSR A
        LSR A
        JSR PRINT_DIGIT
        PLA
        AND #$0F
        JSR PRINT_DIGIT
        RTS

PRINT_DIGIT:
        CMP #10
        BCC PD_DIG
        CLC
        ADC #'A'-10
        JMP PUTCHAR
PD_DIG:
        CLC
        ADC #'0'
        JMP PUTCHAR

PRINT_ERROR:
        ; Print error message, then line number
        ; Save message pointer on stack (TMPPTR is clobbered by PRINT_STR)
        PHA
        TXA
        PHA

        LDA #1
        STA ERRFLAG

        ; Print "Error: "
        LDA #<ERR_PREFIX
        LDX #>ERR_PREFIX
        JSR PRINT_STR

        ; Print error message (restore from stack)
        PLA
        TAX
        PLA
        JSR PRINT_STR

        ; Print " at line "
        LDA #<MSG_LINE
        LDX #>MSG_LINE
        JSR PRINT_STR

        ; Print line number
        LDA LINENUM
        LDX LINENUM+1
        JSR PRINT_HEX16

        JSR NEWLINE
        RTS

; ==============================================================================
; Data Tables
; ==============================================================================

; Mnemonic table: 3-char mnemonic + flags byte (56 entries)
MNEM_TABLE:
        .DB 'A', 'D', 'C', 0   ; 0 - ADC
        .DB 'A', 'N', 'D', 0   ; 1 - AND
        .DB 'A', 'S', 'L', 0   ; 2 - ASL
        .DB 'B', 'C', 'C', 0   ; 3 - BCC
        .DB 'B', 'C', 'S', 0   ; 4 - BCS
        .DB 'B', 'E', 'Q', 0   ; 5 - BEQ
        .DB 'B', 'I', 'T', 0   ; 6 - BIT
        .DB 'B', 'M', 'I', 0   ; 7 - BMI
        .DB 'B', 'N', 'E', 0   ; 8 - BNE
        .DB 'B', 'P', 'L', 0   ; 9 - BPL
        .DB 'B', 'R', 'K', 0   ; 10 - BRK
        .DB 'B', 'V', 'C', 0   ; 11 - BVC
        .DB 'B', 'V', 'S', 0   ; 12 - BVS
        .DB 'C', 'L', 'C', 0   ; 13 - CLC
        .DB 'C', 'L', 'D', 0   ; 14 - CLD
        .DB 'C', 'L', 'I', 0   ; 15 - CLI
        .DB 'C', 'L', 'V', 0   ; 16 - CLV
        .DB 'C', 'M', 'P', 0   ; 17 - CMP
        .DB 'C', 'P', 'X', 0   ; 18 - CPX
        .DB 'C', 'P', 'Y', 0   ; 19 - CPY
        .DB 'D', 'E', 'C', 0   ; 20 - DEC
        .DB 'D', 'E', 'X', 0   ; 21 - DEX
        .DB 'D', 'E', 'Y', 0   ; 22 - DEY
        .DB 'E', 'O', 'R', 0   ; 23 - EOR
        .DB 'I', 'N', 'C', 0   ; 24 - INC
        .DB 'I', 'N', 'X', 0   ; 25 - INX
        .DB 'I', 'N', 'Y', 0   ; 26 - INY
        .DB 'J', 'M', 'P', 0   ; 27 - JMP
        .DB 'J', 'S', 'R', 0   ; 28 - JSR
        .DB 'L', 'D', 'A', 0   ; 29 - LDA
        .DB 'L', 'D', 'X', 0   ; 30 - LDX
        .DB 'L', 'D', 'Y', 0   ; 31 - LDY
        .DB 'L', 'S', 'R', 0   ; 32 - LSR
        .DB 'N', 'O', 'P', 0   ; 33 - NOP
        .DB 'O', 'R', 'A', 0   ; 34 - ORA
        .DB 'P', 'H', 'A', 0   ; 35 - PHA
        .DB 'P', 'H', 'P', 0   ; 36 - PHP
        .DB 'P', 'L', 'A', 0   ; 37 - PLA
        .DB 'P', 'L', 'P', 0   ; 38 - PLP
        .DB 'R', 'O', 'L', 0   ; 39 - ROL
        .DB 'R', 'O', 'R', 0   ; 40 - ROR
        .DB 'R', 'T', 'I', 0   ; 41 - RTI
        .DB 'R', 'T', 'S', 0   ; 42 - RTS
        .DB 'S', 'B', 'C', 0   ; 43 - SBC
        .DB 'S', 'E', 'C', 0   ; 44 - SEC
        .DB 'S', 'E', 'D', 0   ; 45 - SED
        .DB 'S', 'E', 'I', 0   ; 46 - SEI
        .DB 'S', 'T', 'A', 0   ; 47 - STA
        .DB 'S', 'T', 'X', 0   ; 48 - STX
        .DB 'S', 'T', 'Y', 0   ; 49 - STY
        .DB 'T', 'A', 'X', 0   ; 50 - TAX
        .DB 'T', 'A', 'Y', 0   ; 51 - TAY
        .DB 'T', 'S', 'X', 0   ; 52 - TSX
        .DB 'T', 'X', 'A', 0   ; 53 - TXA
        .DB 'T', 'X', 'S', 0   ; 54 - TXS
        .DB 'T', 'Y', 'A', 0   ; 55 - TYA
        .DB 0, 0, 0, 0        ; End marker

; Pointers to opcode tables for each mnemonic
; OPCODE_TABLE alias for legacy code (dead code in LOOKUP_OPCODE)
OPCODE_TABLE:
MNEM_MODES:
        .DW OP_ADC, OP_AND, OP_ASL, OP_BCC, OP_BCS, OP_BEQ, OP_BIT, OP_BMI
        .DW OP_BNE, OP_BPL, OP_BRK, OP_BVC, OP_BVS, OP_CLC, OP_CLD, OP_CLI
        .DW OP_CLV, OP_CMP, OP_CPX, OP_CPY, OP_DEC, OP_DEX, OP_DEY, OP_EOR
        .DW OP_INC, OP_INX, OP_INY, OP_JMP, OP_JSR, OP_LDA, OP_LDX, OP_LDY
        .DW OP_LSR, OP_NOP, OP_ORA, OP_PHA, OP_PHP, OP_PLA, OP_PLP, OP_ROL
        .DW OP_ROR, OP_RTI, OP_RTS, OP_SBC, OP_SEC, OP_SED, OP_SEI, OP_STA
        .DW OP_STX, OP_STY, OP_TAX, OP_TAY, OP_TSX, OP_TXA, OP_TXS, OP_TYA

; Opcode tables - 13 bytes per mnemonic (one per addressing mode)
; Order: IMP, ACC, IMM, ZP, ZPX, ZPY, ABS, ABX, ABY, IND, INX, INY, REL
; $FF = mode not supported

OP_ADC: .DB $FF,$FF,$69,$65,$75,$FF,$6D,$7D,$79,$FF,$61,$71,$FF
OP_AND: .DB $FF,$FF,$29,$25,$35,$FF,$2D,$3D,$39,$FF,$21,$31,$FF
OP_ASL: .DB $FF,$0A,$FF,$06,$16,$FF,$0E,$1E,$FF,$FF,$FF,$FF,$FF
OP_BCC: .DB $FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$90
OP_BCS: .DB $FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$B0
OP_BEQ: .DB $FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$F0
OP_BIT: .DB $FF,$FF,$FF,$24,$FF,$FF,$2C,$FF,$FF,$FF,$FF,$FF,$FF
OP_BMI: .DB $FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$30
OP_BNE: .DB $FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$D0
OP_BPL: .DB $FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$10
OP_BRK: .DB $00,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF
OP_BVC: .DB $FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$50
OP_BVS: .DB $FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$70
OP_CLC: .DB $18,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF
OP_CLD: .DB $D8,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF
OP_CLI: .DB $58,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF
OP_CLV: .DB $B8,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF
OP_CMP: .DB $FF,$FF,$C9,$C5,$D5,$FF,$CD,$DD,$D9,$FF,$C1,$D1,$FF
OP_CPX: .DB $FF,$FF,$E0,$E4,$FF,$FF,$EC,$FF,$FF,$FF,$FF,$FF,$FF
OP_CPY: .DB $FF,$FF,$C0,$C4,$FF,$FF,$CC,$FF,$FF,$FF,$FF,$FF,$FF
OP_DEC: .DB $FF,$FF,$FF,$C6,$D6,$FF,$CE,$DE,$FF,$FF,$FF,$FF,$FF
OP_DEX: .DB $CA,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF
OP_DEY: .DB $88,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF
OP_EOR: .DB $FF,$FF,$49,$45,$55,$FF,$4D,$5D,$59,$FF,$41,$51,$FF
OP_INC: .DB $FF,$FF,$FF,$E6,$F6,$FF,$EE,$FE,$FF,$FF,$FF,$FF,$FF
OP_INX: .DB $E8,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF
OP_INY: .DB $C8,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF
OP_JMP: .DB $FF,$FF,$FF,$FF,$FF,$FF,$4C,$FF,$FF,$6C,$FF,$FF,$FF
OP_JSR: .DB $FF,$FF,$FF,$FF,$FF,$FF,$20,$FF,$FF,$FF,$FF,$FF,$FF
OP_LDA: .DB $FF,$FF,$A9,$A5,$B5,$FF,$AD,$BD,$B9,$FF,$A1,$B1,$FF
OP_LDX: .DB $FF,$FF,$A2,$A6,$FF,$B6,$AE,$FF,$BE,$FF,$FF,$FF,$FF
OP_LDY: .DB $FF,$FF,$A0,$A4,$B4,$FF,$AC,$BC,$FF,$FF,$FF,$FF,$FF
OP_LSR: .DB $FF,$4A,$FF,$46,$56,$FF,$4E,$5E,$FF,$FF,$FF,$FF,$FF
OP_NOP: .DB $EA,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF
OP_ORA: .DB $FF,$FF,$09,$05,$15,$FF,$0D,$1D,$19,$FF,$01,$11,$FF
OP_PHA: .DB $48,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF
OP_PHP: .DB $08,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF
OP_PLA: .DB $68,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF
OP_PLP: .DB $28,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF
OP_ROL: .DB $FF,$2A,$FF,$26,$36,$FF,$2E,$3E,$FF,$FF,$FF,$FF,$FF
OP_ROR: .DB $FF,$6A,$FF,$66,$76,$FF,$6E,$7E,$FF,$FF,$FF,$FF,$FF
OP_RTI: .DB $40,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF
OP_RTS: .DB $60,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF
OP_SBC: .DB $FF,$FF,$E9,$E5,$F5,$FF,$ED,$FD,$F9,$FF,$E1,$F1,$FF
OP_SEC: .DB $38,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF
OP_SED: .DB $F8,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF
OP_SEI: .DB $78,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF
OP_STA: .DB $FF,$FF,$FF,$85,$95,$FF,$8D,$9D,$99,$FF,$81,$91,$FF
OP_STX: .DB $FF,$FF,$FF,$86,$FF,$96,$8E,$FF,$FF,$FF,$FF,$FF,$FF
OP_STY: .DB $FF,$FF,$FF,$84,$94,$FF,$8C,$FF,$FF,$FF,$FF,$FF,$FF
OP_TAX: .DB $AA,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF
OP_TAY: .DB $A8,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF
OP_TSX: .DB $BA,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF
OP_TXA: .DB $8A,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF
OP_TXS: .DB $9A,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF
OP_TYA: .DB $98,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF

; ==============================================================================
; String Constants
; ==============================================================================
BANNER:
        .DB "WireOS Stage 1 Assembler v1.0", $0D, $0A
        .DB "================================", $0D, $0A, 0

MSG_OK:
        .DB $0D, $0A, "Assembly complete. ", 0

MSG_BYTES:
        .DB " bytes", $0D, $0A, 0

MSG_ERR:
        .DB $0D, $0A, "Assembly failed.", $0D, $0A, 0

MSG_LINE:
        .DB " at line $", 0

ERR_PREFIX:
        .DB "Error: ", 0

ERR_MNEM:
        .DB "Unknown mnemonic", 0

ERR_MODE:
        .DB "Invalid addressing mode", 0

ERR_SYNTAX:
        .DB "Syntax error", 0

ERR_UNDEF:
        .DB "Undefined symbol", 0

ERR_RANGE:
        .DB "Branch out of range", 0

ERR_DIR:
        .DB "Unknown directive", 0

ERR_SYMFUL:
        .DB "Symbol table full", 0

; ==============================================================================
; LOAD_FILE - Load source file from command line
; ==============================================================================
; Input: Command line at CMD_BUF ($0300), e.g., "ASM TEST.ASM"
; Output: Carry clear = success, source loaded to SRC_BUF
;         Carry set = error (message printed)
; ==============================================================================
LOAD_FILE:
        ; Skip the command name to find the filename argument
        LDX #0
LF_SKIP_CMD:
        LDA CMD_BUF,X
        BEQ LF_NO_ARG_JMP   ; End of string, no argument
        CMP #$20            ; Space?
        BEQ LF_FOUND_SPACE
        INX
        BNE LF_SKIP_CMD
LF_NO_ARG_JMP:
        JMP LF_NO_ARG       ; Trampoline for far branch
LF_NOT_FOUND_JMP:
        JMP LF_NOT_FOUND    ; Trampoline for far branch
LF_READ_ERR_JMP:
        JMP LF_READ_ERROR   ; Trampoline for far branch
LF_NEXT_ENTRY_JMP:
        JMP LF_NEXT_ENTRY   ; Trampoline for far branch

LF_FOUND_SPACE:
        ; Skip spaces to get to filename
        INX
LF_SKIP_SPACES:
        LDA CMD_BUF,X
        BEQ LF_NO_ARG_JMP   ; End of string
        CMP #$20            ; Space?
        BNE LF_GOT_ARG
        INX
        BNE LF_SKIP_SPACES

LF_GOT_ARG:
        ; X now points to filename in CMD_BUF
        ; Store argument pointer in TMPPTR and FNAMEOFF
        STX TMPPTR          ; Filename offset in CMD_BUF (temp use)
        STX FNAMEOFF        ; Preserve filename offset for SAVE_FILE

        ; Search directory for file
        LDA #DIR_START
        STA DIRSEC          ; Current directory sector
        LDA #DIR_SECTS
        STA CHARTMP         ; Remaining sectors

LF_SECTOR:
        ; Read directory sector into DIR_BUF
        LDA DIRSEC          ; Sector number
        STA $30
        LDA #0
        STA $31
        LDA #<DIR_BUF
        STA $32
        LDA #>DIR_BUF
        STA $33
        JSR DISK_READ
        BCS LF_NOT_FOUND_JMP

        ; Search entries in this sector
        LDA #<DIR_BUF
        STA SYMPTR
        LDA #>DIR_BUF
        STA SYMPTR+1
        LDX #0              ; Entry counter

LF_SEARCH:
        ; Check if entry is active (status byte = 1)
        LDY #0
        LDA (SYMPTR),Y
        CMP #1
        BNE LF_NEXT_ENTRY_JMP

        ; Check parent directory matches current directory
        ; Parent index is at offset $15-$16 in directory entry
        LDY #$15
        LDA (SYMPTR),Y
        CMP CUR_DIR_LO
        BNE LF_NEXT_ENTRY_JMP
        INY
        LDA (SYMPTR),Y
        CMP CUR_DIR_HI
        BNE LF_NEXT_ENTRY_JMP

        ; Compare filename
        LDX TMPPTR          ; Get filename offset
        LDY #0              ; Entry filename offset

LF_CMP_LOOP:
        LDA CMD_BUF,X       ; Arg char
        BEQ LF_CMP_END      ; End of arg = match (if entry also ends or is space-padded)
        CMP #$20            ; Space ends filename
        BEQ LF_CMP_END
        CMP #$2E            ; '.' also ends name portion
        BEQ LF_CMP_END

        ; Get entry filename char at offset Y+1
        STY CHARTMP         ; Save Y
        TYA
        CLC
        ADC #1              ; Skip status byte
        TAY
        LDA (SYMPTR),Y      ; Entry filename char
        LDY CHARTMP         ; Restore Y

        ; Compare
        CMP CMD_BUF,X
        BNE LF_NEXT_ENTRY_JMP ; No match

        INX
        INY
        CPY #8              ; Max 8 chars in name
        BNE LF_CMP_LOOP

LF_CMP_END:
        ; Found matching file!
        ; Get start sector from offset $0C-$0D
        LDY #$0C
        LDA (SYMPTR),Y
        STA FILESEC
        INY
        LDA (SYMPTR),Y
        STA FILESEC+1

        ; Get file size from offset $0E-$0F
        LDY #$0E
        LDA (SYMPTR),Y
        STA FILESIZE
        INY
        LDA (SYMPTR),Y
        STA FILESIZE+1

        ; Print "Loading " + filename
        ; Save TMPPTR (filename offset) before PRINT_STR clobbers it
        LDA TMPPTR
        PHA
        LDA #<MSG_LOADING
        LDX #>MSG_LOADING
        JSR PRINT_STR
        ; Restore filename offset
        PLA
        TAX
LF_PRINT_NAME:
        LDA CMD_BUF,X
        BEQ LF_PRINT_DONE
        CMP #$20
        BEQ LF_PRINT_DONE
        JSR PUTCHAR
        INX
        BNE LF_PRINT_NAME
LF_PRINT_DONE:
        JSR NEWLINE

        ; Load file into SRC_BUF
        ; For simplicity, load one sector at a time
        LDA #<SRC_BUF
        STA SRCPTR
        LDA #>SRC_BUF
        STA SRCPTR+1

        ; Calculate number of sectors needed
        LDA FILESIZE+1
        LSR A               ; Divide by 2 (512 = 2 pages)
        STA CHARTMP         ; Sector count high approximation
        LDA FILESIZE
        BEQ LF_NO_EXTRA
        INC CHARTMP         ; Round up if any low bytes
LF_NO_EXTRA:
        LDA CHARTMP
        BEQ LF_ONE_SECTOR   ; At least one sector
        JMP LF_LOAD_LOOP
LF_ONE_SECTOR:
        LDA #1
        STA CHARTMP

LF_LOAD_LOOP:
        ; Read sector
        LDA FILESEC
        STA $30
        LDA FILESEC+1
        STA $31
        LDA SRCPTR
        STA $32
        LDA SRCPTR+1
        STA $33
        JSR DISK_READ
        BCS LF_READ_ERROR

        ; Advance to next sector
        INC FILESEC
        BNE LF_NO_CARRY
        INC FILESEC+1
LF_NO_CARRY:

        ; Advance buffer pointer by 512 bytes (2 pages)
        CLC
        LDA SRCPTR+1
        ADC #2
        STA SRCPTR+1

        ; Decrement sector count
        DEC CHARTMP
        BNE LF_LOAD_LOOP

        ; Null-terminate the source (in case file doesn't end with null)
        LDY #0
        LDA #0
        STA (SRCPTR),Y

        ; Reset source pointer to start
        LDA #<SRC_BUF
        STA SRCPTR
        LDA #>SRC_BUF
        STA SRCPTR+1

        CLC                 ; Success
        RTS

LF_NEXT_ENTRY:
        ; Move to next entry (+32 bytes)
        CLC
        LDA SYMPTR
        ADC #32
        STA SYMPTR
        LDA SYMPTR+1
        ADC #0
        STA SYMPTR+1

        ; Check if we've done 16 entries
        ; SYMPTR started at DIR_BUF ($0400), after 16 entries it's at $0600
        ; Check if high byte has increased by 2 (512 bytes / 256 = 2 pages)
        INX
        CPX #16
        BEQ LF_NEXT_SECTOR_CHECK
        JMP LF_SEARCH

LF_NEXT_SECTOR_CHECK:
        ; Next sector
        INC DIRSEC          ; Next sector number
        DEC CHARTMP         ; Remaining sectors
        BEQ LF_NOT_FOUND
        JMP LF_SECTOR

LF_NO_ARG:
        LDA #<MSG_USAGE
        LDX #>MSG_USAGE
        JSR PRINT_STR
        SEC                 ; Error
        RTS

LF_NOT_FOUND:
        LDA #<MSG_NOTFOUND
        LDX #>MSG_NOTFOUND
        JSR PRINT_STR
        SEC                 ; Error
        RTS

LF_READ_ERROR:
        LDA #<MSG_READERR
        LDX #>MSG_READERR
        JSR PRINT_STR
        SEC                 ; Error
        RTS

; ==============================================================================
; SAVE_FILE - Save assembled output as .COM file
; ==============================================================================
; Input: FILESIZE = output size (set after assembly)
;        TMPPTR = offset to input filename in CMD_BUF (set by LOAD_FILE)
; Output: Carry clear = success, Carry set = error
;
; Algorithm:
; 1. Build output filename (input name with .COM extension)
; 2. Find free directory entry
; 3. Find free sectors using bitmap
; 4. Write output buffer to disk
; 5. Update directory entry
; ==============================================================================
SAVE_FILE:
        ; Print "Saving "
        LDA #<MSG_SAVING
        LDX #>MSG_SAVING
        JSR PRINT_STR

        ; Build output filename - copy name portion (up to 8 chars)
        LDX FNAMEOFF        ; Source filename offset in CMD_BUF (preserved from LOAD_FILE)
        LDY #0              ; Output filename index
SF_COPY_NAME:
        LDA CMD_BUF,X
        BEQ SF_PAD_NAME     ; End of string
        CMP #$20            ; Space
        BEQ SF_PAD_NAME
        CMP #$2E            ; '.'
        BEQ SF_PAD_NAME
        STA SCRATCH,Y       ; Store in scratch area (output filename)
        ; Also print the char
        JSR PUTCHAR
        INX
        INY
        CPY #8
        BNE SF_COPY_NAME

SF_PAD_NAME:
        ; Pad name with spaces to 8 chars
        LDA #$20
SF_PAD_LOOP:
        CPY #8
        BEQ SF_ADD_EXT
        STA SCRATCH,Y
        INY
        JMP SF_PAD_LOOP

SF_ADD_EXT:
        ; Add .COM extension
        LDA #$43            ; 'C'
        STA SCRATCH+8
        LDA #$4F            ; 'O'
        STA SCRATCH+9
        LDA #$4D            ; 'M'
        STA SCRATCH+10
        ; Print ".COM"
        LDA #$2E
        JSR PUTCHAR
        LDA #$43
        JSR PUTCHAR
        LDA #$4F
        JSR PUTCHAR
        LDA #$4D
        JSR PUTCHAR
        JSR NEWLINE

        ; Find a free directory entry (or reuse existing with same name)
        LDA #DIR_START
        STA DIRSEC
        LDA #DIR_SECTS
        STA CHARTMP         ; Sectors remaining

SF_DIR_SECTOR:
        ; Read directory sector
        LDA DIRSEC
        STA $30
        LDA #0
        STA $31
        LDA #<DIR_BUF
        STA $32
        LDA #>DIR_BUF
        STA $33
        JSR DISK_READ
        BCC SF_DIR_OK
        JMP SF_WRITE_ERR
SF_DIR_OK:

        ; Search entries in this sector
        LDA #<DIR_BUF
        STA SYMPTR
        LDA #>DIR_BUF
        STA SYMPTR+1
        LDX #0              ; Entry counter (0-15)

SF_DIR_SEARCH:
        ; Check entry status
        LDY #0
        LDA (SYMPTR),Y

        ; Check if unused ($E5) or deleted ($00)
        CMP #$E5
        BEQ SF_FOUND_FREE
        CMP #$00
        BEQ SF_FOUND_FREE

        ; Check if active ($01) - might be same file to overwrite
        CMP #$01
        BNE SF_DIR_NEXT

        ; Active entry - compare filename to see if we should overwrite
        LDY #0
SF_CMP_NAME:
        INY                 ; Start at offset 1 (skip status)
        LDA (SYMPTR),Y
        DEY
        CMP SCRATCH,Y
        BNE SF_DIR_NEXT
        INY
        CPY #11             ; Compare all 11 chars (name + ext)
        BNE SF_CMP_NAME

        ; Found existing file with same name - overwrite it
        JMP SF_FOUND_FREE

SF_DIR_NEXT:
        ; Move to next entry (+32 bytes)
        CLC
        LDA SYMPTR
        ADC #32
        STA SYMPTR
        LDA SYMPTR+1
        ADC #0
        STA SYMPTR+1

        INX
        CPX #16             ; 16 entries per sector
        BNE SF_DIR_SEARCH

        ; Next directory sector
        INC DIRSEC
        DEC CHARTMP
        BNE SF_DIR_SECTOR

        ; No free entry found - print error
        LDA #<MSG_DIRFULL
        LDX #>MSG_DIRFULL
        JSR PRINT_STR
        SEC
        RTS

SF_FOUND_FREE:
        ; SYMPTR points to the directory entry to use
        ; DIRSEC has the directory sector number
        ; Now find free sectors for data (search bitmap)

        ; Calculate sectors needed: (FILESIZE + 511) / 512
        LDA FILESIZE+1      ; High byte
        LSR A               ; Divide by 2 (gives sectors from high byte)
        STA LOBYTE          ; Sector count
        LDA FILESIZE        ; Low byte
        BEQ SF_CHECK_ODD    ; If low=0, check if high was odd
        INC LOBYTE          ; Round up for any remainder
        JMP SF_FIND_SECTOR

SF_CHECK_ODD:
        LDA FILESIZE+1
        AND #1              ; Was high byte odd?
        BEQ SF_MIN_SEC
        INC LOBYTE
        JMP SF_FIND_SECTOR

SF_MIN_SEC:
        ; Ensure at least 1 sector
        LDA LOBYTE
        BNE SF_FIND_SECTOR
        LDA #1
        STA LOBYTE

SF_FIND_SECTOR:
        ; Find first free sector in bitmap (starting at sector 20)
        ; Read bitmap sector 4 (first bitmap sector)
        LDA #4              ; Bitmap starts at sector 4
        STA $30
        LDA #0
        STA $31
        LDA #<SCRATCH+16    ; Use scratch+16 as bitmap buffer
        STA $32
        LDA #>SCRATCH
        STA $33
        JSR DISK_READ
        BCC SF_BMP_OK
        JMP SF_WRITE_ERR
SF_BMP_OK:

        ; Search for free bit starting at sector 20
        ; Sector 20 is byte 2, bit 4 (20/8=2, 20%8=4)
        LDY #2              ; Byte index (sector 20 / 8)
        LDA #$10            ; Bit 4 mask (1 << (20 % 8))
        STA CHARTMP         ; Current bit mask

SF_BIT_LOOP:
        LDA SCRATCH+16,Y    ; Get bitmap byte
        AND CHARTMP         ; Test bit
        BEQ SF_BIT_FREE     ; Found free sector

        ; Shift mask for next sector
        ASL CHARTMP
        BNE SF_BIT_CONT
        ; Mask wrapped - next byte
        LDA #1
        STA CHARTMP
        INY
        CPY #64             ; Max 512 sectors in first bitmap sector
        BCC SF_BIT_LOOP

        ; No free sector found
        LDA #<MSG_DISKFULL
        LDX #>MSG_DISKFULL
        JSR PRINT_STR
        SEC
        RTS

SF_BIT_CONT:
        JMP SF_BIT_LOOP

SF_BIT_FREE:
        ; Calculate sector number: Y*8 + log2(CHARTMP)
        ; Y = byte index, CHARTMP = bit mask
        TYA
        ASL A
        ASL A
        ASL A               ; Y * 8
        STA FILESEC         ; Base sector

        ; Add bit position
        LDA CHARTMP
        LDX #0
SF_BIT_POS:
        LSR A
        BCS SF_GOT_SEC
        INX
        JMP SF_BIT_POS

SF_GOT_SEC:
        TXA
        CLC
        ADC FILESEC
        STA FILESEC         ; Final start sector
        LDA #0
        STA FILESEC+1

        ; Mark sectors as used in bitmap
        LDX LOBYTE          ; Sector count
        LDY #2              ; Reset to byte 2 (sector 16-23)
        ; Recalculate position
        LDA FILESEC
        LSR A
        LSR A
        LSR A               ; Byte index = sector / 8
        TAY
        LDA FILESEC
        AND #7              ; Bit position
        TAX
        LDA #1
SF_SHIFT_MASK:
        CPX #0
        BEQ SF_MARK_BITS
        ASL A
        DEX
        JMP SF_SHIFT_MASK

SF_MARK_BITS:
        STA CHARTMP         ; Bit mask for first sector
        LDX LOBYTE          ; Sector count

SF_MARK_LOOP:
        LDA SCRATCH+16,Y
        ORA CHARTMP
        STA SCRATCH+16,Y

        DEX
        BEQ SF_WRITE_BITMAP

        ; Next bit
        ASL CHARTMP
        BNE SF_MARK_LOOP
        ; Next byte
        LDA #1
        STA CHARTMP
        INY
        JMP SF_MARK_LOOP

SF_WRITE_BITMAP:
        ; Write bitmap back to disk
        LDA #4
        STA $30
        LDA #0
        STA $31
        LDA #<SCRATCH+16
        STA $32
        LDA #>SCRATCH
        STA $33
        JSR DISK_WRITE
        BCC SF_BMP_WR_OK
        JMP SF_WRITE_ERR
SF_BMP_WR_OK:

        ; Write output data to disk
        LDA FILESEC
        STA $30
        LDA FILESEC+1
        STA $31
        LDA #<OUT_BUF
        STA $32
        LDA #>OUT_BUF
        STA $33

        LDX LOBYTE          ; Sector count
SF_DATA_LOOP:
        JSR DISK_WRITE
        BCC SF_DATA_WR_OK
        JMP SF_WRITE_ERR
SF_DATA_WR_OK:

        ; Next sector
        INC $30
        BNE SF_DATA_NO_CARRY
        INC $31
SF_DATA_NO_CARRY:

        ; Advance buffer by 512 bytes
        CLC
        LDA $33
        ADC #2
        STA $33

        DEX
        BNE SF_DATA_LOOP

        ; Update directory entry
        ; SYMPTR still points to the entry
        LDY #0
        LDA #1              ; Status = active
        STA (SYMPTR),Y

        ; Copy filename (11 bytes: 8 name + 3 ext)
        LDY #0
SF_COPY_FNAME:
        LDA SCRATCH,Y
        INY
        STA (SYMPTR),Y
        CPY #11
        BNE SF_COPY_FNAME

        ; Start sector at offset $0C
        LDY #$0C
        LDA FILESEC
        STA (SYMPTR),Y
        INY
        LDA FILESEC+1
        STA (SYMPTR),Y

        ; File size at offset $0E (4 bytes)
        LDY #$0E
        LDA FILESIZE
        STA (SYMPTR),Y
        INY
        LDA FILESIZE+1
        STA (SYMPTR),Y
        INY
        LDA #0
        STA (SYMPTR),Y
        INY
        STA (SYMPTR),Y

        ; Sector count at offset $12
        LDY #$12
        LDA LOBYTE
        STA (SYMPTR),Y
        INY
        LDA #0
        STA (SYMPTR),Y

        ; Attributes at offset $14 (0 = normal file)
        LDY #$14
        LDA #0
        STA (SYMPTR),Y

        ; Parent directory at offset $15-$16 (use current directory)
        LDY #$15
        LDA CUR_DIR_LO
        STA (SYMPTR),Y
        INY
        LDA CUR_DIR_HI
        STA (SYMPTR),Y

        ; Write directory sector back
        LDA DIRSEC
        STA $30
        LDA #0
        STA $31
        LDA #<DIR_BUF
        STA $32
        LDA #>DIR_BUF
        STA $33
        JSR DISK_WRITE
        BCC SF_DIR_WR_OK
        JMP SF_WRITE_ERR
SF_DIR_WR_OK:

        ; Print "Saved"
        LDA #<MSG_SAVED
        LDX #>MSG_SAVED
        JSR PRINT_STR

        CLC
        RTS

SF_WRITE_ERR:
        LDA #<MSG_WRITEERR
        LDX #>MSG_WRITEERR
        JSR PRINT_STR
        SEC
        RTS

; File loading messages
MSG_USAGE:
        .DB "Usage: ASM <filename>", $0D, $0A, 0

MSG_LOADING:
        .DB "Loading ", 0

MSG_NOTFOUND:
        .DB "File not found", $0D, $0A, 0

MSG_READERR:
        .DB "Disk read error", $0D, $0A, 0

; File saving messages
MSG_SAVING:
        .DB "Saving ", 0

MSG_SAVED:
        .DB "Saved", $0D, $0A, 0

MSG_WRITEERR:
        .DB "Disk write error", $0D, $0A, 0

MSG_DIRFULL:
        .DB "Directory full", $0D, $0A, 0

MSG_DISKFULL:
        .DB "Disk full", $0D, $0A, 0

; End of assembler
        .DB 0

; ==============================================================================
; End of Stage 1 Assembler
; ==============================================================================
