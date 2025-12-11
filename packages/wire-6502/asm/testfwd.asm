; TESTFWD.ASM - Test forward JMP reference

.ORG $0800

        JMP START       ; Forward reference - THIS IS THE BUG

        NOP             ; Skipped

START:
        RTS
