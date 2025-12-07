// BIOS for wire-hdl Computer System
// Provides basic I/O routines: PUTCHAR, GETCHAR, screen init
// Located in ROM at $F000-$FFFF

import { assemble } from './stage0.js';

// BIOS entry points (fixed addresses for application use)
export const BIOS = {
  PUTCHAR: 0xF000,    // Write character in A to screen
  GETCHAR: 0xF040,    // Wait for keypress, return in A
  PUTS: 0xF080,       // Print null-terminated string at address in X:Y (X=hi, Y=lo)
  NEWLINE: 0xF0C0,    // Move cursor to start of next line
  CLS: 0xF100,        // Clear screen
  INIT: 0xF140,       // Initialize BIOS (called at reset)
  ENTRY: 0xFF00,      // Reset entry point
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
; ============================================================
GETCHAR:
  LDA $8010           ; Keyboard status
  AND #$01            ; Key available?
  BEQ GETCHAR         ; No, keep waiting
  LDA $8011           ; Read key data
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

  // Set reset vector at $FFFC (offset $3FFC in ROM)
  rom[0x3FFC] = 0x00; // Low byte of $FF00
  rom[0x3FFD] = 0xFF; // High byte of $FF00

  return rom;
}

// Export pre-assembled BIOS for testing
export function getBiosRom(): Uint8Array {
  return assembleBios();
}
