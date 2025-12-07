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
    .DB "Hello, WireOS!", $00
