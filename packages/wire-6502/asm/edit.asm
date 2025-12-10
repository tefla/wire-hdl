; ============================================================
; EDIT.COM - Text Editor for WireOS
; ============================================================
; A simple text editor with:
;   - Arrow key navigation
;   - Insert/delete text
;   - File load/save
;   - Line-based editing
; ============================================================

.ORG $0800

; ============================================================
; Constants
; ============================================================
SCREEN_ROWS = 23          ; Usable rows (25 - header - status)
SCREEN_COLS = 80          ; Screen width

; Zero page variables
ZP_CUR_X    = $10         ; Cursor X position
ZP_CUR_Y    = $11         ; Cursor Y position (in doc)
ZP_TOP_LO   = $12         ; Top line of screen (low)
ZP_TOP_HI   = $13         ; Top line of screen (high)
ZP_PTR_LO   = $14         ; Text pointer low
ZP_PTR_HI   = $15         ; Text pointer high
ZP_LEN_LO   = $16         ; Text length low
ZP_LEN_HI   = $17         ; Text length high
ZP_TEMP     = $18         ; Temp storage
ZP_TEMP2    = $19
ZP_MODIFIED = $1A         ; Modified flag
ZP_LINE_LO  = $1B         ; Line number low
ZP_LINE_HI  = $1C         ; Line number high

; Text buffer
TEXT_BUF    = $2000       ; Start of text buffer
TEXT_END    = $5FFF       ; End of text buffer

; I/O
KBD_STATUS  = $8010
KBD_DATA    = $8011

; Video registers
CURSOR_X_REG = $8051
CURSOR_Y_REG = $8052

; Shell command buffer (holds "EDIT filename")
CMD_BUF     = $0300

; Directory constants
DIR_START   = $01             ; First directory sector
DIR_SECTS   = $03             ; Number of directory sectors

; Zero page for file loading
ZP_ARG_PTR  = $20             ; Pointer to argument in CMD_BUF
ZP_SECTOR   = $30             ; Disk sector to read (2 bytes)
ZP_BUFFER   = $32             ; Buffer address (2 bytes)
ZP_DIR_PTR  = $34             ; Directory entry pointer (2 bytes)
ZP_SIZE     = $36             ; File size (2 bytes)
ZP_DIR_SEC  = $38             ; Current dir sector
ZP_DIR_CNT  = $39             ; Remaining dir sectors

; ============================================================
; Entry Point
; ============================================================
START:
  ; Initialize stack
  LDX #$FF
  TXS

  ; Clear zero page variables
  LDA #$00
  STA ZP_CUR_X
  STA ZP_CUR_Y
  STA ZP_TOP_LO
  STA ZP_TOP_HI
  STA ZP_LEN_LO
  STA ZP_LEN_HI
  STA ZP_MODIFIED
  STA ZP_LINE_LO
  STA ZP_LINE_HI

  ; Initialize text buffer with empty state
  LDA #$00
  STA TEXT_BUF

  ; Check for filename argument and load file if present
  JSR LOAD_ARG_FILE

  ; Clear screen
  JSR $F140               ; CLEAR_SCREEN

  ; Draw header
  JSR DRAW_HEADER

  ; Draw status bar
  JSR DRAW_STATUS

  ; Position cursor in edit area
  LDA #$00
  LDX #$01                ; Row 1 (after header)
  JSR $F100               ; SET_CURSOR

  ; If file was loaded, display it
  LDA ZP_LEN_LO
  ORA ZP_LEN_HI
  BEQ NO_FILE_DISPLAY
  JSR DISPLAY_TEXT
NO_FILE_DISPLAY:

