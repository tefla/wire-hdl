// BIOS for wire-hdl Computer System
// Provides basic I/O routines: PUTCHAR, GETCHAR, screen init
// Located in ROM at $F000-$FFFF
// Font ROM at $E000-$E7FF (2KB)

import { assemble } from './stage0.js';
import { DEFAULT_FONT } from '../web/font.js';

// BIOS entry points (fixed addresses for application use)
export const BIOS = {
  PUTCHAR: 0xF000,    // Write character in A to screen
  GETCHAR: 0xF040,    // Wait for keypress, return in A
  NEWLINE: 0xF080,    // Move cursor to start of next line
  INIT: 0xF0C0,       // Initialize BIOS (called at reset)
  SET_CURSOR: 0xF100, // Set cursor position (A=X, X=Y)
  GET_CURSOR: 0xF120, // Get cursor position (returns A=X, X=Y)
  CLEAR_SCREEN: 0xF140, // Clear screen and home cursor
  DISK_READ: 0xF200,  // Read sector ($30-$31=sector, $32-$33=buffer)
  DISK_WRITE: 0xF240, // Write sector ($30-$31=sector, $32-$33=buffer)
  SHELL_RELOAD: 0xF280, // Reload shell from disk and jump to it
  ENTRY: 0xFF00,      // Reset entry point
  FONT_ROM: 0xE000,   // Font data (256 chars x 8 bytes)
};

// Zero page locations for disk I/O parameters
export const DISK_ZP = {
  SECTOR_LO: 0x30,    // Sector number low byte
  SECTOR_HI: 0x31,    // Sector number high byte
  BUFFER_LO: 0x32,    // Buffer address low byte
  BUFFER_HI: 0x33,    // Buffer address high byte
};

// Disk I/O register addresses
export const DISK_IO = {
  STATUS: 0x8020,     // bit 0=ready, bit 1=busy, bit 7=error
  CMD: 0x8021,        // 1=read, 2=write
  SEC_LO: 0x8022,     // Sector number low
  SEC_HI: 0x8023,     // Sector number high
  BUF_LO: 0x8024,     // Buffer address low
  BUF_HI: 0x8025,     // Buffer address high
  COUNT: 0x8026,      // Sector count
};


// BIOS source code in assembly
// Simplified for the wire-hdl CPU which only has immediate and absolute addressing
export const BIOS_SOURCE = `
; ============================================================
; BIOS - Basic Input/Output System for wire-hdl Computer
; ============================================================
; This BIOS uses only immediate and absolute addressing modes
; since the wire-hdl CPU doesn't have indirect modes.
;
; Characters are output to serial port ($8031) which is the
; simplest approach without indirect addressing.
;
; BIOS Routines:
;   PUTCHAR ($F000) - Output character in A to serial
;   GETCHAR ($F040) - Wait for and return key in A
;   NEWLINE ($F080) - Output newline (CR+LF)
;   INIT    ($F0C0) - Initialize BIOS
;   ENTRY   ($FF00) - Reset entry point
; ============================================================

.ORG $F000

; ============================================================
; PUTCHAR - Output character to serial port
; Input:  A = character to output
; Output: None
; ============================================================
PUTCHAR:
  STA $8031           ; Write to serial port
  RTS

; Padding to align GETCHAR at $F040
.ORG $F040

; ============================================================
; GETCHAR - Wait for keypress and return character
; Input:  None
; Output: A = character read
; Clobbers: None (A has result)
; ============================================================
GETCHAR:
  LDA $8010           ; Keyboard status
  AND #$01            ; Key available?
  BEQ GETCHAR         ; No, keep waiting
  LDA $8011           ; Read key data
  PHA                 ; Save key
  LDA #$00
  STA $8011           ; Clear key data (signals we consumed it)
  PLA                 ; Restore key
  RTS

; Padding to align NEWLINE at $F080
.ORG $F080

; ============================================================
; NEWLINE - Output carriage return and line feed
; ============================================================
NEWLINE:
  LDA #$0D            ; Carriage return
  STA $8031
  LDA #$0A            ; Line feed
  STA $8031
  RTS

; Padding to align INIT at $F0C0
.ORG $F0C0

; ============================================================
; INIT - Initialize BIOS
; Called once at reset
; ============================================================
INIT:
  ; Initialize stack pointer
  LDX #$FF
  TXS
  RTS

; ============================================================
; Reset Entry Point
; ============================================================
.ORG $FF00

ENTRY:
  ; Initialize stack pointer inline (can't JSR before stack is set up!)
  LDX #$FF
  TXS

  ; Print startup message "WIRE OK" + newline
  LDA #$57            ; 'W'
  JSR PUTCHAR
  LDA #$49            ; 'I'
  JSR PUTCHAR
  LDA #$52            ; 'R'
  JSR PUTCHAR
  LDA #$45            ; 'E'
  JSR PUTCHAR
  LDA #$20            ; ' '
  JSR PUTCHAR
  LDA #$4F            ; 'O'
  JSR PUTCHAR
  LDA #$4B            ; 'K'
  JSR PUTCHAR
  JSR NEWLINE

  ; Simple echo loop: read char, print it
ECHO_LOOP:
  JSR GETCHAR         ; Wait for key
  JSR PUTCHAR         ; Echo it back
  JMP ECHO_LOOP       ; Repeat forever
`;

