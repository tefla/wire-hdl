; BEEP.ASM - Sound test (for future sound chip)
; Placeholder until sound hardware is added

.ORG $0800

PUTCHAR = $F000
NEWLINE = $F080

START:
    ; Just print BEEP for now
    LDA #$42        ; 'B'
    JSR PUTCHAR
    LDA #$45        ; 'E'
    JSR PUTCHAR
    LDA #$45        ; 'E'
    JSR PUTCHAR
    LDA #$50        ; 'P'
    JSR PUTCHAR
    JSR NEWLINE
    RTS
