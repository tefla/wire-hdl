; EDIT-SIMPLE.ASM - Simplified Text Editor Demo
; Displays a full-screen interface with test content

.text

main:
    ; Clear screen (print 25 newlines to push content off screen)
    ADDI t0, zero, 25        ; counter = 25
clearLoop:
    ADDI a0, zero, 10        ; newline
    ADDI a7, zero, 1         ; PUTCHAR syscall
    ECALL
    ADDI t0, t0, -1
    BNE t0, zero, clearLoop

    ; Print header line
    ADDI a0, zero, 61        ; '='
    ADDI a7, zero, 1
    ECALL
    ECALL
    ECALL
    ADDI a0, zero, 32        ; ' '
    ECALL
    ; "EDIT v1.0"
    ADDI a0, zero, 69        ; 'E'
    ECALL
    ADDI a0, zero, 68        ; 'D'
    ECALL
    ADDI a0, zero, 73        ; 'I'
    ECALL
    ADDI a0, zero, 84        ; 'T'
    ECALL
    ADDI a0, zero, 32        ; ' '
    ECALL
    ADDI a0, zero, 118       ; 'v'
    ECALL
    ADDI a0, zero, 49        ; '1'
    ECALL
    ADDI a0, zero, 46        ; '.'
    ECALL
    ADDI a0, zero, 48        ; '0'
    ECALL
    ADDI a0, zero, 32        ; ' '
    ECALL
    ADDI a0, zero, 61        ; '='
    ECALL
    ECALL
    ECALL
    ADDI a0, zero, 10        ; newline
    ECALL
    ECALL                     ; double newline

    ; Print line 1
    ADDI a0, zero, 76        ; 'L'
    ADDI a7, zero, 1
    ECALL
    ADDI a0, zero, 105       ; 'i'
    ECALL
    ADDI a0, zero, 110       ; 'n'
    ECALL
    ADDI a0, zero, 101       ; 'e'
    ECALL
    ADDI a0, zero, 32        ; ' '
    ECALL
    ADDI a0, zero, 49        ; '1'
    ECALL
    ADDI a0, zero, 58        ; ':'
    ECALL
    ADDI a0, zero, 32        ; ' '
    ECALL
    ; "The quick brown fox"
    ADDI a0, zero, 84        ; 'T'
    ECALL
    ADDI a0, zero, 104       ; 'h'
    ECALL
    ADDI a0, zero, 101       ; 'e'
    ECALL
    ADDI a0, zero, 32        ; ' '
    ECALL
    ADDI a0, zero, 113       ; 'q'
    ECALL
    ADDI a0, zero, 117       ; 'u'
    ECALL
    ADDI a0, zero, 105       ; 'i'
    ECALL
    ADDI a0, zero, 99        ; 'c'
    ECALL
    ADDI a0, zero, 107       ; 'k'
    ECALL
    ADDI a0, zero, 32        ; ' '
    ECALL
    ADDI a0, zero, 98        ; 'b'
    ECALL
    ADDI a0, zero, 114       ; 'r'
    ECALL
    ADDI a0, zero, 111       ; 'o'
    ECALL
    ADDI a0, zero, 119       ; 'w'
    ECALL
    ADDI a0, zero, 110       ; 'n'
    ECALL
    ADDI a0, zero, 32        ; ' '
    ECALL
    ADDI a0, zero, 102       ; 'f'
    ECALL
    ADDI a0, zero, 111       ; 'o'
    ECALL
    ADDI a0, zero, 120       ; 'x'
    ECALL
    ADDI a0, zero, 10        ; newline
    ECALL

    ; Print line 2
    ADDI a0, zero, 76        ; 'L'
    ECALL
    ADDI a0, zero, 105       ; 'i'
    ECALL
    ADDI a0, zero, 110       ; 'n'
    ECALL
    ADDI a0, zero, 101       ; 'e'
    ECALL
    ADDI a0, zero, 32        ; ' '
    ECALL
    ADDI a0, zero, 50        ; '2'
    ECALL
    ADDI a0, zero, 58        ; ':'
    ECALL
    ADDI a0, zero, 32        ; ' '
    ECALL
    ; "RISC-V Text Editor"
    ADDI a0, zero, 82        ; 'R'
    ECALL
    ADDI a0, zero, 73        ; 'I'
    ECALL
    ADDI a0, zero, 83        ; 'S'
    ECALL
    ADDI a0, zero, 67        ; 'C'
    ECALL
    ADDI a0, zero, 45        ; '-'
    ECALL
    ADDI a0, zero, 86        ; 'V'
    ECALL
    ADDI a0, zero, 32        ; ' '
    ECALL
    ADDI a0, zero, 84        ; 'T'
    ECALL
    ADDI a0, zero, 101       ; 'e'
    ECALL
    ADDI a0, zero, 120       ; 'x'
    ECALL
    ADDI a0, zero, 116       ; 't'
    ECALL
    ADDI a0, zero, 32        ; ' '
    ECALL
    ADDI a0, zero, 69        ; 'E'
    ECALL
    ADDI a0, zero, 100       ; 'd'
    ECALL
    ADDI a0, zero, 105       ; 'i'
    ECALL
    ADDI a0, zero, 116       ; 't'
    ECALL
    ADDI a0, zero, 111       ; 'o'
    ECALL
    ADDI a0, zero, 114       ; 'r'
    ECALL
    ADDI a0, zero, 10        ; newline
    ECALL

    ; Print line 3
    ADDI a0, zero, 76        ; 'L'
    ECALL
    ADDI a0, zero, 105       ; 'i'
    ECALL
    ADDI a0, zero, 110       ; 'n'
    ECALL
    ADDI a0, zero, 101       ; 'e'
    ECALL
    ADDI a0, zero, 32        ; ' '
    ECALL
    ADDI a0, zero, 51        ; '3'
    ECALL
    ADDI a0, zero, 58        ; ':'
    ECALL
    ADDI a0, zero, 32        ; ' '
    ECALL
    ; "Full-screen display working!"
    ADDI a0, zero, 70        ; 'F'
    ECALL
    ADDI a0, zero, 117       ; 'u'
    ECALL
    ADDI a0, zero, 108       ; 'l'
    ECALL
    ADDI a0, zero, 108       ; 'l'
    ECALL
    ADDI a0, zero, 45        ; '-'
    ECALL
    ADDI a0, zero, 115       ; 's'
    ECALL
    ADDI a0, zero, 99        ; 'c'
    ECALL
    ADDI a0, zero, 114       ; 'r'
    ECALL
    ADDI a0, zero, 101       ; 'e'
    ECALL
    ADDI a0, zero, 101       ; 'e'
    ECALL
    ADDI a0, zero, 110       ; 'n'
    ECALL
    ADDI a0, zero, 32        ; ' '
    ECALL
    ADDI a0, zero, 100       ; 'd'
    ECALL
    ADDI a0, zero, 105       ; 'i'
    ECALL
    ADDI a0, zero, 115       ; 's'
    ECALL
    ADDI a0, zero, 112       ; 'p'
    ECALL
    ADDI a0, zero, 108       ; 'l'
    ECALL
    ADDI a0, zero, 97        ; 'a'
    ECALL
    ADDI a0, zero, 121       ; 'y'
    ECALL
    ADDI a0, zero, 33        ; '!'
    ECALL
    ADDI a0, zero, 10        ; newline
    ECALL

    ; Print empty line
    ADDI a0, zero, 10
    ECALL

    ; Print status line
    ADDI a0, zero, 45        ; '-'
    ADDI t0, zero, 40        ; 40 dashes
