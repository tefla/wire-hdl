; TESTERR.ASM - Intentional error test for asm2
; Should produce an error message with line number

        .ORG $0800

        NOP
        NOP
        INVALID_MNEMONIC      ; Line 8: Unknown mnemonic error
        NOP
