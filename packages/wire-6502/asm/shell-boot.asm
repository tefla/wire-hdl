; ============================================================
; WireOS Shell - $0800
; ============================================================
; A simple command shell using BIOS routines.
; PUTCHAR=$F000, GETCHAR=$F040, NEWLINE=$F080
; DISK_READ=$F200
;
; Commands:
;   HELP      - Show available commands
;   VER       - Show version
;   HEX       - Jump to hex loader
;   MEM       - Show memory info
;   DIR       - List files on disk
;   TYPE file - Display file contents
;   DEL file  - Delete file
;   CD dir    - Change directory
;   RUN file  - Load and run .COM file
;   INSTALL   - Install from floppy to HDD
;   (or just type filename to run it)
;
; Disk layout (WireFS standard):
;   Sector 0:     Boot sector
;   Sectors 1-3:  Directory (48 entries)
;   Sectors 4-19: Allocation bitmap
;   Sectors 20+:  File data
;
; Memory usage:
;   $02: Command length
;   $03: Argument pointer (offset into cmd buffer)
;   $0300-$033F: Command buffer (64 bytes)
;   $0400-$05FF: Disk buffer (512 bytes)
;   $30-$33: BIOS disk params (sector, buffer addr)
; ============================================================

.ORG $7000

; ============================================================
; Constants
; ============================================================
DIR_START  = $01            ; First directory sector (WireFS standard)
DIR_SECTS  = $03            ; Number of directory sectors
ENV_BASE   = $0200          ; Environment block for current path
ENV_LEN    = ENV_BASE       ; Byte: length of current path
ENV_PATH   = ENV_BASE+1     ; Path storage (max 63 chars)
ENV_MAX    = 63
CUR_DIR_LO = $0240          ; Current directory entry index (low byte)
CUR_DIR_HI = $0241          ; Current directory entry index (high byte, $FF for root)
CMD_LEN    = $02            ; Command length (zero page)
ARG_PTR    = $03            ; Argument pointer (zero page)

; ============================================================
; Entry point
; ============================================================
SHELL_START:
    ; Print welcome banner
    JSR PRINT_BANNER
    JSR INIT_ENV

; Main command loop
MAIN_LOOP:
    JSR PRINT_PROMPT    ; Print "A>"
    JSR READ_LINE       ; Read command into buffer at $0300
    JSR PARSE_CMD       ; Parse and execute
    JMP MAIN_LOOP

; ============================================================
; PRINT_BANNER - Print welcome message
; ============================================================
PRINT_BANNER:
    ; "WireOS v1" + newline
    LDA #$57            ; 'W'
    JSR $F000
    LDA #$69            ; 'i'
    JSR $F000
    LDA #$72            ; 'r'
    JSR $F000
    LDA #$65            ; 'e'
    JSR $F000
    LDA #$4F            ; 'O'
    JSR $F000
    LDA #$53            ; 'S'
    JSR $F000
    LDA #$20            ; ' '
    JSR $F000
    LDA #$76            ; 'v'
    JSR $F000
    LDA #$31            ; '1'
    JSR $F000
    JSR $F080           ; NEWLINE
    RTS

; ============================================================
; INIT_ENV - Ensure env path is initialized
; ============================================================
INIT_ENV:
    LDA ENV_LEN
    CMP #$01
    BCC IE_SETROOT
    CMP #ENV_MAX
    BCC IE_DONE
IE_SETROOT:
    LDA #$01
    STA ENV_LEN
    LDA #'/'
    STA ENV_PATH
    ; Set current directory to root ($FFFF)
    LDA #$FF
    STA CUR_DIR_LO
    STA CUR_DIR_HI
IE_DONE:
    RTS

; PRINT_PROMPT - Print "<path> > "
; ============================================================
PRINT_PROMPT:
    LDY ENV_LEN
    BEQ PP_ROOT
    LDX #$00
PP_LOOP:
    LDA ENV_PATH,X
    JSR $F000
    INX
    DEY
    BNE PP_LOOP
    JMP PP_ARROW

PP_ROOT:
    LDA #'/'
    JSR $F000

PP_ARROW:
    LDA #$3E            ; '>'
    JSR $F000
    LDA #$20            ; ' '
    JSR $F000
    RTS

; ============================================================
; READ_LINE - Read input into buffer at $0300
; Returns: X = length
; ============================================================
READ_LINE:
    LDX #$00            ; Buffer index
RL_LOOP:
    JSR $F040           ; GETCHAR
    CMP #$0D            ; Enter?
    BEQ RL_DONE
    CMP #$08            ; Backspace?
    BEQ RL_BS
    CPX #$3F            ; Buffer full (63 chars)?
    BEQ RL_LOOP
    ; Store character (uppercase if lowercase)
    CMP #$61            ; >= 'a'?
    BCC RL_STORE
    CMP #$7B            ; <= 'z'?
    BCS RL_STORE
    AND #$DF            ; Convert to uppercase
RL_STORE:
    STA $0300,X         ; Store in buffer
    INX
    JSR $F000           ; Echo
    JMP RL_LOOP
RL_BS:
    CPX #$00            ; At start?
    BEQ RL_LOOP
    DEX
    LDA #$08            ; Backspace
    JSR $F000
    LDA #$20            ; Space
    JSR $F000
    LDA #$08            ; Backspace
    JSR $F000
    JMP RL_LOOP
RL_DONE:
    LDA #$00
    STA $0300,X         ; Null terminate
    STX $02             ; Save length
    JSR $F080           ; NEWLINE
    RTS

; ============================================================
; PARSE_CMD - Parse and execute command
; ============================================================
; Uses first character as quick dispatch to reduce branch distance
PARSE_CMD:
    LDA CMD_LEN         ; Get length
    BEQ PC_DONE         ; Empty line

    ; Quick dispatch on first character using jumps to avoid range issues
    LDA $0300           ; First char
    CMP #$43            ; 'C' (CD)
    BEQ PC_C_CMD
    CMP #$44            ; 'D' (DIR or DEL)
    BEQ PC_D_CMD
    CMP #$48            ; 'H' (HELP or HEX)
    BEQ PC_H_JMP
    CMP #$49            ; 'I' (INSTALL)
    BEQ PC_I_JMP
    CMP #$4D            ; 'M' (MEM)
    BEQ PC_M_JMP
    JMP PC_MORE         ; Continue checking (trampoline)

