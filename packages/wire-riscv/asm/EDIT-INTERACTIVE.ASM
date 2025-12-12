; EDIT-INTERACTIVE.ASM - Interactive Text Editor (Phase 1)
; Demonstrates keyboard input and character insertion

.text

main:
    ; Print header
    ADDI a0, zero, 69        ; 'E'
    ADDI a7, zero, 1         ; PUTCHAR syscall
    ECALL
    ADDI a0, zero, 68        ; 'D'
    ECALL
    ADDI a0, zero, 73        ; 'I'
    ECALL
    ADDI a0, zero, 84        ; 'T'
    ECALL
    ADDI a0, zero, 32        ; ' '
    ECALL
    ADDI a0, zero, 45        ; '-'
    ECALL
    ADDI a0, zero, 32        ; ' '
    ECALL
    ; "Type text (ESC to exit)"
    ADDI a0, zero, 84        ; 'T'
    ECALL
    ADDI a0, zero, 121       ; 'y'
    ECALL
    ADDI a0, zero, 112       ; 'p'
    ECALL
    ADDI a0, zero, 101       ; 'e'
    ECALL
    ADDI a0, zero, 32        ; ' '
    ECALL
    ADDI a0, zero, 116       ; 't'
    ECALL
    ADDI a0, zero, 101       ; 'e'
    ECALL
    ADDI a0, zero, 120       ; 'x'
    ECALL
    ADDI a0, zero, 116       ; 't'
    ECALL
    ADDI a0, zero, 32        ; ' '
    ECALL
    ADDI a0, zero, 40        ; '('
    ECALL
    ADDI a0, zero, 69        ; 'E'
    ECALL
    ADDI a0, zero, 83        ; 'S'
    ECALL
    ADDI a0, zero, 67        ; 'C'
    ECALL
    ADDI a0, zero, 32        ; ' '
    ECALL
    ADDI a0, zero, 116       ; 't'
    ECALL
    ADDI a0, zero, 111       ; 'o'
    ECALL
    ADDI a0, zero, 32        ; ' '
    ECALL
    ADDI a0, zero, 101       ; 'e'
    ECALL
    ADDI a0, zero, 120       ; 'x'
    ECALL
    ADDI a0, zero, 105       ; 'i'
    ECALL
    ADDI a0, zero, 116       ; 't'
    ECALL
    ADDI a0, zero, 41        ; ')'
    ECALL
    ADDI a0, zero, 10        ; newline
    ECALL
    ADDI a0, zero, 10        ; double newline
    ECALL

    ; Print prompt
    ADDI a0, zero, 62        ; '>'
    ECALL
    ADDI a0, zero, 32        ; ' '
    ECALL

mainLoop:
    ; Get character from keyboard
    ADDI a7, zero, 2         ; GETCHAR syscall
    ECALL
    ADDI t0, a0, 0           ; t0 = key code

    ; Check if no key available (-1)
    ADDI t1, zero, -1
    BEQ t0, t1, mainLoop     ; If no key, keep polling

    ; Check for ESC (0x1B)
    ADDI t1, zero, 0x1B
    BEQ t0, t1, exit

    ; Check for backspace (0x08)
    ADDI t1, zero, 0x08
    BEQ t0, t1, handleBackspace

    ; Check for enter/return (0x0D or 0x0A)
    ADDI t1, zero, 0x0D
    BEQ t0, t1, handleEnter
    ADDI t1, zero, 0x0A
    BEQ t0, t1, handleEnter

    ; Check if printable (0x20-0x7E)
    ADDI t1, zero, 0x20
    BLT t0, t1, mainLoop     ; If < 0x20, ignore
    ADDI t1, zero, 0x7F
    BGE t0, t1, mainLoop     ; If >= 0x7F, ignore

    ; Echo the character
    ADDI a0, t0, 0
    ADDI a7, zero, 1         ; PUTCHAR syscall
    ECALL

    JAL zero, mainLoop

handleBackspace:
    ; For now, just echo backspace sequence
    ; Later: actually delete from buffer
    ADDI a0, zero, 0x08      ; backspace
    ADDI a7, zero, 1
    ECALL
    ADDI a0, zero, 0x20      ; space (erase)
    ECALL
    ADDI a0, zero, 0x08      ; backspace again
    ECALL
    JAL zero, mainLoop

handleEnter:
    ; Print newline
    ADDI a0, zero, 10
    ADDI a7, zero, 1
    ECALL
    ; Print new prompt
    ADDI a0, zero, 62        ; '>'
    ECALL
    ADDI a0, zero, 32        ; ' '
    ECALL
    JAL zero, mainLoop

exit:
    ; Print goodbye message
    ADDI a0, zero, 10        ; newline
    ADDI a7, zero, 1
    ECALL
    ADDI a0, zero, 10
    ECALL
    ; "Goodbye!"
    ADDI a0, zero, 71        ; 'G'
    ECALL
    ADDI a0, zero, 111       ; 'o'
    ECALL
    ADDI a0, zero, 111       ; 'o'
    ECALL
    ADDI a0, zero, 100       ; 'd'
    ECALL
    ADDI a0, zero, 98        ; 'b'
    ECALL
    ADDI a0, zero, 121       ; 'y'
    ECALL
    ADDI a0, zero, 101       ; 'e'
    ECALL
    ADDI a0, zero, 33        ; '!'
    ECALL
    ADDI a0, zero, 10        ; newline
    ECALL

    ; Exit
    ADDI a7, zero, 0         ; EXIT syscall
    ECALL