; ============================================================
; Main Editor Loop
; ============================================================
MAIN_LOOP:
  ; Wait for key
  JSR $F040               ; GETCHAR

  ; Check for control keys
  CMP #$11                ; Ctrl+Q (quit)
  BEQ DO_QUIT

  CMP #$0D                ; Enter
  BEQ DO_ENTER

  CMP #$08                ; Backspace
  BEQ DO_BACKSPACE

  ; Check for printable character (space to ~)
  CMP #$20
  BCC MAIN_LOOP           ; Ignore control chars
  CMP #$7F
  BCS MAIN_LOOP           ; Ignore DEL and above

  ; Insert printable character
  JSR INSERT_CHAR
  JMP MAIN_LOOP

DO_QUIT:
  ; Check if modified
  LDA ZP_MODIFIED
  BEQ QUIT_NOW

  ; Show "Save? (Y/N)" prompt
  JSR SHOW_SAVE_PROMPT
  JSR $F040               ; GETCHAR
  CMP #$59                ; 'Y'
  BEQ SAVE_AND_QUIT
  CMP #$79                ; 'y'
  BEQ SAVE_AND_QUIT

QUIT_NOW:
  ; Clear screen and exit
  JSR $F140               ; CLEAR_SCREEN

  ; Print exit message
  LDA #$45                ; 'E'
  JSR $F000
  LDA #$58                ; 'X'
  JSR $F000
  LDA #$49                ; 'I'
  JSR $F000
  LDA #$54                ; 'T'
  JSR $F000
  JSR $F080               ; NEWLINE

  ; Return to system (infinite loop for now)
HALT:
  JMP HALT

SAVE_AND_QUIT:
  ; TODO: Implement save
  JMP QUIT_NOW

DO_ENTER:
  ; Insert newline character
  LDA #$0A                ; LF
  JSR INSERT_CHAR

  ; Move to next line
  INC ZP_CUR_Y
  LDA #$00
  STA ZP_CUR_X

  ; Update display
  JSR REFRESH_LINE
  JSR UPDATE_CURSOR
  JMP MAIN_LOOP

DO_BACKSPACE:
  ; Check if at start of buffer
  LDA ZP_LEN_LO
  ORA ZP_LEN_HI
  BEQ MAIN_LOOP           ; Nothing to delete

  ; Delete character before cursor
  JSR DELETE_CHAR
  JSR REFRESH_LINE
  JSR UPDATE_CURSOR
  JMP MAIN_LOOP

; ============================================================
; INSERT_CHAR - Insert character in A at current position
; ============================================================
INSERT_CHAR:
  PHA                     ; Save character

  ; Check if buffer is full
  LDA ZP_LEN_HI
  CMP #$3F                ; High byte of 16KB limit
  BCS INSERT_FULL

  ; Calculate insertion point: TEXT_BUF + position
  ; For simplicity, we append to end for now
  ; Get buffer end address
  CLC
  LDA #<TEXT_BUF
  ADC ZP_LEN_LO
  STA ZP_PTR_LO
  LDA #>TEXT_BUF
  ADC ZP_LEN_HI
  STA ZP_PTR_HI

  ; Store character (self-modifying code)
  PLA                     ; Get character back
  PHA                     ; Save again for echo

  ; Write to buffer using absolute indexed
  LDX ZP_LEN_LO
  STA TEXT_BUF,X

  ; Increment length
  INC ZP_LEN_LO
  BNE INSERT_NO_CARRY
  INC ZP_LEN_HI
INSERT_NO_CARRY:

  ; Mark as modified
  LDA #$01
  STA ZP_MODIFIED

  ; Echo character to screen
  PLA
  JSR $F000               ; PUTCHAR

  ; Update cursor position
  INC ZP_CUR_X
  LDA ZP_CUR_X
  CMP #SCREEN_COLS
  BCC INSERT_DONE

  ; Wrap to next line
  LDA #$00
  STA ZP_CUR_X
  INC ZP_CUR_Y

INSERT_DONE:
  JSR UPDATE_CURSOR
  RTS

INSERT_FULL:
  PLA                     ; Discard character
  ; Beep or flash (TODO)
  RTS

