; ==============================================================================
; WireOS Shell - Command Interpreter
; ==============================================================================
; A simple command-line shell for WireOS
;
; Commands:
;   DIR         - List directory
;   TYPE file   - Display file contents
;   DEL file    - Delete file
;   RUN file    - Execute .COM file
;   ASM file    - Assemble .ASM to .COM
;   MEM         - Show memory usage
;   HELP        - Show commands
;
; Memory Map:
;   $0000-$00FF  Zero page
;   $0100-$01FF  Stack
;   $0200-$02FF  Command buffer
;   $0300-$07FF  Shell code/data
;   $0800-$7FFF  User program area
;
; .COM Format:
;   - Loaded at $0800
;   - Entry point at $0800
;   - Raw machine code
;
; ==============================================================================

        .ORG $0300

; ------------------------------------------------------------------------------
; Constants
; ------------------------------------------------------------------------------
CMD_BUF     = $0200       ; Command buffer (256 bytes)
CMD_LEN     = $0280       ; Command length
ARG_PTR     = $0281       ; Argument pointer
PROG_AREA   = $0800       ; User program load address

; BIOS entry points
PUTCHAR     = $F000
GETCHAR     = $F040
NEWLINE     = $F080
FILE_OPEN   = $F260
FILE_READ   = $F280
FILE_CLOSE  = $F2C0
FILE_DELETE = $F2E0
DIR_LIST    = $F300
FILE_CREATE = $F320

; Zero page usage
TMPPTR      = $30
ARGC        = $32
FILESIZE    = $33

; ==============================================================================
; Entry Point
; ==============================================================================
MAIN:
        ; Print banner
        LDA #<BANNER
        STA TMPPTR
        LDA #>BANNER
        STA TMPPTR+1
        JSR PRINT_STR

CMD_LOOP:
        ; Print prompt
        LDA #<PROMPT
        STA TMPPTR
        LDA #>PROMPT
        STA TMPPTR+1
        JSR PRINT_STR

        ; Read command line
        JSR READ_LINE

        ; Parse and execute command
        JSR PARSE_CMD

        ; Loop
        JMP CMD_LOOP

; ==============================================================================
; Read Line into CMD_BUF
; ==============================================================================
READ_LINE:
        LDX #0
RL_LOOP:
        JSR GETCHAR

        ; Check for Enter
        CMP #$0D
        BEQ RL_DONE
        CMP #$0A
        BEQ RL_DONE

        ; Check for backspace
        CMP #$08
        BEQ RL_BS
        CMP #$7F
        BEQ RL_BS

        ; Store character
        STA CMD_BUF,X
        INX
        CPX #$7F            ; Max 127 chars
        BCS RL_DONE

        ; Echo character
        JSR PUTCHAR
        JMP RL_LOOP

RL_BS:
        ; Handle backspace
        CPX #0
        BEQ RL_LOOP
        DEX
        LDA #$08            ; Backspace
        JSR PUTCHAR
        LDA #$20            ; Space
        JSR PUTCHAR
        LDA #$08            ; Backspace
        JSR PUTCHAR
        JMP RL_LOOP

RL_DONE:
        LDA #0
        STA CMD_BUF,X
        STX CMD_LEN
        JSR NEWLINE
        RTS

; ==============================================================================
; Parse Command
; ==============================================================================
PARSE_CMD:
        ; Skip leading spaces
        LDX #0
PC_SKIP:
        LDA CMD_BUF,X
        CMP #$20
        BNE PC_CHECK
        INX
        JMP PC_SKIP

PC_CHECK:
        ; Empty command?
        LDA CMD_BUF,X
        BNE PC_NOTEMPTY
        RTS
PC_NOTEMPTY:

        ; Save start of command
        STX TMPPTR

        ; Get first char to dispatch
        LDA CMD_BUF,X

        ; Commands starting with D
        CMP #'D'
        BNE PC_NOT_D
        JMP PC_CHECK_D
PC_NOT_D:

        ; Commands starting with H
        CMP #'H'
        BNE PC_NOT_H
        JMP PC_CHECK_HELP
PC_NOT_H:

        ; Commands starting with M
        CMP #'M'
        BNE PC_NOT_M
        JMP PC_CHECK_MEM
PC_NOT_M:

        ; Commands starting with T
        CMP #'T'
        BNE PC_NOT_T
        JMP PC_CHECK_TYPE
PC_NOT_T:

        ; Commands starting with R
        CMP #'R'
        BNE PC_UNKNOWN
        JMP PC_CHECK_RUN

PC_UNKNOWN:
        ; Unknown command
        LDA #<ERR_CMD
        STA TMPPTR
        LDA #>ERR_CMD
        STA TMPPTR+1
        JSR PRINT_STR
        RTS