// Assemble the BIOS by assembling each section separately
export function assembleBios(): Uint8Array {
  // Create full ROM image (16KB from $C000-$FFFF)
  const romSize = 0x4000; // 16KB
  const rom = new Uint8Array(romSize);

  // Fill with HLT instructions (0x02) as safety
  rom.fill(0x02);

  // Assemble each section separately to handle multiple .ORGs
  const sections = [
    // PUTCHAR at $F000
    { origin: 0xF000, code: `
      .ORG $F000
      PUTCHAR:
        STA $8031
        RTS
    ` },
    // GETCHAR at $F040
    { origin: 0xF040, code: `
      .ORG $F040
      GETCHAR:
        LDA $8010
        AND #$01
        BEQ GETCHAR
        LDA $8011
        PHA
        LDA #$00
        STA $8011
        PLA
        RTS
    ` },
    // NEWLINE at $F080
    { origin: 0xF080, code: `
      .ORG $F080
      NEWLINE:
        LDA #$0D
        STA $8031
        LDA #$0A
        STA $8031
        RTS
    ` },
    // INIT at $F0C0
    { origin: 0xF0C0, code: `
      .ORG $F0C0
      INIT:
        LDX #$FF
        TXS
        RTS
    ` },
    // SET_CURSOR at $F100
    // Input: A = column (0-79), X = row (0-24)
    { origin: 0xF100, code: `
      .ORG $F100
      SET_CURSOR:
        STA $8051           ; CURSOR_X
        STX $8052           ; CURSOR_Y
        RTS
    ` },
    // GET_CURSOR at $F120
    // Output: A = column (0-79), X = row (0-24)
    { origin: 0xF120, code: `
      .ORG $F120
      GET_CURSOR:
        LDA $8051           ; CURSOR_X
        LDX $8052           ; CURSOR_Y
        RTS
    ` },
    // CLEAR_SCREEN at $F140
    // Clears screen and homes cursor
    // Uses zero page $34-$35 as temp pointer
    { origin: 0xF140, code: `
      .ORG $F140
      CLEAR_SCREEN:
        ; Set cursor to 0,0
        LDA #$00
        STA $8051           ; CURSOR_X = 0
        STA $8052           ; CURSOR_Y = 0
        ; Clear character area using unrolled loop
        ; VRAM chars at $8100, 2000 bytes
        ; We'll clear in 8 iterations of 250 bytes each (2000 total)
        LDX #$00
        LDA #$20            ; Space character
      CLR_LOOP:
        STA $8100,X
        STA $8200,X
        STA $8300,X
        STA $8400,X
        STA $8500,X
        STA $8600,X
        STA $8700,X
        INX
        BNE CLR_LOOP
        ; Clear remaining 232 bytes ($8100-$87D0 = 1744, we did 1792)
        ; Actually text chars are 2000 bytes, but 7*256=1792, need $87D0-$8100=0x6D0=1744
        ; Let me just clear the attr area too
        LDA #$07            ; Default attr (light gray on black)
      CLR_ATTR:
        STA $87D0,X
        STA $88D0,X
        STA $89D0,X
        STA $8AD0,X
        STA $8BD0,X
        STA $8CD0,X
        STA $8DD0,X
        INX
        BNE CLR_ATTR
        RTS
    ` },
    // DISK_READ at $F200
    // Input: $30-$31 = sector, $32-$33 = buffer address
    // Output: Carry clear on success, set on error
    { origin: 0xF200, code: `
      .ORG $F200
      DISK_READ:
        LDA $30
        STA $8022           ; sector low
        LDA $31
        STA $8023           ; sector high
        LDA $32
        STA $8024           ; buffer low
        LDA $33
        STA $8025           ; buffer high
        LDA #$01
        STA $8026           ; count = 1 sector
        LDA #$01
        STA $8021           ; cmd = read
      DISK_READ_WAIT:
        LDA $8020           ; status
        AND #$02            ; busy?
        BNE DISK_READ_WAIT
        LDA $8020
        AND #$80            ; error?
        BNE DISK_READ_ERR
        CLC                 ; success
        RTS
      DISK_READ_ERR:
        SEC                 ; error
        RTS
    ` },
    // DISK_WRITE at $F240
    // Input: $30-$31 = sector, $32-$33 = buffer address
    // Output: Carry clear on success, set on error
    { origin: 0xF240, code: `
      .ORG $F240
      DISK_WRITE:
        LDA $30
        STA $8022           ; sector low
        LDA $31
        STA $8023           ; sector high
        LDA $32
        STA $8024           ; buffer low
        LDA $33
        STA $8025           ; buffer high
        LDA #$01
        STA $8026           ; count = 1 sector
        LDA #$02
        STA $8021           ; cmd = write
      DISK_WRITE_WAIT:
        LDA $8020           ; status
        AND #$02            ; busy?
        BNE DISK_WRITE_WAIT
        LDA $8020
        AND #$80            ; error?
        BNE DISK_WRITE_ERR
        CLC                 ; success
        RTS
      DISK_WRITE_ERR:
        SEC                 ; error
        RTS
    ` },
    // SHELL_RELOAD at $F280
    // Reloads shell from disk and jumps to it
    // Used after programs exit to restore shell (CP/M-style overlay)
    // Boot sector layout: offset 6 = shell start sector, offset 7 = sector count
    { origin: 0xF280, code: `
      .ORG $F280
      SHELL_RELOAD:
        ; Read boot sector (sector 0) to get shell location info
        LDA #$00
        STA $30             ; sector low = 0
        STA $31             ; sector high = 0
        STA $32             ; buffer low = $00
        LDA #$04
        STA $33             ; buffer high = $04 ($0400)
        JSR $F200           ; DISK_READ

        ; Get shell info from boot sector
        ; $0406 = shell start sector, $0407 = shell sector count
        LDA $0406
        STA $30             ; shell start sector
        LDA #$00
        STA $31             ; sector high = 0
        LDA $0407
        STA $3A             ; sector count

        ; Load shell to $7000
        LDA #$00
        STA $32             ; buffer low
        LDA #$70
        STA $33             ; buffer high ($7000)

      SHELL_LOAD_LOOP:
        LDA $3A
        BEQ SHELL_LOAD_DONE

        JSR $F200           ; DISK_READ (one sector)

        ; Next sector
        INC $30
        BNE SHELL_NO_CARRY
        INC $31
      SHELL_NO_CARRY:

        ; Advance buffer by 512 bytes (2 pages)
        CLC
        LDA $33
        ADC #$02
        STA $33

        DEC $3A
        JMP SHELL_LOAD_LOOP

      SHELL_LOAD_DONE:
        JMP $7000           ; Jump to shell entry
    ` },
    // ENTRY at $FF00
    { origin: 0xFF00, code: `
      .ORG $FF00
      ENTRY:
        LDX #$FF
        TXS
        LDA #$57
        JSR $F000
        LDA #$49
        JSR $F000
        LDA #$52
        JSR $F000
        LDA #$45
        JSR $F000
        LDA #$20
        JSR $F000
        LDA #$4F
        JSR $F000
        LDA #$4B
        JSR $F000
        JSR $F080
      ECHO_LOOP:
        JSR $F040
        JSR $F000
        JMP ECHO_LOOP
    ` },
  ];

  // Assemble each section and place in ROM
  for (const section of sections) {
    const result = assemble(section.code);
    const romOffset = section.origin - 0xC000;
    for (let i = 0; i < result.bytes.length; i++) {
      if (romOffset + i >= 0 && romOffset + i < romSize) {
        rom[romOffset + i] = result.bytes[i];
      }
    }
  }

  // Copy font data to $E000 (offset 0x2000 in ROM)
  const fontOffset = 0xE000 - 0xC000; // = 0x2000
  for (let i = 0; i < DEFAULT_FONT.length && i < 2048; i++) {
    rom[fontOffset + i] = DEFAULT_FONT[i];
  }

  // Set reset vector at $FFFC (offset $3FFC in ROM)
  rom[0x3FFC] = 0x00; // Low byte of $FF00
  rom[0x3FFD] = 0xFF; // High byte of $FF00

  return rom;
}

// Export pre-assembled BIOS for testing
export function getBiosRom(): Uint8Array {
  return assembleBios();
}
