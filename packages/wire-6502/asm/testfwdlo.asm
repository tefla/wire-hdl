; TESTFWDLO.ASM - Test forward reference with < > operators

.ORG $0800

        LDA #<MSG       ; Forward reference with <
        LDX #>MSG       ; Forward reference with >
        RTS

MSG:
        .DB "Test", 0