; --- D commands: DIR, DEL ---
PC_CHECK_D:
        LDA CMD_BUF+1,X
        CMP #'I'
        BEQ PC_CHECK_DIR
        CMP #'E'
        BEQ PC_CHECK_DEL
        JMP PC_UNKNOWN

PC_CHECK_DIR:
        LDA CMD_BUF+2,X
        CMP #'R'
        BNE PC_UNK
        JMP CMD_DIR

PC_CHECK_DEL:
        LDA CMD_BUF+2,X
        CMP #'L'
        BNE PC_UNK
        JSR GET_ARG
        JMP CMD_DEL

PC_UNK:
        JMP PC_UNKNOWN

; --- HELP ---
PC_CHECK_HELP:
        LDA CMD_BUF+1,X
        CMP #'E'
        BNE PC_UNK
        LDA CMD_BUF+2,X
        CMP #'L'
        BNE PC_UNK
        LDA CMD_BUF+3,X
        CMP #'P'
        BNE PC_UNK
        JMP CMD_HELP

; --- MEM ---
PC_CHECK_MEM:
        LDA CMD_BUF+1,X
        CMP #'E'
        BNE PC_UNK
        LDA CMD_BUF+2,X
        CMP #'M'
        BNE PC_UNK
        JMP CMD_MEM

; --- TYPE ---
PC_CHECK_TYPE:
        LDA CMD_BUF+1,X
        CMP #'Y'
        BNE PC_UNK
        LDA CMD_BUF+2,X
        CMP #'P'
        BNE PC_UNK
        LDA CMD_BUF+3,X
        CMP #'E'
        BNE PC_UNK
        JSR GET_ARG
        JMP CMD_TYPE

; --- RUN ---
PC_CHECK_RUN:
        LDA CMD_BUF+1,X
        CMP #'U'
        BNE PC_UNK
        LDA CMD_BUF+2,X
        CMP #'N'
        BNE PC_UNK
        JSR GET_ARG
        JMP CMD_RUN

; ==============================================================================
; Get Argument - Skip to first argument after command
; ==============================================================================
GET_ARG:
        ; Skip command
GA_SKIP_CMD:
        LDA CMD_BUF,X
        BEQ GA_DONE
        CMP #$20
        BEQ GA_SKIP_SPACE
        INX
        JMP GA_SKIP_CMD

        ; Skip spaces
GA_SKIP_SPACE:
        INX
        LDA CMD_BUF,X
        CMP #$20
        BEQ GA_SKIP_SPACE

GA_DONE:
        STX ARG_PTR
        RTS

; ==============================================================================
; DIR Command - List directory
; ==============================================================================
CMD_DIR:
        ; Print header
        LDA #<MSG_DIR
        STA TMPPTR
        LDA #>MSG_DIR
        STA TMPPTR+1
        JSR PRINT_STR

        ; Call BIOS directory list
        JSR DIR_LIST
        RTS

; ==============================================================================
; HELP Command - Show available commands
; ==============================================================================
CMD_HELP:
        LDA #<MSG_HELP
        STA TMPPTR
        LDA #>MSG_HELP
        STA TMPPTR+1
        JSR PRINT_STR
        RTS

; ==============================================================================
; MEM Command - Show memory usage
; ==============================================================================
CMD_MEM:
        LDA #<MSG_MEM
        STA TMPPTR
        LDA #>MSG_MEM
        STA TMPPTR+1
        JSR PRINT_STR

        ; Show free memory: $0800-$7FFF = 30KB
        LDA #<MSG_FREE
        STA TMPPTR
        LDA #>MSG_FREE
        STA TMPPTR+1
        JSR PRINT_STR
        RTS

; ==============================================================================
; TYPE Command - Display file contents
; ==============================================================================
CMD_TYPE:
        ; Check for argument
        LDX ARG_PTR
        LDA CMD_BUF,X
        BNE TY_OPEN

        ; No argument
        LDA #<ERR_NOARG
        STA TMPPTR
        LDA #>ERR_NOARG
        STA TMPPTR+1
        JSR PRINT_STR
        RTS

TY_OPEN:
        ; Open file (filename at CMD_BUF+ARG_PTR)
        LDA ARG_PTR
        CLC
        ADC #<CMD_BUF
        TAX
        LDA #0
        ADC #>CMD_BUF
        TAY
        JSR FILE_OPEN
        BCC TY_READ

        ; File not found
        LDA #<ERR_NOTFOUND
        STA TMPPTR
        LDA #>ERR_NOTFOUND
        STA TMPPTR+1
        JSR PRINT_STR
        RTS

TY_READ:
        ; Read and print file
        STA TMPPTR          ; Save handle

TY_LOOP:
        ; Read one byte
        LDA TMPPTR
        JSR FILE_READ
        BCS TY_CLOSE        ; EOF or error

        ; Print character
        JSR PUTCHAR
        JMP TY_LOOP

