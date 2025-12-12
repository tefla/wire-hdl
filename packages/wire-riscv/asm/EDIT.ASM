; EDIT.ASM - Text Editor for RISC-V
; ====================================
;
; MS-DOS EDIT-style text editor with cursor navigation and full-screen editing
;
; Memory Layout:
;   0x2000-0x2FFF: Text buffer structure (4KB)
;   0x3000-0x3FFF: Stack (4KB)
;   0x4000-0xBFFF: Heap for line storage (32KB)
;
; Text Buffer Structure (at 0x2000):
;   +0:  lineCount (word) - number of lines
;   +4:  capacity (word) - max lines
;   +8:  modified (word) - 1 if modified, 0 if not
;   +12: lines[0..capacity-1] (array of pointers to line strings)
;
; Cursor State (at 0x2100):
;   +0:  row (word) - current line (0-based)
;   +4:  col (word) - current column (0-based)
;   +8:  topLine (word) - first visible line (for scrolling)
;   +12: screenRows (word) - visible rows (24, leaving 1 for status)

; ==============================================================================
; CONSTANTS
; ==============================================================================

; Syscalls
EXIT        EQU 0
PUTCHAR     EQU 1
GETCHAR     EQU 2
PUTS        EQU 3
FOPEN       EQU 7
FREAD       EQU 8
FWRITE      EQU 9
FCLOSE      EQU 10

; Memory addresses
BUFFER_ADDR     EQU 0x2000
CURSOR_ADDR     EQU 0x2100
STACK_ADDR      EQU 0x4000
HEAP_START      EQU 0x4000

; Buffer offsets
BUF_LINE_COUNT      EQU 0
BUF_LINE_CAPACITY   EQU 4
BUF_MODIFIED        EQU 8
BUF_LINES           EQU 12

; Cursor offsets
CURSOR_ROW          EQU 0
CURSOR_COL          EQU 4
CURSOR_TOP_LINE     EQU 8
CURSOR_SCREEN_ROWS  EQU 12

; Screen dimensions
SCREEN_ROWS         EQU 24
SCREEN_COLS         EQU 80
STATUS_ROW          EQU 24

; Buffer configuration
INITIAL_CAPACITY    EQU 256
MAX_LINE_LENGTH     EQU 255

; ASCII codes
ASCII_ESC           EQU 0x1B
ASCII_LF            EQU 0x0A
ASCII_CR            EQU 0x0D
ASCII_SPACE         EQU 0x20

; Stack frame size
STACK_FRAME         EQU 16

; ==============================================================================
; MACROS
; ==============================================================================

.macro PUSH_FRAME
    ADDI sp, sp, -STACK_FRAME
    SW ra, 0(sp)
    SW s0, 4(sp)
    SW s1, 8(sp)
    SW s2, 12(sp)
.endmacro

.macro POP_FRAME
    LW ra, 0(sp)
    LW s0, 4(sp)
    LW s1, 8(sp)
    LW s2, 12(sp)
    ADDI sp, sp, STACK_FRAME
.endmacro

; ==============================================================================
; MAIN ENTRY POINT
; ==============================================================================

.text

main:
    ; Set up stack pointer
    LUI sp, STACK_ADDR>>12

    ; Initialize buffer
    LUI a0, BUFFER_ADDR>>12
    JAL ra, initBuffer

    ; Initialize cursor
    LUI a0, CURSOR_ADDR>>12
    JAL ra, initCursor

    ; Load test content
    JAL ra, loadTestContent

    ; Clear screen and show editor
    JAL ra, clearScreen
    JAL ra, drawScreen

    ; Enter main loop (for now, just exit)
    ADDI a7, zero, EXIT
    ADDI a0, zero, 0
    ECALL

; ==============================================================================
; BUFFER MANAGEMENT
; ==============================================================================

; Initialize text buffer
; Input: a0 = buffer address
initBuffer:
    SW zero, BUF_LINE_COUNT(a0)
    ADDI t0, zero, INITIAL_CAPACITY
    SW t0, BUF_LINE_CAPACITY(a0)
    SW zero, BUF_MODIFIED(a0)
    JALR zero, ra, 0