; Trampolines for far command handlers
PC_H_JMP:
    JMP PC_H_CMD
PC_I_JMP:
    JMP PC_I_CMD
PC_M_JMP:
    JMP PC_M_CMD

PC_DONE:
    RTS

PC_C_CMD:
    ; Check "CD"
    LDA $0301
    CMP #$44            ; 'D'
    BNE PC_TRY_RUN_C
    LDA $0302
    CMP #$20            ; Space (CD takes arg)
    BEQ PC_DO_CD
    CMP #$00            ; Or end of string
    BNE PC_TRY_RUN_C
PC_DO_CD:
    JSR GET_ARG
    JMP CMD_CD
PC_TRY_RUN_C:
    JMP CMD_RUN

PC_D_CMD:
    ; Check "DIR" or "DEL"
    LDA $0301
    CMP #$49            ; 'I' (DIR)
    BEQ PC_CHECK_DIR
    CMP #$45            ; 'E' (DEL)
    BEQ PC_CHECK_DEL
    JMP CMD_RUN
PC_CHECK_DIR:
    LDA $0302
    CMP #$52            ; 'R'
    BNE PC_TRY_RUN2
    JMP CMD_DIR
PC_CHECK_DEL:
    LDA $0302
    CMP #$4C            ; 'L'
    BNE PC_TRY_RUN2
    JSR GET_ARG
    JMP CMD_DEL
PC_TRY_RUN2:
    JMP CMD_RUN

PC_I_CMD:
    ; Check "INSTALL" (must match full command)
    LDA $0301
    CMP #$4E            ; 'N'
    BNE PC_TRY_RUN6
    LDA $0302
    CMP #$53            ; 'S'
    BNE PC_TRY_RUN6
    LDA $0303
    CMP #$54            ; 'T'
    BNE PC_TRY_RUN6
    LDA $0304
    CMP #$41            ; 'A'
    BNE PC_TRY_RUN6
    LDA $0305
    CMP #$4C            ; 'L'
    BNE PC_TRY_RUN6
    LDA $0306
    CMP #$4C            ; 'L'
    BNE PC_TRY_RUN6
    JMP CMD_INSTALL
PC_TRY_RUN6:
    JMP CMD_RUN

PC_M_CMD:
    ; Check "MEM"
    LDA $0301
    CMP #$45            ; 'E'
    BNE PC_TRY_RUN4
    LDA $0302
    CMP #$4D            ; 'M'
    BNE PC_TRY_RUN4
    JMP CMD_MEM
PC_TRY_RUN4:
    JMP CMD_RUN

PC_H_CMD:
    ; Check "HELP" or "HEX"
    LDA $0301
    CMP #$45            ; 'E'
    BNE PC_TRY_RUN3
    LDA $0302
    CMP #$4C            ; 'L' (HELP)
    BEQ PC_HELP_CHK
    CMP #$58            ; 'X' (HEX)
    BNE PC_TRY_RUN3
    JMP CMD_HEX
PC_HELP_CHK:
    LDA $0303
    CMP #$50            ; 'P'
    BNE PC_TRY_RUN3
    JMP CMD_HELP
PC_TRY_RUN3:
    JMP CMD_RUN

; Additional commands (trampoline target)
PC_MORE:
    LDA $0300           ; First char
    CMP #$52            ; 'R' (RUN)
    BEQ PC_R_CMD
    CMP #$54            ; 'T' (TYPE)
    BEQ PC_T_CMD
    CMP #$56            ; 'V' (VER)
    BEQ PC_V_CMD
    JMP CMD_RUN         ; Default: try as filename

PC_R_CMD:
    ; Check "RUN"
    LDA $0301
    CMP #$55            ; 'U'
    BNE PC_TRY_RUN_R
    LDA $0302
    CMP #$4E            ; 'N'
    BNE PC_TRY_RUN_R
    JSR GET_ARG
    JMP CMD_RUN_ARG
PC_TRY_RUN_R:
    JMP CMD_RUN

PC_T_CMD:
    ; Check "TYPE"
    LDA $0301
    CMP #$59            ; 'Y'
    BNE PC_TRY_RUN_T
    LDA $0302
    CMP #$50            ; 'P'
    BNE PC_TRY_RUN_T
    LDA $0303
    CMP #$45            ; 'E'
    BNE PC_TRY_RUN_T
    JSR GET_ARG
    JMP CMD_TYPE
PC_TRY_RUN_T:
    JMP CMD_RUN

PC_V_CMD:
    ; Check "VER"
    LDA $0301
    CMP #$45            ; 'E'
    BNE PC_TRY_RUN5
    LDA $0302
    CMP #$52            ; 'R'
    BNE PC_TRY_RUN5
    JMP CMD_VER
PC_TRY_RUN5:
    JMP CMD_RUN

; ============================================================
; CMD_HELP - Show help
; ============================================================
CMD_HELP:
    ; Print help using string table for compactness
    LDA #<HELP_TEXT
    STA $34
    LDA #>HELP_TEXT
    STA $35
    LDY #$00
HELP_LOOP:
    LDA ($34),Y
    BEQ HELP_DONE
    CMP #$0A
    BEQ HELP_NL
    JSR $F000
    INY
    BNE HELP_LOOP
    INC $35
    JMP HELP_LOOP
HELP_NL:
    JSR $F080
    INY
    BNE HELP_LOOP
    INC $35
    JMP HELP_LOOP
HELP_DONE:
    RTS