statusLoop:
    ECALL
    ADDI t0, t0, -1
    BNE t0, zero, statusLoop
    ADDI a0, zero, 10        ; newline
    ECALL

    ; Print instructions
    ADDI a0, zero, 91        ; '['
    ECALL
    ; "Cursor navigation coming soon"
    ADDI a0, zero, 67        ; 'C'
    ECALL
    ADDI a0, zero, 117       ; 'u'
    ECALL
    ADDI a0, zero, 114       ; 'r'
    ECALL
    ADDI a0, zero, 115       ; 's'
    ECALL
    ADDI a0, zero, 111       ; 'o'
    ECALL
    ADDI a0, zero, 114       ; 'r'
    ECALL
    ADDI a0, zero, 32        ; ' '
    ECALL
    ADDI a0, zero, 110       ; 'n'
    ECALL
    ADDI a0, zero, 97        ; 'a'
    ECALL
    ADDI a0, zero, 118       ; 'v'
    ECALL
    ADDI a0, zero, 105       ; 'i'
    ECALL
    ADDI a0, zero, 103       ; 'g'
    ECALL
    ADDI a0, zero, 97        ; 'a'
    ECALL
    ADDI a0, zero, 116       ; 't'
    ECALL
    ADDI a0, zero, 105       ; 'i'
    ECALL
    ADDI a0, zero, 111       ; 'o'
    ECALL
    ADDI a0, zero, 110       ; 'n'
    ECALL
    ADDI a0, zero, 32        ; ' '
    ECALL
    ADDI a0, zero, 99        ; 'c'
    ECALL
    ADDI a0, zero, 111       ; 'o'
    ECALL
    ADDI a0, zero, 109       ; 'm'
    ECALL
    ADDI a0, zero, 105       ; 'i'
    ECALL
    ADDI a0, zero, 110       ; 'n'
    ECALL
    ADDI a0, zero, 103       ; 'g'
    ECALL
    ADDI a0, zero, 93        ; ']'
    ECALL
    ADDI a0, zero, 10        ; newline
    ECALL

    ; Exit
    ADDI a7, zero, 0         ; EXIT syscall
    ECALL
