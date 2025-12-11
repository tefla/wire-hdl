; TESTLDA.ASM - LDA immediate test for asm2
; Expected output: $A9 $42 (2 bytes)

        .ORG $0800

        LDA #$42