HELP_TEXT:
    .DB "Commands:", $0A
    .DB " DIR        List files", $0A
    .DB " TYPE file  Show file", $0A
    .DB " DEL file   Delete file", $0A
    .DB " RUN file   Run program", $0A
    .DB " CD dir     Change dir", $0A
    .DB " INSTALL    Install OS", $0A
    .DB " HELP VER MEM HEX", $0A, $00

; ============================================================
; CMD_VER - Show version
; ============================================================
CMD_VER:
    ; "WireOS v1.0"
    LDA #$57            ; 'W'
    JSR $F000
    LDA #$69            ; 'i'
    JSR $F000
    LDA #$72            ; 'r'
    JSR $F000
    LDA #$65            ; 'e'
    JSR $F000
    LDA #$4F            ; 'O'
    JSR $F000
    LDA #$53            ; 'S'
    JSR $F000
    LDA #$20            ; ' '
    JSR $F000
    LDA #$76            ; 'v'
    JSR $F000
    LDA #$31            ; '1'
    JSR $F000
    LDA #$2E            ; '.'
    JSR $F000
    LDA #$30            ; '0'
    JSR $F000
    JSR $F080
    RTS

; ============================================================
; CMD_HEX - Jump to hex loader
; ============================================================
CMD_HEX:
    JMP $F800           ; Jump to hex loader

; ============================================================
; CMD_MEM - Show memory info
; ============================================================
CMD_MEM:
    ; "RAM: 32K  ROM: 16K"
    LDA #$52            ; 'R'
    JSR $F000
    LDA #$41            ; 'A'
    JSR $F000
    LDA #$4D            ; 'M'
    JSR $F000
    LDA #$3A            ; ':'
    JSR $F000
    LDA #$20
    JSR $F000
    LDA #$33            ; '3'
    JSR $F000
    LDA #$32            ; '2'
    JSR $F000
    LDA #$4B            ; 'K'
    JSR $F000
    LDA #$20
    JSR $F000
    LDA #$20
    JSR $F000
    LDA #$52            ; 'R'
    JSR $F000
    LDA #$4F            ; 'O'
    JSR $F000
    LDA #$4D            ; 'M'
    JSR $F000
    LDA #$3A            ; ':'
    JSR $F000
    LDA #$20
    JSR $F000
    LDA #$31            ; '1'
    JSR $F000
    LDA #$36            ; '6'
    JSR $F000
    LDA #$4B            ; 'K'
    JSR $F000
    JSR $F080
    RTS

; ============================================================
; CMD_DIR - List directory
; ============================================================
; Reads directory sectors (2-4) and prints active files
; Directory entry: 32 bytes
;   $00: Status ($00=deleted, $E5=unused, $01=active)
;   $01-$08: Filename (8 chars)
;   $09-$0B: Extension (3 chars)
;   $0C-$0D: Start sector
;   $0E-$0F: File size
; ============================================================
CMD_DIR:
    ; Read each directory sector into buffer at $0400
    LDA #DIR_START      ; Current sector
    STA $38
    LDA #DIR_SECTS
    STA $39             ; Remaining sectors

DIR_SECTOR:
    LDA $38             ; Sector low
    STA $30
    LDA #$00
    STA $31
    LDA #$00            ; Buffer at $0400
    STA $32
    LDA #$04
    STA $33
    JSR $F200           ; DISK_READ
    BCS DIR_ERR         ; Error?

    ; Process 16 entries (512 / 32 = 16 per sector)
    LDX #$00            ; Entry index (0-15)
    LDA #$00
    STA $34             ; Buffer offset low
    LDA #$04
    STA $35             ; Buffer offset high ($0400)

DIR_LOOP:
    ; Check entry status at offset $00
    LDY #$00
    LDA ($34),Y         ; Load status byte
    CMP #$01            ; Active?
    BNE DIR_NEXT

    ; Check parent index at offset $15-$16 matches current directory
    LDY #$15
    LDA ($34),Y         ; Parent index low
    CMP CUR_DIR_LO
    BNE DIR_NEXT
    INY
    LDA ($34),Y         ; Parent index high
    CMP CUR_DIR_HI
    BNE DIR_NEXT

    ; Print filename (8 chars at offset $01)
    LDY #$01
DIR_NAME:
    LDA ($34),Y
    CMP #$20            ; Stop at space
    BEQ DIR_DOT
    JSR $F000           ; PUTCHAR
    INY
    CPY #$09            ; Max 8 chars
    BNE DIR_NAME

DIR_DOT:
    ; Print "."
    LDA #$2E            ; '.'
    JSR $F000

    ; Print extension (3 chars at offset $09)
    LDY #$09
DIR_EXT:
    LDA ($34),Y
    CMP #$20            ; Stop at space
    BEQ DIR_SIZE
    JSR $F000           ; PUTCHAR
    INY
    CPY #$0C            ; Max 3 chars
    BNE DIR_EXT

DIR_SIZE:
    ; Print some spaces
    LDA #$20
    JSR $F000
    LDA #$20
    JSR $F000

    ; Print file size (2 bytes at offset $0E-$0F)
    ; Just print the low byte as hex for now
    LDY #$0E
    LDA ($34),Y
    JSR PRINT_HEX

    JSR $F080           ; NEWLINE

DIR_NEXT:
    ; Move to next entry (+32 bytes)
    CLC
    LDA $34
    ADC #$20
    STA $34
    LDA $35
    ADC #$00
    STA $35

    INX
    CPX #$10            ; 16 entries per sector
    BNE DIR_LOOP

    ; Next directory sector
    INC $38
    DEC $39
    BEQ DIR_DONE
    JMP DIR_SECTOR

DIR_DONE:
    RTS

DIR_ERR:
    ; Print "Disk error"
    LDA #$45            ; 'E'
    JSR $F000
    LDA #$52            ; 'R'
    JSR $F000
    LDA #$52            ; 'R'
    JSR $F000
    JSR $F080
    RTS

; ============================================================
; PRINT_HEX - Print A as 2 hex digits
; ============================================================
PRINT_HEX:
    PHA                 ; Save value
    LSR A
    LSR A
    LSR A
    LSR A               ; High nibble
    JSR PRINT_NIBBLE
    PLA                 ; Restore value
    AND #$0F            ; Low nibble
    JMP PRINT_NIBBLE