TY_CLOSE:
        LDA TMPPTR
        JSR FILE_CLOSE
        JSR NEWLINE
        RTS

; ==============================================================================
; DEL Command - Delete file
; ==============================================================================
CMD_DEL:
        ; Check for argument
        LDX ARG_PTR
        LDA CMD_BUF,X
        BNE DL_DELETE

        ; No argument
        LDA #<ERR_NOARG
        STA TMPPTR
        LDA #>ERR_NOARG
        STA TMPPTR+1
        JSR PRINT_STR
        RTS

DL_DELETE:
        ; Delete file
        LDA ARG_PTR
        CLC
        ADC #<CMD_BUF
        TAX
        LDA #0
        ADC #>CMD_BUF
        TAY
        JSR FILE_DELETE
        BCC DL_OK

        ; Error
        LDA #<ERR_NOTFOUND
        STA TMPPTR
        LDA #>ERR_NOTFOUND
        STA TMPPTR+1
        JSR PRINT_STR
        RTS

DL_OK:
        LDA #<MSG_DELETED
        STA TMPPTR
        LDA #>MSG_DELETED
        STA TMPPTR+1
        JSR PRINT_STR
        RTS

; ==============================================================================
; RUN Command - Execute .COM file
; ==============================================================================
CMD_RUN:
        ; Check for argument
        LDX ARG_PTR
        LDA CMD_BUF,X
        BNE RN_OPEN

        ; No argument
        LDA #<ERR_NOARG
        STA TMPPTR
        LDA #>ERR_NOARG
        STA TMPPTR+1
        JSR PRINT_STR
        RTS

RN_OPEN:
        ; Open file
        LDA ARG_PTR
        CLC
        ADC #<CMD_BUF
        TAX
        LDA #0
        ADC #>CMD_BUF
        TAY
        JSR FILE_OPEN
        BCC RN_LOAD

        ; File not found
        LDA #<ERR_NOTFOUND
        STA TMPPTR
        LDA #>ERR_NOTFOUND
        STA TMPPTR+1
        JSR PRINT_STR
        RTS

RN_LOAD:
        ; Load file at $0800
        STA TMPPTR          ; Save handle
        LDA #<PROG_AREA
        STA TMPPTR+1
        LDA #>PROG_AREA
        STA ARGC            ; Using ARGC as high byte

RN_LOOP:
        ; Read one byte
        LDA TMPPTR
        JSR FILE_READ
        BCS RN_EXEC         ; EOF

        ; Store at load address
        LDY #0
        STA (TMPPTR+1),Y

        ; Increment address
        INC TMPPTR+1
        BNE RN_LOOP
        INC ARGC
        JMP RN_LOOP

RN_EXEC:
        ; Close file
        LDA TMPPTR
        JSR FILE_CLOSE

        ; Execute program
        JSR PROG_AREA

        JSR NEWLINE
        RTS

; ==============================================================================
; Print String (null-terminated, pointer in TMPPTR)
; ==============================================================================
PRINT_STR:
        LDY #0
PS_LOOP:
        LDA (TMPPTR),Y
        BEQ PS_DONE
        JSR PUTCHAR
        INY
        BNE PS_LOOP
PS_DONE:
        RTS

; ==============================================================================
; String Constants
; ==============================================================================
BANNER:
        .DB $0D, $0A
        .DB "WireOS v1.0", $0D, $0A
        .DB "============", $0D, $0A
        .DB "Type HELP for commands", $0D, $0A, $0D, $0A, 0

PROMPT:
        .DB "A>", 0

MSG_DIR:
        .DB "Directory:", $0D, $0A, 0

MSG_HELP:
        .DB $0D, $0A
        .DB "Commands:", $0D, $0A
        .DB "  DIR         List files", $0D, $0A
        .DB "  TYPE file   Show file", $0D, $0A
        .DB "  DEL file    Delete file", $0D, $0A
        .DB "  RUN file    Run program", $0D, $0A
        .DB "  MEM         Memory info", $0D, $0A
        .DB "  HELP        This message", $0D, $0A
        .DB $0D, $0A, 0

MSG_MEM:
        .DB "Memory Map:", $0D, $0A
        .DB "  $0000-$02FF  System", $0D, $0A
        .DB "  $0300-$07FF  Shell", $0D, $0A
        .DB "  $0800-$7FFF  User", $0D, $0A, 0

MSG_FREE:
        .DB "Free: 30KB", $0D, $0A, 0

MSG_DELETED:
        .DB "File deleted", $0D, $0A, 0

ERR_CMD:
        .DB "Unknown command", $0D, $0A, 0

ERR_NOARG:
        .DB "Missing argument", $0D, $0A, 0

ERR_NOTFOUND:
        .DB "File not found", $0D, $0A, 0

; ==============================================================================
; End of Shell
; ==============================================================================