; Insert line at position
; Input: a0 = buffer, a1 = line number, a2 = text pointer
insertLine:
    PUSH_FRAME

    ; Save arguments
    ADDI s0, a0, 0      ; s0 = buffer
    ADDI s1, a1, 0      ; s1 = line number
    ADDI s2, a2, 0      ; s2 = text pointer

    ; Store text pointer: lines[line_num] = text
    ADDI t0, zero, BUF_LINES
    SLLI t1, s1, 2      ; line num * 4
    ADD t0, t0, t1      ; offset = BUF_LINES + (line_num * 4)
    ADD t0, s0, t0      ; address = buffer + offset
    SW s2, 0(t0)        ; store text pointer

    ; Increment line count
    LW t0, BUF_LINE_COUNT(s0)
    ADDI t0, t0, 1
    SW t0, BUF_LINE_COUNT(s0)

    ; Set modified flag
    ADDI t0, zero, 1
    SW t0, BUF_MODIFIED(s0)

    POP_FRAME
    JALR zero, ra, 0

; Get line pointer
; Input: a0 = buffer, a1 = line number
; Output: a0 = line pointer (or 0 if invalid)
getLine:
    ; Check if line number is valid
    LW t0, BUF_LINE_COUNT(a0)
    BGEU a1, t0, getLine_invalid

    ; Calculate offset: BUF_LINES + (line_num * 4)
    ADDI t0, zero, BUF_LINES
    SLLI t1, a1, 2
    ADD t0, t0, t1
    ADD t0, a0, t0

    ; Load line pointer
    LW a0, 0(t0)
    JALR zero, ra, 0

getLine_invalid:
    ADDI a0, zero, 0
    JALR zero, ra, 0

; Get line count
; Input: a0 = buffer
; Output: a0 = line count
getLineCount:
    LW a0, BUF_LINE_COUNT(a0)
    JALR zero, ra, 0

; ==============================================================================
; CURSOR MANAGEMENT
; ==============================================================================

; Initialize cursor
; Input: a0 = cursor address
initCursor:
    SW zero, CURSOR_ROW(a0)
    SW zero, CURSOR_COL(a0)
    SW zero, CURSOR_TOP_LINE(a0)
    ADDI t0, zero, SCREEN_ROWS
    SW t0, CURSOR_SCREEN_ROWS(a0)
    JALR zero, ra, 0

; Move cursor up
; Input: a0 = cursor address, a1 = buffer address
moveUp:
    PUSH_FRAME
    ADDI s0, a0, 0      ; s0 = cursor
    ADDI s1, a1, 0      ; s1 = buffer

    ; Load current row
    LW t0, CURSOR_ROW(s0)

    ; If row > 0, decrement
    BEQ t0, zero, moveUp_done
    ADDI t0, t0, -1
    SW t0, CURSOR_ROW(s0)

    ; Check if we need to scroll up
    LW t1, CURSOR_TOP_LINE(s0)
    BLT t0, t1, moveUp_scroll

moveUp_done:
    POP_FRAME
    JALR zero, ra, 0

moveUp_scroll:
    ; Scroll up by moving topLine down
    BEQ t1, zero, moveUp_done
    ADDI t1, t1, -1
    SW t1, CURSOR_TOP_LINE(s0)
    JAL zero, moveUp_done

; Move cursor down
; Input: a0 = cursor address, a1 = buffer address
moveDown:
    PUSH_FRAME
    ADDI s0, a0, 0      ; s0 = cursor
    ADDI s1, a1, 0      ; s1 = buffer

    ; Load current row and line count
    LW t0, CURSOR_ROW(s0)
    LW t1, BUF_LINE_COUNT(s1)

    ; If row < lineCount - 1, increment
    ADDI t1, t1, -1
    BGEU t0, t1, moveDown_done
    ADDI t0, t0, 1
    SW t0, CURSOR_ROW(s0)

    ; Check if we need to scroll down
    LW t1, CURSOR_TOP_LINE(s0)
    LW t2, CURSOR_SCREEN_ROWS(s0)
    ADD t2, t1, t2      ; bottom = topLine + screenRows
    ADDI t2, t2, -1
    ; BGT t0, t2 is same as BLT t2, t0
    BLT t2, t0, moveDown_scroll

moveDown_done:
    POP_FRAME
    JALR zero, ra, 0

moveDown_scroll:
    ; Scroll down by moving topLine up
    LW t1, CURSOR_TOP_LINE(s0)
    ADDI t1, t1, 1
    SW t1, CURSOR_TOP_LINE(s0)
    JAL zero, moveDown_done

; Move cursor left
; Input: a0 = cursor address
moveLeft:
    ; Load current column
    LW t0, CURSOR_COL(a0)

    ; If col > 0, decrement
    BEQ t0, zero, moveLeft_done
    ADDI t0, t0, -1
    SW t0, CURSOR_COL(a0)

moveLeft_done:
    JALR zero, ra, 0

