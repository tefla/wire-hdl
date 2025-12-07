; ============================================================
; ASM0 - Stage 0 Assembler Placeholder
; ============================================================
; This is a placeholder that shows the assembler loaded correctly.
; A real implementation would parse source and generate machine code.
;
; Usage: ASM0 <filename>
; ============================================================

.ORG $0800

ASM0_START:
    ; Print "ASM0 v1" + newline
    LDA #$41            ; 'A'
    JSR $F000
    LDA #$53            ; 'S'
    JSR $F000
    LDA #$4D            ; 'M'
    JSR $F000
    LDA #$30            ; '0'
    JSR $F000
    LDA #$20            ; ' '
    JSR $F000
    LDA #$76            ; 'v'
    JSR $F000
    LDA #$31            ; '1'
    JSR $F000
    JSR $F080           ; NEWLINE

    ; Print "Assembler ready"
    LDA #$41            ; 'A'
    JSR $F000
    LDA #$73            ; 's'
    JSR $F000
    LDA #$73            ; 's'
    JSR $F000
    LDA #$65            ; 'e'
    JSR $F000
    LDA #$6D            ; 'm'
    JSR $F000
    LDA #$62            ; 'b'
    JSR $F000
    LDA #$6C            ; 'l'
    JSR $F000
    LDA #$65            ; 'e'
    JSR $F000
    LDA #$72            ; 'r'
    JSR $F000
    LDA #$20            ; ' '
    JSR $F000
    LDA #$72            ; 'r'
    JSR $F000
    LDA #$65            ; 'e'
    JSR $F000
    LDA #$61            ; 'a'
    JSR $F000
    LDA #$64            ; 'd'
    JSR $F000
    LDA #$79            ; 'y'
    JSR $F000
    JSR $F080           ; NEWLINE

    ; Return to shell (jump back to shell start)
    JMP $0800           ; Note: This won't work correctly!
                        ; We need the shell to handle this properly
                        ; For now, just halt
    RTS                 ; Will return if called via JSR
