// Monitor/OS for wire-hdl Computer System
// Simple command-line interface with basic commands
// Located in ROM, uses BIOS routines

import { assemble } from './stage0.js';
import { assembleBios, BIOS } from './bios.js';

// Monitor commands
export const MONITOR = {
  ENTRY: 0xE000,     // Monitor entry point
  PROMPT: 0xE010,    // Print prompt and wait for command
  PARSE: 0xE040,     // Parse and execute command
  HELP: 0xE080,      // Print help message
  PEEK: 0xE0C0,      // Read memory location
  POKE: 0xE100,      // Write memory location
  RUN: 0xE140,       // Jump to address
};

// Monitor source code
// This is a simple command-line monitor with:
// - H: Help
// - P xxxx: Peek at address xxxx
// - W xxxx yy: Write yy to address xxxx (not implemented - needs more parsing)
// - G xxxx: Go to address xxxx
// - Q: Quit (halt)
export const MONITOR_SOURCE = `
; ============================================================
; Monitor - Simple Command Line Interface
; ============================================================
; Commands:
;   H       - Help
;   P xxxx  - Peek memory at address (hex)
;   G xxxx  - Go (execute) at address
;   Q       - Quit (halt CPU)
;
; Uses BIOS routines at fixed addresses:
;   PUTCHAR = $F000
;   GETCHAR = $F040
;   NEWLINE = $F080
; ============================================================

.ORG $E000

; ============================================================
; ENTRY - Monitor entry point
; ============================================================
ENTRY:
  ; Print welcome message
  JSR PRINT_WELCOME
  ; Fall through to main loop

; Main command loop
MAIN_LOOP:
  JSR PRINT_PROMPT
  JSR READ_COMMAND
  JMP MAIN_LOOP

; ============================================================
; PRINT_WELCOME - Print startup banner
; ============================================================
.ORG $E020
PRINT_WELCOME:
  ; Print "MONITOR v1" + newline
  LDA #$4D            ; 'M'
  JSR $F000
  LDA #$4F            ; 'O'
  JSR $F000
  LDA #$4E            ; 'N'
  JSR $F000
  LDA #$49            ; 'I'
  JSR $F000
  LDA #$54            ; 'T'
  JSR $F000
  LDA #$4F            ; 'O'
  JSR $F000
  LDA #$52            ; 'R'
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
; PRINT_PROMPT - Print command prompt
; ============================================================
.ORG $E060
PRINT_PROMPT:
  LDA #$3E            ; '>'
  JSR $F000
  LDA #$20            ; ' '
  JSR $F000
  RTS

; ============================================================
; READ_COMMAND - Read and execute a command
; ============================================================
.ORG $E080
READ_COMMAND:
  JSR $F040           ; GETCHAR
  PHA                 ; Save command
  JSR $F000           ; Echo it
  JSR $F080           ; NEWLINE

  PLA                 ; Get command back

  ; Check for 'H' - Help
  CMP #$48
  BEQ CMD_HELP
  CMP #$68            ; 'h' lowercase
  BEQ CMD_HELP

  ; Check for 'Q' - Quit
  CMP #$51
  BEQ CMD_QUIT
  CMP #$71            ; 'q' lowercase
  BEQ CMD_QUIT

  ; Unknown command
  JMP CMD_UNKNOWN

; ============================================================
; CMD_HELP - Print help message
; ============================================================
.ORG $E0C0
CMD_HELP:
  ; Print "H-Help Q-Quit"
  LDA #$48            ; 'H'
  JSR $F000
  LDA #$2D            ; '-'
  JSR $F000
  LDA #$48            ; 'H'
  JSR $F000
  LDA #$45            ; 'E'
  JSR $F000
  LDA #$4C            ; 'L'
  JSR $F000
  LDA #$50            ; 'P'
  JSR $F000
  LDA #$20            ; ' '
  JSR $F000
  LDA #$51            ; 'Q'
  JSR $F000
  LDA #$2D            ; '-'
  JSR $F000
  LDA #$51            ; 'Q'
  JSR $F000
  LDA #$55            ; 'U'
  JSR $F000
  LDA #$49            ; 'I'
  JSR $F000
  LDA #$54            ; 'T'
  JSR $F000
  JSR $F080           ; NEWLINE
  RTS

; ============================================================
; CMD_QUIT - Halt CPU
; ============================================================
.ORG $E100
CMD_QUIT:
  ; Print "BYE"
  LDA #$42            ; 'B'
  JSR $F000
  LDA #$59            ; 'Y'
  JSR $F000
  LDA #$45            ; 'E'
  JSR $F000
  JSR $F080           ; NEWLINE
  HLT

; ============================================================
; CMD_UNKNOWN - Print error for unknown command
; ============================================================
.ORG $E120
CMD_UNKNOWN:
  ; Print "?"
  LDA #$3F            ; '?'
  JSR $F000
  JSR $F080           ; NEWLINE
  RTS
`;

