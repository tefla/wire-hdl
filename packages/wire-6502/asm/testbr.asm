; TESTBR.ASM - Label and backward branch test
; Tests backward reference resolution

.ORG $0800

START:
        LDA #$03
LOOP:
        SEC
        SBC #$01
        BNE LOOP
        RTS