; ============================================================
; DELETE_CHAR - Delete character before cursor
; ============================================================
DELETE_CHAR:
  ; Decrement length
  LDA ZP_LEN_LO
  SEC
  SBC #$01
  STA ZP_LEN_LO
  BCS DEL_NO_BORROW
  DEC ZP_LEN_HI
DEL_NO_BORROW:

  ; Move cursor back
  LDA ZP_CUR_X
  BNE DEL_SAME_LINE

  ; Wrap to previous line
  DEC ZP_CUR_Y
  LDA #SCREEN_COLS
  STA ZP_CUR_X

DEL_SAME_LINE:
  DEC ZP_CUR_X

  ; Mark as modified
  LDA #$01
  STA ZP_MODIFIED

  ; Update display - print backspace, space, backspace
  LDA #$08
  JSR $F000               ; Backspace
  LDA #$20
  JSR $F000               ; Space
  LDA #$08
  JSR $F000               ; Backspace

  RTS

; ============================================================
; UPDATE_CURSOR - Set hardware cursor position
; ============================================================
UPDATE_CURSOR:
  LDA ZP_CUR_X
  STA CURSOR_X_REG

  ; Add 1 for header row
  LDA ZP_CUR_Y
  CLC
  ADC #$01
  STA CURSOR_Y_REG
  RTS

; ============================================================
; REFRESH_LINE - Redraw current line
; ============================================================
REFRESH_LINE:
  ; For now, just update cursor
  JSR UPDATE_CURSOR
  RTS

; ============================================================
; DRAW_HEADER - Draw editor header bar
; ============================================================
DRAW_HEADER:
  ; Position at top
  LDA #$00
  LDX #$00
  JSR $F100               ; SET_CURSOR

  ; Draw header text: "EDIT.COM - Ctrl+Q:Quit"
  LDA #$45                ; 'E'
  JSR $F000
  LDA #$44                ; 'D'
  JSR $F000
  LDA #$49                ; 'I'
  JSR $F000
  LDA #$54                ; 'T'
  JSR $F000
  LDA #$2E                ; '.'
  JSR $F000
  LDA #$43                ; 'C'
  JSR $F000
  LDA #$4F                ; 'O'
  JSR $F000
  LDA #$4D                ; 'M'
  JSR $F000
  LDA #$20                ; ' '
  JSR $F000
  LDA #$2D                ; '-'
  JSR $F000
  LDA #$20                ; ' '
  JSR $F000

  ; "Ctrl+Q:Quit"
  LDA #$43                ; 'C'
  JSR $F000
  LDA #$74                ; 't'
  JSR $F000
  LDA #$72                ; 'r'
  JSR $F000
  LDA #$6C                ; 'l'
  JSR $F000
  LDA #$2B                ; '+'
  JSR $F000
  LDA #$51                ; 'Q'
  JSR $F000
  LDA #$3A                ; ':'
  JSR $F000
  LDA #$51                ; 'Q'
  JSR $F000
  LDA #$75                ; 'u'
  JSR $F000
  LDA #$69                ; 'i'
  JSR $F000
  LDA #$74                ; 't'
  JSR $F000

  RTS

; ============================================================
; DRAW_STATUS - Draw status bar at bottom
; ============================================================
DRAW_STATUS:
  ; Position at row 24
  LDA #$00
  LDX #24
  JSR $F100               ; SET_CURSOR

  ; Draw status: "Line: 1  Col: 1"
  LDA #$4C                ; 'L'
  JSR $F000
  LDA #$69                ; 'i'
  JSR $F000
  LDA #$6E                ; 'n'
  JSR $F000
  LDA #$65                ; 'e'
  JSR $F000
  LDA #$3A                ; ':'
  JSR $F000
  LDA #$20                ; ' '
  JSR $F000
  LDA #$31                ; '1'
  JSR $F000
  LDA #$20                ; ' '
  JSR $F000
  LDA #$20                ; ' '
  JSR $F000
  LDA #$43                ; 'C'
  JSR $F000
  LDA #$6F                ; 'o'
  JSR $F000
  LDA #$6C                ; 'l'
  JSR $F000
  LDA #$3A                ; ':'
  JSR $F000
  LDA #$20                ; ' '
  JSR $F000
  LDA #$31                ; '1'
  JSR $F000

  RTS

