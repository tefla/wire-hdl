// Hex Loader ROM for Wire-HDL Computer
// A minimal monitor for entering and running machine code
//
// Commands:
//   L xxxx - Set load address to $xxxx
//   D xxxx - Dump 16 bytes starting at $xxxx
//   E      - Execute at load address
//   R      - Reset load address to $0200
//   ?      - Show help
//   xx xx  - Enter hex bytes (stored at load address, auto-increments)
//
// Located at $F800-$FEFF in ROM (uses BIOS routines for I/O)

import { assemble } from '../assembler/stage0.js';

// Hex loader zero page variables ($F0-$FF)
export const HEX_LOADER_ZP = {
  LOAD_LO: 0xf0,      // Load address low byte
  LOAD_HI: 0xf1,      // Load address high byte
  INPUT_BUF: 0xf2,    // Input buffer (16 bytes: $F2-$01)
  INPUT_LEN: 0x02,    // Input length (at $02, after buffer wraps)
  TEMP: 0x03,         // Temp storage
  TEMP2: 0x04,        // Temp storage 2
};

// Hex loader entry point
export const HEX_LOADER_ENTRY = 0xf800;

// Assembly source for the hex loader
export const HEX_LOADER_SOURCE = `
; ============================================================
; Hex Loader Monitor - $F800
; ============================================================
; A minimal monitor for entering machine code by typing hex.
; Uses BIOS routines: PUTCHAR ($F000), GETCHAR ($F040), NEWLINE ($F080)
;
; Zero Page Usage:
;   $F0-$F1   Load address (little-endian)
;   $F2-$01   Input buffer (16 bytes, wraps into page zero)
;   $02       Input length
;   $03-$04   Temp storage
;
; Commands:
;   L xxxx  - Set load address
;   D xxxx  - Dump 16 bytes
;   E       - Execute at load address
;   R       - Reset load address to $0200
;   ?       - Help
;   xx      - Enter hex byte
; ============================================================

.ORG $F800

; ============================================================
; Entry point - initialize and show prompt
; ============================================================
HEX_ENTRY:
    ; Initialize load address to $0200
    LDA #$00
    STA $F0             ; LOAD_LO
    LDA #$02
    STA $F1             ; LOAD_HI

    ; Print welcome
    JSR PRINT_WELCOME

; Main loop
MAIN_LOOP:
    JSR PRINT_PROMPT    ; Print "> "
    JSR READ_LINE       ; Read input line
    JSR PARSE_LINE      ; Parse and execute
    JMP MAIN_LOOP

; ============================================================
; PRINT_WELCOME - Print startup message
; ============================================================
PRINT_WELCOME:
    ; Print "HEX v1"
    LDA #$48            ; 'H'
    JSR $F000
    LDA #$45            ; 'E'
    JSR $F000
    LDA #$58            ; 'X'
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
; PRINT_PROMPT - Print "> " prompt
; ============================================================
PRINT_PROMPT:
    LDA #$3E            ; '>'
    JSR $F000
    LDA #$20            ; ' '
    JSR $F000
    RTS

; ============================================================
; READ_LINE - Read a line of input into buffer at $F2
; Returns length in $02
; ============================================================
READ_LINE:
    LDX #$00            ; Buffer index
READ_LOOP:
    JSR $F040           ; GETCHAR
    CMP #$0D            ; Enter?
    BEQ READ_DONE
    CMP #$08            ; Backspace?
    BEQ READ_BS
    CMP #$7F            ; Delete?
    BEQ READ_BS
    CPX #$0F            ; Buffer full?
    BEQ READ_LOOP       ; Ignore if full
    STA $F2,X           ; Store char
    INX
    JSR $F000           ; Echo char
    JMP READ_LOOP
READ_BS:
    CPX #$00            ; At start?
    BEQ READ_LOOP
    DEX
    LDA #$08            ; Backspace
    JSR $F000
    LDA #$20            ; Space
    JSR $F000
    LDA #$08            ; Backspace
    JSR $F000
    JMP READ_LOOP
READ_DONE:
    STX $02             ; Store length
    LDA #$00
    STA $F2,X           ; Null terminate
    JSR $F080           ; NEWLINE
    RTS

; ============================================================
; PARSE_LINE - Parse input and execute command
; ============================================================
PARSE_LINE:
    LDA $02             ; Get length
    BEQ PARSE_DONE      ; Empty line

    LDA $F2             ; Get first char

    ; Check for commands (uppercase)
    CMP #$4C            ; 'L' - Load address
    BEQ CMD_LOAD
    CMP #$6C            ; 'l' - Load address (lowercase)
    BEQ CMD_LOAD
    CMP #$44            ; 'D' - Dump
    BEQ CMD_DUMP
    CMP #$64            ; 'd' - Dump (lowercase)
    BEQ CMD_DUMP
    CMP #$45            ; 'E' - Execute
    BEQ CMD_EXEC
    CMP #$65            ; 'e' - Execute (lowercase)
    BEQ CMD_EXEC
    CMP #$52            ; 'R' - Reset
    BEQ CMD_RESET
    CMP #$72            ; 'r' - Reset (lowercase)
    BEQ CMD_RESET
    CMP #$3F            ; '?' - Help
    BEQ CMD_HELP

    ; Otherwise try to parse as hex bytes
    JMP PARSE_HEX_BYTES

PARSE_DONE:
    RTS

; ============================================================
; CMD_LOAD - Set load address (L xxxx)
; ============================================================
CMD_LOAD:
    ; Skip 'L' and spaces
    LDA #$02            ; Start at index 2 (skip "L ")
    STA $03             ; Parse index
    JSR PARSE_ADDR      ; Parse address into $F0/$F1
    JSR PRINT_ADDR      ; Echo the address
    RTS

; ============================================================
; CMD_DUMP - Dump 16 bytes (D xxxx)
; ============================================================
CMD_DUMP:
    ; Parse address if provided
    LDA $02             ; Length
    CMP #$02            ; Just "D"?
    BCC DUMP_CUR        ; Use current load address
    LDA #$02
    STA $03
    JSR PARSE_ADDR      ; Parse into $F0/$F1
DUMP_CUR:
    ; Print address
    JSR PRINT_ADDR
    LDA #$3A            ; ':'
    JSR $F000
    LDA #$20            ; ' '
    JSR $F000

    ; Dump 16 bytes
    LDY #$00
DUMP_LOOP:
    LDA ($F0),Y         ; Load byte (indirect indexed!)
    JSR PRINT_HEX       ; Print as hex
    LDA #$20            ; ' '
    JSR $F000
    INY
    CPY #$10            ; 16 bytes?
    BNE DUMP_LOOP

    JSR $F080           ; NEWLINE

    ; Advance load address by 16
    CLC
    LDA $F0
    ADC #$10
    STA $F0
    LDA $F1
    ADC #$00
    STA $F1
    RTS

; ============================================================
; CMD_EXEC - Execute at load address (E)
; ============================================================
CMD_EXEC:
    ; Print "GO "
    LDA #$47            ; 'G'
    JSR $F000
    LDA #$4F            ; 'O'
    JSR $F000
    LDA #$20            ; ' '
    JSR $F000
    JSR PRINT_ADDR
    JSR $F080           ; NEWLINE

    ; Jump to load address via indirect jump
    JMP ($00F0)

; ============================================================
; CMD_RESET - Reset load address to $0200 (R)
; ============================================================
CMD_RESET:
    LDA #$00
    STA $F0
    LDA #$02
    STA $F1
    JSR PRINT_ADDR
    RTS

; ============================================================
; CMD_HELP - Show help (?)
; ============================================================
CMD_HELP:
    ; Print help text
    ; L xxxx
    LDA #$4C
    JSR $F000
    LDA #$20
    JSR $F000
    LDA #$61            ; 'a'
    JSR $F000
    LDA #$64            ; 'd'
    JSR $F000
    LDA #$64            ; 'd'
    JSR $F000
    LDA #$72            ; 'r'
    JSR $F000
    JSR $F080
    ; D dump
    LDA #$44
    JSR $F000
    LDA #$20
    JSR $F000
    LDA #$64            ; 'd'
    JSR $F000
    LDA #$75            ; 'u'
    JSR $F000
    LDA #$6D            ; 'm'
    JSR $F000
    LDA #$70            ; 'p'
    JSR $F000
    JSR $F080
    ; E exec
    LDA #$45
    JSR $F000
    LDA #$20
    JSR $F000
    LDA #$65            ; 'e'
    JSR $F000
    LDA #$78            ; 'x'
    JSR $F000
    LDA #$65            ; 'e'
    JSR $F000
    LDA #$63            ; 'c'
    JSR $F000
    JSR $F080
    ; R reset
    LDA #$52
    JSR $F000
    LDA #$20
    JSR $F000
    LDA #$72            ; 'r'
    JSR $F000
    LDA #$65            ; 'e'
    JSR $F000
    LDA #$73            ; 's'
    JSR $F000
    LDA #$65            ; 'e'
    JSR $F000
    LDA #$74            ; 't'
    JSR $F000
    JSR $F080
    RTS

; ============================================================
; PARSE_HEX_BYTES - Parse and store hex bytes
; ============================================================
PARSE_HEX_BYTES:
    LDA #$00
    STA $03             ; Parse index
PHB_LOOP:
    ; Skip spaces
    LDX $03
    LDA $F2,X
    BEQ PHB_DONE        ; End of input
    CMP #$20            ; Space?
    BNE PHB_PARSE
    INC $03
    JMP PHB_LOOP
PHB_PARSE:
    ; Parse two hex digits
    JSR PARSE_BYTE      ; Result in A
    BCS PHB_ERROR       ; Error?

    ; Store at load address
    LDY #$00
    STA ($F0),Y         ; Store byte

    ; Print confirmation
    JSR PRINT_ADDR
    LDA #$3A            ; ':'
    JSR $F000
    LDA #$20            ; ' '
    JSR $F000
    LDY #$00
    LDA ($F0),Y
    JSR PRINT_HEX
    JSR $F080           ; NEWLINE

    ; Increment load address
    INC $F0
    BNE PHB_LOOP
    INC $F1
    JMP PHB_LOOP

PHB_DONE:
    RTS

PHB_ERROR:
    LDA #$3F            ; '?'
    JSR $F000
    JSR $F080
    RTS

; ============================================================
; PARSE_ADDR - Parse 4-digit hex address from input
; Input: $03 = parse index
; Output: $F0/$F1 = address
; ============================================================
PARSE_ADDR:
    ; Skip leading spaces
PA_SKIP:
    LDX $03
    LDA $F2,X
    BEQ PA_DONE         ; End of input
    CMP #$20            ; Space?
    BNE PA_HI
    INC $03
    JMP PA_SKIP

PA_HI:
    ; Parse high byte
    JSR PARSE_BYTE
    BCS PA_ERROR
    STA $F1             ; Store high byte

PA_LO:
    ; Parse low byte
    JSR PARSE_BYTE
    BCS PA_ERROR
    STA $F0             ; Store low byte

PA_DONE:
    CLC
    RTS

PA_ERROR:
    SEC
    RTS

; ============================================================
; PARSE_BYTE - Parse two hex digits from input
; Input: $03 = parse index into $F2 buffer
; Output: A = byte value, C=0 on success, C=1 on error
; Side effect: $03 advanced by 2
; ============================================================
PARSE_BYTE:
    ; Get first digit
    LDX $03
    LDA $F2,X
    JSR HEX_DIGIT       ; Convert to 0-15
    BCS PB_ERROR
    ASL A               ; Shift to high nibble
    ASL A
    ASL A
    ASL A
    STA $04             ; Save high nibble

    ; Get second digit
    INC $03
    LDX $03
    LDA $F2,X
    JSR HEX_DIGIT
    BCS PB_ERROR
    ORA $04             ; Combine with high nibble

    INC $03             ; Advance past second digit
    CLC
    RTS

PB_ERROR:
    SEC
    RTS

; ============================================================
; HEX_DIGIT - Convert ASCII hex char to value
; Input: A = ASCII char ('0'-'9', 'A'-'F', 'a'-'f')
; Output: A = 0-15, C=0 on success; C=1 on error
; ============================================================
HEX_DIGIT:
    CMP #$30            ; < '0'?
    BCC HD_ERROR
    CMP #$3A            ; <= '9'?
    BCC HD_DIGIT
    CMP #$41            ; < 'A'?
    BCC HD_ERROR
    CMP #$47            ; <= 'F'?
    BCC HD_UPPER
    CMP #$61            ; < 'a'?
    BCC HD_ERROR
    CMP #$67            ; <= 'f'?
    BCS HD_ERROR
    ; 'a'-'f'
    SEC
    SBC #$57            ; 'a' - 10 = $57
    CLC
    RTS
HD_DIGIT:
    ; '0'-'9'
    SEC
    SBC #$30
    CLC
    RTS
HD_UPPER:
    ; 'A'-'F'
    SEC
    SBC #$37            ; 'A' - 10 = $37
    CLC
    RTS
HD_ERROR:
    SEC
    RTS

; ============================================================
; PRINT_HEX - Print byte in A as two hex digits
; ============================================================
PRINT_HEX:
    PHA                 ; Save byte
    ; High nibble
    LSR A
    LSR A
    LSR A
    LSR A
    JSR PRINT_NIBBLE
    ; Low nibble
    PLA
    AND #$0F
    JSR PRINT_NIBBLE
    RTS

; ============================================================
; PRINT_NIBBLE - Print low nibble of A as hex char
; ============================================================
PRINT_NIBBLE:
    CMP #$0A
    BCC PN_DIGIT
    ; A-F
    CLC
    ADC #$37            ; 'A' - 10
    JMP PN_OUT
PN_DIGIT:
    ; 0-9
    CLC
    ADC #$30            ; '0'
PN_OUT:
    JSR $F000           ; PUTCHAR
    RTS

; ============================================================
; PRINT_ADDR - Print address at $F0/$F1
; ============================================================
PRINT_ADDR:
    LDA $F1             ; High byte
    JSR PRINT_HEX
    LDA $F0             ; Low byte
    JSR PRINT_HEX
    RTS

; ============================================================
; End of Hex Loader
; ============================================================
`;

