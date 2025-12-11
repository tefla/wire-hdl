; TESTDW.ASM - Test .DW directive (define word)
; Should emit 16-bit values in little-endian format

.ORG $0800

        .DW $1234       ; Should emit $34, $12
        .DW $ABCD       ; Should emit $CD, $AB
        RTS
