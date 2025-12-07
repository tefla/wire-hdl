// EDIT.COM - Text Editor for WireOS
// Simple line-based text editor for the wire-hdl computer system

import { assemble } from '../assembler/stage0.js';

// Editor memory map
export const EDIT_MEM = {
  LOAD_ADDR: 0x0800,      // Editor code loads here
  TEXT_BUF: 0x2000,       // Text buffer start (16KB)
  TEXT_END: 0x5FFF,       // Text buffer end
  LINE_BUF: 0x0100,       // Line input buffer (256 bytes in stack page area)
  FILENAME: 0x0700,       // Filename buffer (16 bytes)
};

// Assembly source for the text editor
export const EDIT_SOURCE = `
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
`;

// Assemble the editor
export function assembleEdit(): { bytes: Uint8Array; startAddr: number } {
  const result = assemble(EDIT_SOURCE);
  return {
    bytes: result.bytes,
    startAddr: EDIT_MEM.LOAD_ADDR,
  };
}

// Get editor as sectors for floppy disk (512 bytes per sector)
export function getEditSectors(): Uint8Array[] {
  const { bytes } = assembleEdit();
  const sectors: Uint8Array[] = [];

  // Pad to sector boundary
  const paddedLength = Math.ceil(bytes.length / 512) * 512;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);

  // Split into sectors
  for (let i = 0; i < paddedLength; i += 512) {
    sectors.push(padded.slice(i, i + 512));
  }

  return sectors;
}