PRINT_NIBBLE:
    CMP #$0A
    BCC PN_DIGIT
    ADC #$06            ; Adjust for A-F (carry is set)
PN_DIGIT:
    ADC #$30            ; Convert to ASCII
    JMP $F000           ; PUTCHAR and return

; ============================================================
; GET_ARG - Skip command and find first argument
; ============================================================
; Input: Command in $0300
; Output: ARG_PTR = offset to first argument character
;         If no argument, points to null terminator
; ============================================================
GET_ARG:
    LDX #$00
    ; Skip command word (non-space characters)
GA_SKIP_CMD:
    LDA $0300,X
    BEQ GA_DONE         ; End of string
    CMP #$20            ; Space?
    BEQ GA_SKIP_SPACE
    INX
    JMP GA_SKIP_CMD
    ; Skip spaces between command and argument
GA_SKIP_SPACE:
    INX
    LDA $0300,X
    CMP #$20            ; Still space?
    BEQ GA_SKIP_SPACE
GA_DONE:
    STX ARG_PTR
    RTS

; ============================================================
; CMD_TYPE - Display file contents
; ============================================================
; Reads file and prints each byte as character
; ============================================================
CMD_TYPE:
    ; Check for argument
    LDX ARG_PTR
    LDA $0300,X
    BNE TYPE_FIND
    ; No argument - print error
    JSR PRINT_NOARG
    RTS