/**
 * Assemble the hex loader and return the bytes
 */
export function assembleHexLoader(): { bytes: Uint8Array; origin: number } {
  const result = assemble(HEX_LOADER_SOURCE);
  return {
    bytes: result.bytes,
    origin: HEX_LOADER_ENTRY,
  };
}

/**
 * Generate a hex dump of the assembled hex loader for manual entry
 */
export function hexDump(bytes: Uint8Array, origin: number, bytesPerLine = 16): string {
  const lines: string[] = [];
  for (let i = 0; i < bytes.length; i += bytesPerLine) {
    const addr = (origin + i).toString(16).toUpperCase().padStart(4, '0');
    const hex = Array.from(bytes.slice(i, i + bytesPerLine))
      .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
      .join(' ');
    lines.push(`${addr}: ${hex}`);
  }
  return lines.join('\n');
}

/**
 * Create ROM image with hex loader integrated
 * Combines BIOS ($F000-$F7FF) with Hex Loader ($F800-$FEFF)
 */
export function createHexLoaderRom(): Uint8Array {
  const rom = new Uint8Array(0x4000); // 16KB ROM ($C000-$FFFF)
  rom.fill(0xff); // Fill with $FF (like unprogrammed EPROM)

  const { bytes, origin } = assembleHexLoader();

  // Copy hex loader to ROM
  const romOffset = origin - 0xc000;
  for (let i = 0; i < bytes.length && romOffset + i < rom.length; i++) {
    rom[romOffset + i] = bytes[i];
  }

  // Set reset vector to hex loader entry
  rom[0x3ffc] = HEX_LOADER_ENTRY & 0xff;        // $FFFC low byte
  rom[0x3ffd] = (HEX_LOADER_ENTRY >> 8) & 0xff; // $FFFD high byte

  return rom;
}

// Export for testing
export { HEX_LOADER_SOURCE as source };
