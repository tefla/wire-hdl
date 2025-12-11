; HELLO.ASM - Hello World for WireOS
; Assemble with: ASM0 HELLO
; Run with: HELLO

.ORG $0800

; BIOS entry points
PUTCHAR = $F000
NEWLINE = $F080

START:
    LDX #$00
LOOP:
    LDA MESSAGE,X
    BEQ DONE
    JSR PUTCHAR
    INX
    JMP LOOP
DONE:
    JSR NEWLINE
    RTS

MESSAGE:
    ; "Hello, WireOS!" as individual bytes (string literals not supported yet)
    .DB $48, $65, $6C, $6C, $6F, $2C, $20  ; "Hello, "
    .DB $57, $69, $72, $65, $4F, $53, $21  ; "WireOS!"
    .DB $00  ; null terminator