TYPE_FIND:
    ; Search directory for file (reuse RUN's search logic)
    ; Store pointer to argument filename
    LDA #DIR_START
    STA $38             ; Current sector
    LDA #DIR_SECTS
    STA $39             ; Remaining sectors

TYPE_SECTOR:
    LDA $38
    STA $30
    LDA #$00
    STA $31
    LDA #$00
    STA $32
    LDA #$04
    STA $33
    JSR $F200           ; DISK_READ
    BCC TYPE_OK1
    JMP TYPE_NOTFOUND
TYPE_OK1:

    LDX #$00
    LDA #$00
    STA $34
    LDA #$04
    STA $35

TYPE_SEARCH:
    ; Check if entry is active
    LDY #$00
    LDA ($34),Y
    CMP #$01
    BEQ TYPE_ACTIVE
    JMP TYPE_NEXT_ENTRY
TYPE_ACTIVE:

    ; Compare filename with argument
    LDX ARG_PTR
    LDY #$00
TYPE_CMP:
    LDA $0300,X         ; Arg char
    BEQ TYPE_CMP_END    ; End of arg
    CMP #$2E            ; '.'
    BEQ TYPE_CMP_END
    CMP #$20            ; Space ends filename
    BEQ TYPE_CMP_END

    ; Get filename char at offset Y+1
    STY $3C             ; Use $3C for temp (not $36 which holds size!)
    TYA
    CLC
    ADC #$01
    TAY
    LDA ($34),Y
    LDY $3C

    ; Compare (case insensitive already uppercase)
    CMP $0300,X
    BEQ TYPE_CMP_MATCH
    JMP TYPE_NEXT_ENTRY
TYPE_CMP_MATCH:

    INX
    INY
    CPY #$08
    BNE TYPE_CMP

TYPE_CMP_END:
    ; Found! Get start sector
    LDY #$0C
    LDA ($34),Y
    STA $30
    INY
    LDA ($34),Y
    STA $31

    ; Get file size and save to $E0-$E1 (safe unused location)
    LDY #$0E
    LDA ($34),Y
    STA $E0             ; Size low
    INY
    LDA ($34),Y
    STA $E1             ; Size high

    ; Load file to $0600 (temp buffer)
    LDA #$00
    STA $32
    LDA #$06
    STA $33
    JSR $F200           ; DISK_READ
    BCC TYPE_OK2
    JMP TYPE_NOTFOUND
TYPE_OK2:
    ; Print file contents
    ; $E0-$E1 = file size
    ; $E2-$E3 = byte counter (counts up to size)
    ; $E4-$E5 = buffer pointer (starts at $0600)
    LDA #$00
    STA $E2             ; Counter low = 0
    STA $E3             ; Counter high = 0
    STA $E4             ; Buffer ptr low = $00
    LDA #$06
    STA $E5             ; Buffer ptr high = $06 -> pointer to $0600
    LDY #$00            ; Y always 0 for indirect indexed

TYPE_PRINT:
    ; Check if we've printed enough bytes
    ; Compare counter ($E2-$E3) with size ($E0-$E1)
    LDA $E3             ; Counter high
    CMP $E1             ; Size high
    BCC TYPE_DO_PRINT   ; Counter high < size high, continue
    BNE TYPE_DONE       ; Counter high > size high, done
    ; High bytes equal, check low bytes
    LDA $E2             ; Counter low
    CMP $E0             ; Size low
    BCS TYPE_DONE       ; Counter low >= size low, done

TYPE_DO_PRINT:
    LDA ($E4),Y         ; Load byte via pointer (Y=0)
    BEQ TYPE_DONE       ; Null = end
    CMP #$0A            ; LF
    BEQ TYPE_NL
    CMP #$0D            ; CR
    BEQ TYPE_NL
    JSR $F000           ; PUTCHAR
    JMP TYPE_NEXT_CHAR
TYPE_NL:
    JSR $F080           ; NEWLINE
TYPE_NEXT_CHAR:
    ; Increment 16-bit buffer pointer
    INC $E4
    BNE TYPE_INC_CNT
    INC $E5             ; Carry to high byte
TYPE_INC_CNT:
    ; Increment 16-bit counter
    INC $E2
    BNE TYPE_PRINT
    INC $E3
    JMP TYPE_PRINT

TYPE_DONE:
    JSR $F080           ; Final newline
    RTS

TYPE_NEXT_ENTRY:
    CLC
    LDA $34
    ADC #$20
    STA $34
    LDA $35
    ADC #$00
    STA $35
    INX
    CPX #$10
    BEQ TYPE_NEXT_SECTOR
    JMP TYPE_SEARCH

TYPE_NEXT_SECTOR:
    INC $38
    DEC $39
    BNE TYPE_CONT_SECTOR
    JMP TYPE_NOTFOUND
TYPE_CONT_SECTOR:
    JMP TYPE_SECTOR

TYPE_NOTFOUND:
    JSR PRINT_NOTFOUND
    RTS

; ============================================================
; CMD_DEL - Delete a file
; ============================================================
; Marks directory entry as deleted
; ============================================================
CMD_DEL:
    ; Check for argument
    LDX ARG_PTR
    LDA $0300,X
    BNE DEL_FIND
    JSR PRINT_NOARG
    RTS

DEL_FIND:
    ; Search directory for file
    LDA #DIR_START
    STA $38
    LDA #DIR_SECTS
    STA $39

DEL_SECTOR:
    LDA $38
    STA $30
    LDA #$00
    STA $31
    LDA #$00
    STA $32
    LDA #$04
    STA $33
    JSR $F200           ; DISK_READ
    BCC DEL_OK1
    JMP DEL_NOTFOUND
DEL_OK1:

    LDX #$00
    LDA #$00
    STA $34
    LDA #$04
    STA $35

DEL_SEARCH:
    LDY #$00
    LDA ($34),Y
    CMP #$01
    BNE DEL_NEXT_ENTRY

    ; Compare filename
    LDX ARG_PTR
    LDY #$00
DEL_CMP:
    LDA $0300,X
    BEQ DEL_CMP_END
    CMP #$2E
    BEQ DEL_CMP_END
    CMP #$20
    BEQ DEL_CMP_END

    STY $36
    TYA
    CLC
    ADC #$01
    TAY
    LDA ($34),Y
    LDY $36

    CMP $0300,X
    BNE DEL_NEXT_ENTRY

    INX
    INY
    CPY #$08
    BNE DEL_CMP

DEL_CMP_END:
    ; Found! Mark as deleted (status = $00)
    LDY #$00
    LDA #$00
    STA ($34),Y

    ; Write sector back to disk (DISK_WRITE)
    LDA $38
    STA $8022           ; DISK_SEC_LO
    LDA #$00
    STA $8023           ; DISK_SEC_HI
    LDA #$00
    STA $8024           ; DISK_BUF_LO ($0400)
    LDA #$04
    STA $8025           ; DISK_BUF_HI
    LDA #$01
    STA $8026           ; DISK_COUNT
    LDA #$02
    STA $8021           ; DISK_CMD = WRITE

DEL_WAIT:
    LDA $8020           ; DISK_STATUS
    AND #$02            ; Busy?
    BNE DEL_WAIT

    ; Print "Deleted"
    LDA #$44            ; 'D'
    JSR $F000
    LDA #$65            ; 'e'
    JSR $F000
    LDA #$6C            ; 'l'
    JSR $F000
    LDA #$65            ; 'e'
    JSR $F000
    LDA #$74            ; 't'
    JSR $F000
    LDA #$65            ; 'e'
    JSR $F000
    LDA #$64            ; 'd'
    JSR $F000
    JSR $F080
    RTS

DEL_NEXT_ENTRY:
    CLC
    LDA $34
    ADC #$20
    STA $34
    LDA $35
    ADC #$00
    STA $35
    INX
    CPX #$10
    BEQ DEL_NEXT_SECTOR
    JMP DEL_SEARCH

DEL_NEXT_SECTOR:
    INC $38
    DEC $39
    BNE DEL_CONT_SECTOR
    JMP DEL_NOTFOUND
DEL_CONT_SECTOR:
    JMP DEL_SECTOR

DEL_NOTFOUND:
    JSR PRINT_NOTFOUND
    RTS

; ============================================================
; CMD_CD - Change directory
; ============================================================
; Updates ENV_PATH with new directory and CUR_DIR index
; ============================================================
CMD_CD:
    LDX ARG_PTR
    LDA $0300,X
    BNE CD_DO
    ; No arg - go to root
    JMP CD_GO_ROOT

CD_DO:
    ; Check for ".." (parent)
    LDA $0300,X
    CMP #$2E            ; '.'
    BNE CD_SEARCH
    LDA $0301,X
    CMP #$2E            ; '.'
    BNE CD_SEARCH
    ; Go up one level - need to find parent of current directory
    LDA CUR_DIR_HI
    CMP #$FF
    BNE CD_FIND_PARENT
    ; Already at root
    RTS

CD_FIND_PARENT:
    ; Read current directory's entry to get its parent
    ; Entry index = CUR_DIR_LO + CUR_DIR_HI*256
    ; Sector = CUR_DIR / 16 + 1, Offset = (CUR_DIR % 16) * 32
    JSR CD_LOAD_CUR_ENTRY
    ; Parent index is at offset $15-$16
    LDY #$15
    LDA ($34),Y
    STA CUR_DIR_LO
    INY
    LDA ($34),Y
    STA CUR_DIR_HI
    ; Update path string
    JMP CD_UPDATE_PATH_PARENT

CD_SEARCH:
    ; Search directory for matching entry
    ; Save argument pointer
    STX $3A             ; Save arg start index

    ; Search through directory sectors
    LDA #DIR_START
    STA $38             ; Current sector
    LDA #DIR_SECTS
    STA $39             ; Remaining sectors
    LDA #$00
    STA $3B             ; Entry counter (for calculating index)

CD_SEARCH_SECTOR:
    ; Read sector to $0400
    LDA $38
    STA $30
    LDA #$00
    STA $31
    LDA #$00
    STA $32
    LDA #$04
    STA $33
    JSR $F200           ; DISK_READ
    BCC CD_READ_OK
    JMP CD_NOT_FOUND
CD_READ_OK:
    ; Process 16 entries per sector
    LDA #$00
    STA $34             ; Buffer offset low
    LDA #$04
    STA $35             ; Buffer offset high
    LDX #$00            ; Entry within sector

CD_SEARCH_ENTRY:
    ; Check status = $01 (active)
    LDY #$00
    LDA ($34),Y
    CMP #$01
    BEQ CD_CHK_ATTR
    JMP CD_SEARCH_NEXT
CD_CHK_ATTR:
    ; Check attributes - must be directory ($10)
    LDY #$14
    LDA ($34),Y
    AND #$10
    BNE CD_CHK_PARENT
    JMP CD_SEARCH_NEXT
CD_CHK_PARENT:
    ; Check parent matches current directory
    LDY #$15
    LDA ($34),Y
    CMP CUR_DIR_LO
    BEQ CD_CHK_PAR_HI
    JMP CD_SEARCH_NEXT
CD_CHK_PAR_HI:
    INY
    LDA ($34),Y
    CMP CUR_DIR_HI
    BEQ CD_CHK_NAME
    JMP CD_SEARCH_NEXT
CD_CHK_NAME:
    ; Compare name with argument
    LDY #$01            ; Entry name offset
    LDX $3A             ; Argument index
CD_CMP_NAME:
    LDA ($34),Y
    CMP #$20            ; Space in entry = end of name
    BEQ CD_CMP_END
    CMP $0300,X
    BEQ CD_CMP_CONT
    JMP CD_SEARCH_NEXT
CD_CMP_CONT:
    INX
    INY
    CPY #$09            ; Max 8 chars
    BNE CD_CMP_NAME

CD_CMP_END:
    ; Check argument also ended
    LDA $0300,X
    BEQ CD_FOUND
    CMP #$20            ; Space
    BEQ CD_FOUND
    CMP #'/'            ; Slash
    BEQ CD_FOUND
    ; Argument longer than entry name
    JMP CD_SEARCH_NEXT_FAR

CD_FOUND:
    ; Found! Set CUR_DIR to entry index ($3B)
    LDA $3B
    STA CUR_DIR_LO
    LDA #$00
    STA CUR_DIR_HI
    ; Update path
    JMP CD_UPDATE_PATH

CD_SEARCH_NEXT:
    ; Move to next entry
    CLC
    LDA $34
    ADC #$20            ; 32 bytes per entry
    STA $34
    BCC CD_SEARCH_NO_INC
    INC $35
CD_SEARCH_NO_INC:
    INC $3B             ; Increment entry counter
    INX
    CPX #$10            ; 16 entries per sector
    BEQ CD_NEXT_SECTOR
    JMP CD_SEARCH_ENTRY

CD_NEXT_SECTOR:
    ; Next sector
    INC $38
    DEC $39
    BEQ CD_NOT_FOUND
    JMP CD_SEARCH_SECTOR

CD_NOT_FOUND:
    JSR PRINT_NOTFOUND
    RTS

CD_SEARCH_NEXT_FAR:
    JMP CD_SEARCH_NEXT

CD_GO_ROOT:
    LDA #$FF
    STA CUR_DIR_LO
    STA CUR_DIR_HI
    LDA #$01
    STA ENV_LEN
    LDA #'/'
    STA ENV_PATH
    RTS

CD_LOAD_CUR_ENTRY:
    ; Load directory entry for CUR_DIR into buffer at $0400
    ; Calculate sector: entry_index / 16 + DIR_START
    LDA CUR_DIR_LO
    LSR A
    LSR A
    LSR A
    LSR A               ; / 16
    CLC
    ADC #DIR_START
    STA $30
    LDA #$00
    STA $31
    LDA #$00
    STA $32
    LDA #$04
    STA $33
    JSR $F200           ; DISK_READ
    ; Calculate offset: (entry_index % 16) * 32
    LDA CUR_DIR_LO
    AND #$0F            ; % 16
    ASL A
    ASL A
    ASL A
    ASL A
    ASL A               ; * 32
    STA $34
    LDA #$04
    STA $35
    RTS

CD_UPDATE_PATH_PARENT:
    ; Update ENV_PATH by removing last component
    LDY ENV_LEN
    DEY
    BEQ CD_AT_ROOT
CD_BACK_LOOP:
    DEY
    BEQ CD_AT_ROOT
    LDA ENV_PATH,Y
    CMP #'/'
    BNE CD_BACK_LOOP
    INY
    STY ENV_LEN
    RTS
CD_AT_ROOT:
    LDA #$01
    STA ENV_LEN
    LDA #'/'
    STA ENV_PATH
    RTS

CD_UPDATE_PATH:
    ; Add directory name to ENV_PATH
    ; First, add the name from entry at ($34)
    ; Use X for path position, save current Y to stack
    TYA
    PHA                 ; Save Y
    LDX ENV_LEN         ; X = path position
    LDY #$01            ; Y = entry name offset
CD_COPY_NAME:
    LDA ($34),Y
    CMP #$20            ; Space = end of name
    BEQ CD_ADD_SLASH
    STA ENV_PATH,X
    INX
    INY
    CPY #$09            ; Max 8 chars
    BNE CD_COPY_NAME
CD_ADD_SLASH:
    LDA #'/'
    STA ENV_PATH,X
    INX
    STX ENV_LEN
    PLA
    TAY                 ; Restore Y
    RTS

; ============================================================
; Helper: Print "No argument"
; ============================================================
PRINT_NOARG:
    LDA #$4E            ; 'N'
    JSR $F000
    LDA #$6F            ; 'o'
    JSR $F000
    LDA #$20
    JSR $F000
    LDA #$61            ; 'a'
    JSR $F000
    LDA #$72            ; 'r'
    JSR $F000
    LDA #$67            ; 'g'
    JSR $F000
    JSR $F080
    RTS

; ============================================================
; Helper: Print "Not found"
; ============================================================
PRINT_NOTFOUND:
    LDA #$4E            ; 'N'
    JSR $F000
    LDA #$6F            ; 'o'
    JSR $F000
    LDA #$74            ; 't'
    JSR $F000
    LDA #$20
    JSR $F000
    LDA #$66            ; 'f'
    JSR $F000
    LDA #$6F            ; 'o'
    JSR $F000
    LDA #$75            ; 'u'
    JSR $F000
    LDA #$6E            ; 'n'
    JSR $F000
    LDA #$64            ; 'd'
    JSR $F000
    JSR $F080
    RTS

; ============================================================
; CMD_RUN_ARG - Run with explicit argument
; ============================================================
; Uses ARG_PTR to get filename instead of whole command
; ============================================================
CMD_RUN_ARG:
    LDX ARG_PTR
    LDA $0300,X
    BNE RUN_ARG_GO
    JSR PRINT_NOARG
    RTS
RUN_ARG_GO:
    ; Copy argument to start of command buffer for CMD_RUN
    LDY #$00
RUN_ARG_COPY:
    LDA $0300,X
    STA $0300,Y
    BEQ RUN_ARG_EXEC
    CMP #$20
    BEQ RUN_ARG_TERM
    INX
    INY
    JMP RUN_ARG_COPY
RUN_ARG_TERM:
    LDA #$00
    STA $0300,Y
RUN_ARG_EXEC:
    JMP CMD_RUN

; ============================================================
; CMD_RUN - Run a .COM file
; ============================================================
; Searches directory for filename in command buffer
; Loads file to $0800 and jumps to it
; ============================================================
CMD_RUN:
    ; Iterate over directory sectors
    LDA #DIR_START
    STA $38             ; Current sector
    LDA #DIR_SECTS
    STA $39             ; Remaining sectors

RUN_SECTOR:
    LDA $38             ; Sector to read
    STA $30
    LDA #$00
    STA $31
    LDA #$00            ; Buffer at $0400
    STA $32
    LDA #$04
    STA $33
    JSR $F200           ; DISK_READ
    BCC RUN_DIR_OK
RUN_NEXT_SECTOR_JMP:
    JMP RUN_NEXT_SECTOR ; Trampoline for far branch
RUN_DIR_OK:

    ; Search directory for matching filename
    LDX #$00            ; Entry index
    LDA #$00
    STA $34             ; Entry pointer low
    LDA #$04
    STA $35             ; Entry pointer high ($0400)

RUN_SEARCH:
    ; Check if entry is active
    LDY #$00
    LDA ($34),Y
    CMP #$01
    BEQ RUN_CHK_PARENT
    JMP RUN_NEXT_ENTRY  ; Trampoline for inactive entry
RUN_CHK_PARENT:
    ; Check parent directory matches current directory
    LDY #$15
    LDA ($34),Y
    CMP CUR_DIR_LO
    BEQ RUN_CHK_PAR_HI
    JMP RUN_NEXT_ENTRY
RUN_CHK_PAR_HI:
    INY
    LDA ($34),Y
    CMP CUR_DIR_HI
    BEQ RUN_ENTRY_OK
    JMP RUN_NEXT_ENTRY
RUN_ENTRY_OK:
    ; Compare filename with command buffer
    ; Command is at $0300, filename at ($34)+1
    LDY #$00
RUN_CMP_LOOP:
    LDA $0300,Y         ; Command char
    BEQ RUN_CMP_END     ; End of command?
    CMP #$20            ; Space - end of name (args follow)
    BEQ RUN_CMP_END
    CMP #$2E            ; '.' - skip extension in cmd
    BEQ RUN_CMP_END

    ; Get filename char
    STY $36             ; Save Y
    TYA
    CLC
    ADC #$01            ; Offset by 1 (status byte)
    TAY
    LDA ($34),Y         ; Filename char
    LDY $36             ; Restore Y

    ; Compare
    CMP $0300,Y
    BEQ RUN_CMP_MATCH   ; Match continues
    JMP RUN_NEXT_ENTRY  ; No match - trampoline
RUN_CMP_MATCH:
    INY
    CPY #$08            ; Max 8 chars
    BNE RUN_CMP_LOOP

RUN_CMP_END:
    ; Check extension is COM (offset $09-$0B)
    ; Only execute .COM files, skip .ASM etc
    LDY #$09
    LDA ($34),Y
    CMP #$43            ; 'C'
    BNE RUN_NEXT_ENTRY
    INY
    LDA ($34),Y
    CMP #$4F            ; 'O'
    BNE RUN_NEXT_ENTRY
    INY
    LDA ($34),Y
    CMP #$4D            ; 'M'
    BNE RUN_NEXT_ENTRY

    ; Found .COM file! Get start sector from offset $0C-$0D
    LDY #$0C
    LDA ($34),Y
    STA $30             ; Start sector low
    INY
    LDA ($34),Y
    STA $31             ; Start sector high

    ; Get file size from offset $0E-$0F (in bytes)
    LDY #$0E
    LDA ($34),Y
    STA $36             ; Size low
    INY
    LDA ($34),Y
    STA $37             ; Size high

    ; Load file to $0800
    ; $36-$37 = file size, need to calculate sector count
    LDA #$00
    STA $32             ; Load address low
    LDA #$08
    STA $33             ; Load address high ($0800)

    ; Calculate number of sectors: (size + 511) / 512
    ; Simplified: high byte / 2, round up if any remainder
    LDA $37             ; Size high byte
    LSR A               ; Divide by 2 (512 bytes = 2 pages)
    STA $3A             ; Sector count
    LDA $36             ; Size low byte
    ORA $37             ; Check if any low byte or odd high
    BEQ RUN_ONE_SEC     ; Size is 0 or exact multiple
    LDA $37
    AND #$01            ; Check if high byte is odd
    BEQ RUN_CHECK_LOW
    INC $3A             ; Add sector for odd high byte
RUN_CHECK_LOW:
    LDA $36             ; Check low byte
    BEQ RUN_LOAD
    INC $3A             ; Add sector for remainder
    JMP RUN_LOAD
RUN_ONE_SEC:
    LDA #$01
    STA $3A             ; At least one sector

RUN_LOAD:
    ; Load sectors in a loop
RUN_LOAD_LOOP:
    LDA $3A
    BEQ RUN_LOAD_DONE   ; No more sectors

    JSR $F200           ; DISK_READ (loads one sector)
    BCS RUN_NOTFOUND

    ; Advance to next sector
    INC $30
    BNE RUN_NO_CARRY1
    INC $31
RUN_NO_CARRY1:

    ; Advance buffer by 512 bytes (2 pages)
    CLC
    LDA $33
    ADC #$02
    STA $33

    DEC $3A             ; Decrement sector count
    JMP RUN_LOAD_LOOP

RUN_LOAD_DONE:
    ; Call loaded program (JSR so it can RTS back)
    JSR $0800
    ; After program exits, reload shell from disk (CP/M style)
    ; This handles the case where the program overwrote our code
    JMP $F280           ; BIOS.SHELL_RELOAD

RUN_NEXT_ENTRY:
    ; Move to next entry (+32 bytes)
    CLC
    LDA $34
    ADC #$20
    STA $34
    LDA $35
    ADC #$00
    STA $35

    INX
    CPX #$10            ; 16 entries per sector
    BEQ RUN_NEXT_SECTOR
    JMP RUN_SEARCH      ; Trampoline for far branch

RUN_NEXT_SECTOR:
    INC $38
    DEC $39
    BEQ RUN_NOTFOUND
    JMP RUN_SECTOR

RUN_NOTFOUND:
    ; Print "?"
    LDA #$3F            ; '?'
    JSR $F000
    JSR $F080           ; NEWLINE
    RTS

; ============================================================
; CMD_INSTALL - Install WireOS from floppy to HDD
; ============================================================
; Copies sectors from floppy ($8040) to HDD ($8020)
; Copies sectors 0-254 (entire floppy contents)
; ============================================================
CMD_INSTALL:
    ; Check if floppy is inserted (bit 6 of $8040 = no disk)
    LDA $8040           ; FLOPPY_STATUS
    AND #$40            ; No disk bit?
    BEQ INST_GO
    ; No floppy - print error
    LDA #$4E            ; 'N'
    JSR $F000
    LDA #$6F            ; 'o'
    JSR $F000
    LDA #$20
    JSR $F000
    LDA #$66            ; 'f'
    JSR $F000
    LDA #$6C            ; 'l'
    JSR $F000
    LDA #$6F            ; 'o'
    JSR $F000
    LDA #$70            ; 'p'
    JSR $F000
    LDA #$70            ; 'p'
    JSR $F000
    LDA #$79            ; 'y'
    JSR $F000
    JSR $F080
    RTS

INST_GO:
    ; Print "Installing..."
    LDA #$49            ; 'I'
    JSR $F000
    LDA #$6E            ; 'n'
    JSR $F000
    LDA #$73            ; 's'
    JSR $F000
    LDA #$74            ; 't'
    JSR $F000
    LDA #$61            ; 'a'
    JSR $F000
    LDA #$6C            ; 'l'
    JSR $F000
    LDA #$6C            ; 'l'
    JSR $F000
    LDA #$69            ; 'i'
    JSR $F000
    LDA #$6E            ; 'n'
    JSR $F000
    LDA #$67            ; 'g'
    JSR $F000
    LDA #$2E            ; '.'
    JSR $F000
    LDA #$2E            ; '.'
    JSR $F000
    LDA #$2E            ; '.'
    JSR $F000
    JSR $F080           ; NEWLINE

    ; Initialize sector counter
    LDA #$00
    STA $38             ; Current sector low
    STA $39             ; Current sector high

INST_LOOP:
    ; Read sector from floppy into $0400
    LDA $38
    STA $8042           ; FLOPPY_SEC_LO
    LDA $39
    STA $8043           ; FLOPPY_SEC_HI
    LDA #$00
    STA $8044           ; FLOPPY_BUF_LO ($0400)
    LDA #$04
    STA $8045           ; FLOPPY_BUF_HI
    LDA #$01
    STA $8046           ; FLOPPY_COUNT = 1
    LDA #$01
    STA $8041           ; FLOPPY_CMD = READ

INST_FWAIT:
    LDA $8040           ; FLOPPY_STATUS
    AND #$02            ; Busy?
    BNE INST_FWAIT
    LDA $8040
    AND #$80            ; Error?
    BNE INST_ERR

    ; Write sector to HDD
    LDA $38
    STA $8022           ; DISK_SEC_LO
    LDA $39
    STA $8023           ; DISK_SEC_HI
    LDA #$00
    STA $8024           ; DISK_BUF_LO ($0400)
    LDA #$04
    STA $8025           ; DISK_BUF_HI
    LDA #$01
    STA $8026           ; DISK_COUNT = 1
    LDA #$02
    STA $8021           ; DISK_CMD = WRITE

INST_DWAIT:
    LDA $8020           ; DISK_STATUS
    AND #$02            ; Busy?
    BNE INST_DWAIT
    LDA $8020
    AND #$80            ; Error?
    BNE INST_ERR

    ; Print "." for progress
    LDA #$2E            ; '.'
    JSR $F000

    ; Next sector
    INC $38
    BNE INST_CHK
    INC $39
INST_CHK:
    ; Stop at sector 255 (copy entire floppy - 255 is max for 8-bit counter)
    LDA $38
    CMP #$FF            ; 255 sectors
    BNE INST_LOOP

    ; Done! Print newline and "Done"
    JSR $F080
    LDA #$44            ; 'D'
    JSR $F000
    LDA #$6F            ; 'o'
    JSR $F000
    LDA #$6E            ; 'n'
    JSR $F000
    LDA #$65            ; 'e'
    JSR $F000
    LDA #$21            ; '!'
    JSR $F000
    JSR $F080
    RTS

INST_ERR:
    ; Print "ERR"
    JSR $F080
    LDA #$45            ; 'E'
    JSR $F000
    LDA #$52            ; 'R'
    JSR $F000
    LDA #$52            ; 'R'
    JSR $F000
    JSR $F080
    RTS
