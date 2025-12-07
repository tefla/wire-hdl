; TEST.ASM - Test program
; Tests basic 6502 operations

.ORG $0800

PUTCHAR = $F000
NEWLINE = $F080

START:
    ; Print "OK"
    LDA #$4F        ; 'O'
    JSR PUTCHAR
    LDA #$4B        ; 'K'
    JSR PUTCHAR
    JSR NEWLINE

    ; Count from 0-9
    LDX #$00
COUNT:
    TXA
    CLC
    ADC #$30        ; Convert to ASCII
    JSR PUTCHAR
    INX
    CPX #$0A
    BNE COUNT
    JSR NEWLINE

    RTS