; ============================================================
; LOAD_ARG_FILE - Check command buffer for filename and load it
; ============================================================
; The shell leaves the full command in CMD_BUF ($0300)
; e.g., "EDIT TEST.ASM" or just "EDIT"
; We need to skip past "EDIT " and find the filename
; ============================================================
LOAD_ARG_FILE:
  ; Find the argument by skipping the command word
  LDX #$00
LAF_SKIP_CMD:
  LDA CMD_BUF,X
  BEQ LAF_RTS             ; End of string - no argument
  CMP #$20                ; Space?
  BEQ LAF_SKIP_SPACES
  INX
  BNE LAF_SKIP_CMD        ; Always taken (X won't wrap)
LAF_RTS:
  RTS                     ; Early exit point (no file)

LAF_SKIP_SPACES:
  INX
  LDA CMD_BUF,X
  CMP #$20
  BEQ LAF_SKIP_SPACES
  BEQ LAF_RTS             ; Only spaces = no arg

  ; X now points to the filename argument
  STX ZP_ARG_PTR

  ; Search directory for the file
  LDA #DIR_START
  STA ZP_DIR_SEC
  LDA #DIR_SECTS
  STA ZP_DIR_CNT

LAF_SEARCH_SECTOR:
  ; Read directory sector
  LDA ZP_DIR_SEC
  STA ZP_SECTOR
  LDA #$00
  STA ZP_SECTOR+1
  LDA #$00                ; Use $0400 as temp buffer
  STA ZP_BUFFER
  LDA #$04
  STA ZP_BUFFER+1
  JSR $F200               ; DISK_READ
  BCC LAF_READ_OK
  JMP LAF_NEXT_SECTOR     ; Disk error, try next sector
LAF_READ_OK:

  ; Search entries in this sector
  LDX #$00                ; Entry index
  LDA #$00
  STA ZP_DIR_PTR
  LDA #$04
  STA ZP_DIR_PTR+1

LAF_SEARCH_ENTRY:
  ; Check if entry is active (status = $01)
  LDY #$00
  LDA (ZP_DIR_PTR),Y
  CMP #$01
  BNE LAF_NEXT_ENTRY

  ; Compare filename with argument
  LDX ZP_ARG_PTR
  LDY #$00
LAF_CMP_NAME:
  LDA CMD_BUF,X           ; Arg char
  BEQ LAF_CMP_END         ; End of arg
  CMP #$2E                ; '.' ends base name
  BEQ LAF_CMP_END
  CMP #$20                ; Space ends filename
  BEQ LAF_CMP_END

  ; Get filename char at offset Y+1 (skip status byte)
  STY ZP_SIZE             ; Temp save Y
  TYA
  CLC
  ADC #$01
  TAY
  LDA (ZP_DIR_PTR),Y
  LDY ZP_SIZE             ; Restore Y

  ; Compare chars
  CMP CMD_BUF,X
  BNE LAF_NEXT_ENTRY

  INX
  INY
  CPY #$08                ; Max 8 chars in filename
  BNE LAF_CMP_NAME

LAF_CMP_END:
  ; Found the file! Load it and return
  JMP LAF_LOAD_FILE

LAF_NEXT_ENTRY:
  ; Move to next entry (+32 bytes)
  CLC
  LDA ZP_DIR_PTR
  ADC #$20
  STA ZP_DIR_PTR
  LDA ZP_DIR_PTR+1
  ADC #$00
  STA ZP_DIR_PTR+1

  INX
  CPX #$10                ; 16 entries per sector
  BNE LAF_SEARCH_ENTRY

LAF_NEXT_SECTOR:
  INC ZP_DIR_SEC
  DEC ZP_DIR_CNT
  BNE LAF_SEARCH_SECTOR
  RTS                     ; No file found

; Load the file we found
LAF_LOAD_FILE:
  ; Get start sector from offset $0C-$0D
  LDY #$0C
  LDA (ZP_DIR_PTR),Y
  STA ZP_SECTOR
  INY
  LDA (ZP_DIR_PTR),Y
  STA ZP_SECTOR+1

  ; Get file size from offset $0E-$0F
  LDY #$0E
  LDA (ZP_DIR_PTR),Y
  STA ZP_SIZE
  INY
  LDA (ZP_DIR_PTR),Y
  STA ZP_SIZE+1

  ; Load file into TEXT_BUF
  LDA #<TEXT_BUF
  STA ZP_BUFFER
  LDA #>TEXT_BUF
  STA ZP_BUFFER+1
  JSR $F200               ; DISK_READ
  BCS LAF_LOAD_FAIL

  ; Update text length
  LDA ZP_SIZE
  STA ZP_LEN_LO
  LDA ZP_SIZE+1
  STA ZP_LEN_HI
LAF_LOAD_FAIL:
  RTS

; ============================================================
; DISPLAY_TEXT - Display loaded text in editor window
; ============================================================
; Displays TEXT_BUF contents starting at row 1
; ============================================================
DISPLAY_TEXT:
  ; Position cursor at row 1, col 0
  LDA #$00
  LDX #$01
  JSR $F100               ; SET_CURSOR

  ; Print text from TEXT_BUF
  LDY #$00
  STY ZP_CUR_X
  STY ZP_CUR_Y
DT_LOOP:
  ; Check if we've printed all
  CPY ZP_LEN_LO
  BNE DT_PRINT
  LDA ZP_LEN_HI
  BEQ DT_DONE

DT_PRINT:
  LDA TEXT_BUF,Y
  BEQ DT_DONE             ; Null terminator
  CMP #$0A                ; LF
  BEQ DT_NEWLINE
  CMP #$0D                ; CR
  BEQ DT_NEWLINE

  ; Print character
  JSR $F000               ; PUTCHAR
  INC ZP_CUR_X
  LDA ZP_CUR_X
  CMP #SCREEN_COLS
  BCC DT_NEXT
  ; Wrap to next line
  LDA #$00
  STA ZP_CUR_X
  INC ZP_CUR_Y
  JMP DT_NEXT

DT_NEWLINE:
  JSR $F080               ; NEWLINE
  LDA #$00
  STA ZP_CUR_X
  INC ZP_CUR_Y

DT_NEXT:
  INY
  BNE DT_LOOP
  ; Handle >256 bytes (increment high byte pointer)
  ; For now, only handle first 256 bytes

DT_DONE:
  ; Position cursor at end of text
  JSR UPDATE_CURSOR
  RTS

; ============================================================
; SHOW_SAVE_PROMPT - Show "Save? (Y/N)" prompt
; ============================================================
SHOW_SAVE_PROMPT:
  ; Position at status line
  LDA #$00
  LDX #24
  JSR $F100               ; SET_CURSOR

  ; Print "Save? (Y/N): "
  LDA #$53                ; 'S'
  JSR $F000
  LDA #$61                ; 'a'
  JSR $F000
  LDA #$76                ; 'v'
  JSR $F000
  LDA #$65                ; 'e'
  JSR $F000
  LDA #$3F                ; '?'
  JSR $F000
  LDA #$20                ; ' '
  JSR $F000
  LDA #$28                ; '('
  JSR $F000
  LDA #$59                ; 'Y'
  JSR $F000
  LDA #$2F                ; '/'
  JSR $F000
  LDA #$4E                ; 'N'
  JSR $F000
  LDA #$29                ; ')'
  JSR $F000
  LDA #$3A                ; ':'
  JSR $F000
  LDA #$20                ; ' '
  JSR $F000

  RTS
