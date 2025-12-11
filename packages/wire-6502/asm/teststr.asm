; TESTSTR.ASM - Test string literals in .DB directive
; Tests: .DB "string", mixed format, empty string

.ORG $0800

; Simple string
MSG1:
    .DB "Hi"

; String with trailing bytes
MSG2:
    .DB "OK", $0D, $0A, 0

; Single character string
MSG3:
    .DB "A"

; Empty string (should emit nothing)
MSG4:
    .DB ""

; Multiple strings
MSG5:
    .DB "X", "Y"

END:
    RTS
