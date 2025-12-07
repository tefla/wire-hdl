// Simple WireOS Shell
// Loads at $0800 and provides basic command interface
// Commands: HELP, VER, HEX, MEM

import { assemble } from '../assembler/stage0.js';

export const SHELL_ENTRY = 0x0800;

// Shell assembly source - uses BIOS routines
export const SHELL_SOURCE = `
; ============================================================
; WireOS Shell - $0800
; ============================================================
; A simple command shell using BIOS routines.
; PUTCHAR=$F000, GETCHAR=$F040, NEWLINE=$F080
;
; Commands:
;   HELP - Show available commands
;   VER  - Show version
;   HEX  - Jump to hex loader
;   MEM  - Show memory info
; ============================================================

.ORG $0800

; ============================================================
; Entry point
; ============================================================
SHELL_START:
    ; Print welcome banner
    JSR PRINT_BANNER

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
; PRINT_PROMPT - Print "A> "
; ============================================================
PRINT_PROMPT:
    LDA #$41            ; 'A'
    JSR $F000
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
PARSE_CMD:
    LDA $02             ; Get length
    BEQ PC_DONE         ; Empty line

    ; Check for "HELP"
    LDA $0300
    CMP #$48            ; 'H'
    BNE PC_CHK_VER
    LDA $0301
    CMP #$45            ; 'E'
    BNE PC_CHK_VER
    LDA $0302
    CMP #$4C            ; 'L'
    BNE PC_CHK_VER
    LDA $0303
    CMP #$50            ; 'P'
    BNE PC_CHK_VER
    JMP CMD_HELP

PC_CHK_VER:
    ; Check for "VER"
    LDA $0300
    CMP #$56            ; 'V'
    BNE PC_CHK_HEX
    LDA $0301
    CMP #$45            ; 'E'
    BNE PC_CHK_HEX
    LDA $0302
    CMP #$52            ; 'R'
    BNE PC_CHK_HEX
    JMP CMD_VER

PC_CHK_HEX:
    ; Check for "HEX"
    LDA $0300
    CMP #$48            ; 'H'
    BNE PC_CHK_MEM
    LDA $0301
    CMP #$45            ; 'E'
    BNE PC_CHK_MEM
    LDA $0302
    CMP #$58            ; 'X'
    BNE PC_CHK_MEM
    JMP CMD_HEX

PC_CHK_MEM:
    ; Check for "MEM"
    LDA $0300
    CMP #$4D            ; 'M'
    BNE PC_UNKNOWN
    LDA $0301
    CMP #$45            ; 'E'
    BNE PC_UNKNOWN
    LDA $0302
    CMP #$4D            ; 'M'
    BNE PC_UNKNOWN
    JMP CMD_MEM

PC_UNKNOWN:
    ; Print "?"
    LDA #$3F            ; '?'
    JSR $F000
    JSR $F080           ; NEWLINE

PC_DONE:
    RTS

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
    ; "HELP VER HEX MEM"
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
`;

/**
 * Assemble the shell and return bytes
 */
export function assembleShell(): { bytes: Uint8Array; origin: number } {
  const result = assemble(SHELL_SOURCE);
  return {
    bytes: result.bytes,
    origin: SHELL_ENTRY,
  };
}

/**
 * Get shell as hex string for typing into hex loader
 */
export function getShellHex(): string {
  const { bytes } = assembleShell();
  return Array.from(bytes)
    .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ');
}

/**
 * Get shell bytes as array of hex pairs (for entering via hex loader)
 */
export function getShellHexPairs(): string[] {
  const { bytes } = assembleShell();
  return Array.from(bytes).map(b => b.toString(16).toUpperCase().padStart(2, '0'));
}