; Move cursor right
; Input: a0 = cursor address, a1 = buffer address
moveRight:
    PUSH_FRAME
    ADDI s0, a0, 0      ; s0 = cursor
    ADDI s1, a1, 0      ; s1 = buffer

    ; Get current line
    LW a1, CURSOR_ROW(s0)
    ADDI a0, s1, 0
    JAL ra, getLine
    ADDI s2, a0, 0      ; s2 = line pointer

    ; If line is NULL, don't move
    BEQ s2, zero, moveRight_done

    ; Get line length
    ADDI a0, s2, 0
    JAL ra, strlen
    ADDI t1, a0, 0      ; t1 = line length

    ; Load current column
    LW t0, CURSOR_COL(s0)

    ; If col < length, increment
    BGEU t0, t1, moveRight_done
    ADDI t0, t0, 1
    SW t0, CURSOR_COL(s0)

moveRight_done:
    POP_FRAME
    JALR zero, ra, 0

; Move cursor to start of line (Home)
; Input: a0 = cursor address
moveHome:
    SW zero, CURSOR_COL(a0)
    JALR zero, ra, 0

; Move cursor to end of line (End)
; Input: a0 = cursor address, a1 = buffer address
moveEnd:
    PUSH_FRAME
    ADDI s0, a0, 0      ; s0 = cursor
    ADDI s1, a1, 0      ; s1 = buffer

    ; Get current line
    LW a1, CURSOR_ROW(s0)
    ADDI a0, s1, 0
    JAL ra, getLine
    ADDI s2, a0, 0      ; s2 = line pointer

    ; If line is NULL, set col to 0
    BEQ s2, zero, moveEnd_zero

    ; Get line length
    ADDI a0, s2, 0
    JAL ra, strlen

    ; Set column to line length
    SW a0, CURSOR_COL(s0)

    POP_FRAME
    JALR zero, ra, 0

moveEnd_zero:
    SW zero, CURSOR_COL(s0)
    JAL zero, moveEnd_done

moveEnd_done:
    POP_FRAME
    JALR zero, ra, 0

; Move cursor up one page
; Input: a0 = cursor address, a1 = buffer address
pageUp:
    PUSH_FRAME
    ADDI s0, a0, 0      ; s0 = cursor

    LW t0, CURSOR_SCREEN_ROWS(s0)
    ADDI s1, t0, 0      ; s1 = count

pageUp_loop:
    BEQ s1, zero, pageUp_done
    ADDI a0, s0, 0
    ADDI a1, a1, 0
    JAL ra, moveUp
    ADDI s1, s1, -1
    JAL zero, pageUp_loop

pageUp_done:
    POP_FRAME
    JALR zero, ra, 0

; Move cursor down one page
; Input: a0 = cursor address, a1 = buffer address
pageDown:
    PUSH_FRAME
    ADDI s0, a0, 0      ; s0 = cursor

    LW t0, CURSOR_SCREEN_ROWS(s0)
    ADDI s1, t0, 0      ; s1 = count

pageDown_loop:
    BEQ s1, zero, pageDown_done
    ADDI a0, s0, 0
    ADDI a1, a1, 0
    JAL ra, moveDown
    ADDI s1, s1, -1
    JAL zero, pageDown_loop

pageDown_done:
    POP_FRAME
    JALR zero, ra, 0

; ==============================================================================
; SCREEN DRAWING
; ==============================================================================

; Clear screen
clearScreen:
    PUSH_FRAME

    ; Output clear screen sequence
    LUI a0, 0x1000
    ; Calculate offset to str_clear
    ; We need to find where str_clear is in the data section
    ADDI a0, a0, 0      ; str_clear at data offset 0
    ADDI a7, zero, PUTS
    ECALL

    ; Move cursor to home
    LUI a0, 0x1000
    ADDI a0, a0, 5      ; str_home after str_clear (5 bytes)
    ADDI a7, zero, PUTS
    ECALL

    POP_FRAME
    JALR zero, ra, 0

; Draw entire screen
; Reads from buffer and cursor, draws visible lines
drawScreen:
    PUSH_FRAME

    ; Load cursor and buffer addresses
    LUI s0, CURSOR_ADDR>>12     ; s0 = cursor
    LUI s1, BUFFER_ADDR>>12     ; s1 = buffer

    ; Get topLine and screenRows
    LW s2, CURSOR_TOP_LINE(s0)  ; s2 = topLine
    LW s3, CURSOR_SCREEN_ROWS(s0) ; s3 = screenRows

    ; Get line count
    LW s4, BUF_LINE_COUNT(s1)   ; s4 = lineCount

    ; Loop through visible lines
    ADDI t0, zero, 0            ; t0 = row counter