// Assemble the monitor and combine with BIOS
export function assembleMonitor(): Uint8Array {
  // Start with BIOS ROM
  const rom = assembleBios();

  // Assemble each monitor section
  const sections = [
    // ENTRY at $E000
    { origin: 0xE000, code: `
      .ORG $E000
      ENTRY:
        JSR $E020
      MAIN_LOOP:
        JSR $E060
        JSR $E080
        JMP MAIN_LOOP
    ` },
    // PRINT_WELCOME at $E020
    { origin: 0xE020, code: `
      .ORG $E020
      PRINT_WELCOME:
        LDA #$4D
        JSR $F000
        LDA #$4F
        JSR $F000
        LDA #$4E
        JSR $F000
        LDA #$49
        JSR $F000
        LDA #$54
        JSR $F000
        LDA #$4F
        JSR $F000
        LDA #$52
        JSR $F000
        LDA #$20
        JSR $F000
        LDA #$76
        JSR $F000
        LDA #$31
        JSR $F000
        JSR $F080
        RTS
    ` },
    // PRINT_PROMPT at $E060
    { origin: 0xE060, code: `
      .ORG $E060
      PRINT_PROMPT:
        LDA #$3E
        JSR $F000
        LDA #$20
        JSR $F000
        RTS
    ` },
    // READ_COMMAND at $E080
    { origin: 0xE080, code: `
      .ORG $E080
      READ_COMMAND:
        JSR $F040
        PHA
        JSR $F000
        JSR $F080
        PLA
        CMP #$48
        BEQ $E0C0
        CMP #$68
        BEQ $E0C0
        CMP #$51
        BEQ $E100
        CMP #$71
        BEQ $E100
        JMP $E120
    ` },
    // CMD_HELP at $E0C0
    { origin: 0xE0C0, code: `
      .ORG $E0C0
      CMD_HELP:
        LDA #$48
        JSR $F000
        LDA #$2D
        JSR $F000
        LDA #$48
        JSR $F000
        LDA #$45
        JSR $F000
        LDA #$4C
        JSR $F000
        LDA #$50
        JSR $F000
        LDA #$20
        JSR $F000
        LDA #$51
        JSR $F000
        LDA #$2D
        JSR $F000
        LDA #$51
        JSR $F000
        LDA #$55
        JSR $F000
        LDA #$49
        JSR $F000
        LDA #$54
        JSR $F000
        JSR $F080
        RTS
    ` },
    // CMD_QUIT at $E100
    { origin: 0xE100, code: `
      .ORG $E100
      CMD_QUIT:
        LDA #$42
        JSR $F000
        LDA #$59
        JSR $F000
        LDA #$45
        JSR $F000
        JSR $F080
        HLT
    ` },
    // CMD_UNKNOWN at $E120
    { origin: 0xE120, code: `
      .ORG $E120
      CMD_UNKNOWN:
        LDA #$3F
        JSR $F000
        JSR $F080
        RTS
    ` },
  ];

  // Assemble and place each section
  for (const section of sections) {
    const result = assemble(section.code);
    const romOffset = section.origin - 0xC000;
    for (let i = 0; i < result.bytes.length; i++) {
      if (romOffset + i >= 0 && romOffset + i < rom.length) {
        rom[romOffset + i] = result.bytes[i];
      }
    }
  }

  // Update BIOS entry to jump to monitor instead of echo loop
  // Modify $FF00 to jump to monitor entry $E000
  // Note: Must initialize stack inline BEFORE any JSR calls!
  const entryResult = assemble(`
    .ORG $FF00
    ENTRY:
      LDX #$FF
      TXS
      JMP $E000
  `);
  const entryOffset = 0xFF00 - 0xC000;
  for (let i = 0; i < entryResult.bytes.length; i++) {
    if (entryOffset + i >= 0 && entryOffset + i < rom.length) {
      rom[entryOffset + i] = entryResult.bytes[i];
    }
  }

  return rom;
}

// Export for testing
export function getMonitorRom(): Uint8Array {
  return assembleMonitor();
}
