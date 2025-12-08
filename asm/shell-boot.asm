; ============================================================
; WireOS Shell - $0800
; ============================================================
; A simple command shell using BIOS routines.
; PUTCHAR=$F000, GETCHAR=$F040, NEWLINE=$F080
; DISK_READ=$F200
;
; Commands:
;   HELP - Show available commands
;   VER  - Show version
;   HEX  - Jump to hex loader
;   MEM  - Show memory info
;   DIR  - List files on disk
;   RUN name - Load and run .COM file
;   (or just type filename to run it)
;
; Disk layout assumptions:
;   Directory occupies 3 sectors starting at DIR_START. We scan all three so
;   it works whether the first directory sector is at 2 (HDD tests) or 3
;   (floppy layout with two shell continuation sectors).
;
; Memory usage:
;   $0300-$033F: Command buffer (64 bytes)
;   $0400-$05FF: Disk buffer (512 bytes)
;   $30-$33: BIOS disk params (sector, buffer addr)
; ============================================================

.ORG $0800

; ============================================================
; Constants
; ============================================================
DIR_START  = $02            ; First directory sector to scan
DIR_SECTS  = $03            ; Number of directory sectors
ENV_BASE   = $0200          ; Environment block for current path
ENV_LEN    = ENV_BASE       ; Byte: length of current path
ENV_PATH   = ENV_BASE+1     ; Path storage (max 63 chars)
ENV_MAX    = 63

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
    LDA $02             ; Get length
    BEQ PC_DONE         ; Empty line

    ; Quick dispatch on first character
    LDA $0300           ; First char
    CMP #$44            ; 'D' (DIR)
    BEQ PC_D_CMD
    CMP #$48            ; 'H' (HELP or HEX)
    BEQ PC_H_CMD
    CMP #$49            ; 'I' (INSTALL)
    BEQ PC_I_CMD
    CMP #$4D            ; 'M' (MEM)
    BEQ PC_M_CMD
    CMP #$56            ; 'V' (VER)
    BEQ PC_V_CMD
    JMP CMD_RUN         ; Try as filename

PC_DONE:
    RTS

PC_D_CMD:
    ; Check "DIR"
    LDA $0301
    CMP #$49            ; 'I'
    BNE PC_TRY_RUN2
    LDA $0302
    CMP #$52            ; 'R'
    BNE PC_TRY_RUN2
    JMP CMD_DIR
PC_TRY_RUN2:
    JMP CMD_RUN

PC_I_CMD:
    ; Check "INSTALL"
    LDA $0301
    CMP #$4E            ; 'N'
    BNE PC_TRY_RUN6
    LDA $0302
    CMP #$53            ; 'S'
    BNE PC_TRY_RUN6
    JMP CMD_INSTALL
PC_TRY_RUN6:
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
    ; "Commands:"
    LDA #$43            ; 'C'
    JSR $F000
    LDA #$6F            ; 'o'
    JSR $F000
    LDA #$6D            ; 'm'
    JSR $F000
    LDA #$6D            ; 'm'
    JSR $F000
    LDA #$61            ; 'a'
    JSR $F000
    LDA #$6E            ; 'n'
    JSR $F000
    LDA #$64            ; 'd'
    JSR $F000
    LDA #$73            ; 's'
    JSR $F000
    LDA #$3A            ; ':'
    JSR $F000
    JSR $F080
    ; " DIR INSTALL"
    LDA #$20            ; ' '
    JSR $F000
    LDA #$44            ; 'D'
    JSR $F000
    LDA #$49            ; 'I'
    JSR $F000
    LDA #$52            ; 'R'
    JSR $F000
    LDA #$20
    JSR $F000
    LDA #$49            ; 'I'
    JSR $F000
    LDA #$4E            ; 'N'
    JSR $F000
    LDA #$53            ; 'S'
    JSR $F000
    LDA #$54            ; 'T'
    JSR $F000
    LDA #$41            ; 'A'
    JSR $F000
    LDA #$4C            ; 'L'
    JSR $F000
    LDA #$4C            ; 'L'
    JSR $F000
    JSR $F080
    ; " HELP VER HEX MEM"
    LDA #$20            ; ' '
    JSR $F000
    LDA #$48            ; 'H'
    JSR $F000
    LDA #$45            ; 'E'
    JSR $F000
    LDA #$4C            ; 'L'
    JSR $F000
    LDA #$50            ; 'P'
    JSR $F000
    LDA #$20
    JSR $F000
    LDA #$56            ; 'V'
    JSR $F000
    LDA #$45            ; 'E'
    JSR $F000
    LDA #$52            ; 'R'
    JSR $F000
    LDA #$20
    JSR $F000
    LDA #$48            ; 'H'
    JSR $F000
    LDA #$45            ; 'E'
    JSR $F000
    LDA #$58            ; 'X'
    JSR $F000
    LDA #$20
    JSR $F000
    LDA #$4D            ; 'M'
    JSR $F000
    LDA #$45            ; 'E'
    JSR $F000
    LDA #$4D            ; 'M'
    JSR $F000
    JSR $F080
    RTS

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
    BCS RUN_NEXT_SECTOR

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
    BNE RUN_NEXT_ENTRY

    ; Compare filename with command buffer
    ; Command is at $0300, filename at ($34)+1
    LDY #$00
RUN_CMP_LOOP:
    LDA $0300,Y         ; Command char
    BEQ RUN_CMP_END     ; End of command?
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
    BNE RUN_NEXT_ENTRY  ; No match

    INY
    CPY #$08            ; Max 8 chars
    BNE RUN_CMP_LOOP

RUN_CMP_END:
    ; Found it! Get start sector from offset $0C-$0D
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
    LDA #$00
    STA $32             ; Load address low
    LDA #$08
    STA $33             ; Load address high ($0800)

    JSR $F200           ; DISK_READ (loads one sector)
    BCS RUN_NOTFOUND

    ; Jump to loaded program
    JMP $0800

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
    BNE RUN_SEARCH

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
; Copies sectors 0-30 (boot, shell, dir, bitmap, files)
; ============================================================
CMD_INSTALL:
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
    ; Stop at sector 30
    LDA $38
    CMP #$1E            ; 30 sectors
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
