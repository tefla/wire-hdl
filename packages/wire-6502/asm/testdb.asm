; TESTDB.ASM - Test .DB directive
; Should emit raw bytes

.ORG $0800

        .DB $42         ; Single byte
        .DB $01, $02    ; Multiple bytes (if supported)
        RTS