drawScreen_loop:
    BGE t0, s3, drawScreen_done
    ADD t1, s2, t0              ; t1 = line number = topLine + row

    ; Check if line exists
    BGEU t1, s4, drawScreen_empty

    ; Get line
    ADDI a0, s1, 0
    ADDI a1, t1, 0
    JAL ra, getLine
    ADDI a1, a0, 0              ; a1 = line pointer

    ; If line is NULL, draw empty
    BEQ a1, zero, drawScreen_empty

    ; Draw line
    ADDI a0, a1, 0
    ADDI a7, zero, PUTS
    ECALL

    ; Print newline
    ADDI a0, zero, ASCII_LF
    ADDI a7, zero, PUTCHAR
    ECALL

    ADDI t0, t0, 1
    JAL zero, drawScreen_loop

drawScreen_empty:
    ; Print newline for empty line
    ADDI a0, zero, ASCII_LF
    ADDI a7, zero, PUTCHAR
    ECALL

    ADDI t0, t0, 1
    JAL zero, drawScreen_loop

drawScreen_done:
    POP_FRAME
    JALR zero, ra, 0

; ==============================================================================
; UTILITY FUNCTIONS
; ==============================================================================

; Get string length
; Input: a0 = string pointer
; Output: a0 = length
strlen:
    ADDI t0, zero, 0            ; t0 = length counter
    ADDI t1, a0, 0              ; t1 = current position

strlen_loop:
    LBU t2, 0(t1)
    BEQ t2, zero, strlen_done
    ADDI t0, t0, 1
    ADDI t1, t1, 1
    JAL zero, strlen_loop

strlen_done:
    ADDI a0, t0, 0
    JALR zero, ra, 0

; ==============================================================================
; TEST CONTENT LOADER
; ==============================================================================

; Load test content into buffer
loadTestContent:
    PUSH_FRAME

    LUI s0, BUFFER_ADDR>>12     ; s0 = buffer

    ; Calculate data section offsets
    ; str_clear (5), str_home (4), str_hide_cursor (7), str_show_cursor (7),
    ; str_reset (5), str_reverse (5), str_move_fmt (3)
    ; msg_welcome (23), msg_empty (16)
    ; = 75 bytes before test lines

    ; Insert line 0
    ADDI a0, s0, 0
    ADDI a1, zero, 0
    LUI a2, 0x1000
    ADDI a2, a2, 75             ; test_line_1 offset
    JAL ra, insertLine

    ; Insert line 1
    ADDI a0, s0, 0
    ADDI a1, zero, 1
    LUI a2, 0x1000
    ADDI a2, a2, 129            ; test_line_2 offset (75 + 54)
    JAL ra, insertLine

    ; Insert line 2
    ADDI a0, s0, 0
    ADDI a1, zero, 2
    LUI a2, 0x1000
    ADDI a2, a2, 173            ; test_line_3 offset (129 + 44)
    JAL ra, insertLine

    ; Insert line 3
    ADDI a0, s0, 0
    ADDI a1, zero, 3
    LUI a2, 0x1000
    ADDI a2, a2, 207            ; test_line_4 offset (173 + 34)
    JAL ra, insertLine

    ; Insert line 4
    ADDI a0, s0, 0
    ADDI a1, zero, 4
    LUI a2, 0x1000
    ADDI a2, a2, 244            ; test_line_5 offset (207 + 37)
    JAL ra, insertLine

    POP_FRAME
    JALR zero, ra, 0

; ==============================================================================
; DATA SECTION
; ==============================================================================

.data

; ANSI escape sequences
str_clear:      .string "\x1b[2J"           ; Clear screen
str_home:       .string "\x1b[H"            ; Move cursor to home
str_hide_cursor:.string "\x1b[?25l"         ; Hide cursor
str_show_cursor:.string "\x1b[?25h"         ; Show cursor
str_reset:      .string "\x1b[0m"           ; Reset attributes
str_reverse:    .string "\x1b[7m"           ; Reverse video
str_move_fmt:   .string "\x1b["             ; Start of move cursor sequence

; Welcome message
msg_welcome:    .string "EDIT v1.0 - Text Editor\n"
msg_empty:      .string "[Empty Buffer]\n"

; Test line data
test_line_1:    .string "Line 1: The quick brown fox jumps over the lazy dog"
test_line_2:    .string "Line 2: RISC-V Text Editor Implementation"
test_line_3:    .string "Line 3: Testing cursor navigation"
test_line_4:    .string "Line 4: Arrow keys should move cursor"
test_line_5:    .string "Line 5: Home/End keys move to line start/end"
