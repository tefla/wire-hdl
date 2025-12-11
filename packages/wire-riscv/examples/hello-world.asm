; Hello World for RISC-V Emulator
; =================================
;
; This program demonstrates writing text to the screen
; using the memory-mapped graphics card.
;
; Memory Map:
;   0x10000000 - Graphics registers
;   0x10001000 - Text VRAM (80x25 chars, 2 bytes per cell)
;
; Text VRAM Layout:
;   Each cell = 2 bytes: [character][attribute]
;   Row 0, Col 0 -> offset 0
;   Row y, Col x -> offset (y * 80 + x) * 2
;
; Attribute byte:
;   Bits 0-3: Foreground color (0-15)
;   Bits 4-7: Background color (0-15)
;   0x0F = White text on black background
;   0x1F = White on blue
;   0x4E = Yellow on red
;
; Color palette (CGA):
;   0=Black  1=Blue     2=Green   3=Cyan
;   4=Red    5=Magenta  6=Brown   7=Light Gray
;   8=Dark Gray  9=Light Blue  10=Light Green  11=Light Cyan
;   12=Light Red  13=Light Magenta  14=Yellow  15=White

        ; Program starts here
        ; --------------------

start:
        ; Load VRAM base address into a0
        lui     a0, 0x10001         ; a0 = 0x10001000

        ; Initialize index (offset in t1)
        addi    t1, x0, 0           ; t1 = 0 (current offset)

        ; Write 'H' (0x48)
        addi    t0, x0, 0x48        ; t0 = 'H'
        add     t2, a0, t1          ; t2 = base + offset
        sb      t0, 0(t2)           ; Store character
        addi    t0, x0, 0x0F        ; t0 = white on black
        sb      t0, 1(t2)           ; Store attribute
        addi    t1, t1, 2           ; offset += 2

        ; Write 'e' (0x65)
        addi    t0, x0, 0x65        ; t0 = 'e'
        add     t2, a0, t1
        sb      t0, 0(t2)
        addi    t0, x0, 0x0F
        sb      t0, 1(t2)
        addi    t1, t1, 2

        ; Write 'l' (0x6C)
        addi    t0, x0, 0x6C        ; t0 = 'l'
        add     t2, a0, t1
        sb      t0, 0(t2)
        addi    t0, x0, 0x0F
        sb      t0, 1(t2)
        addi    t1, t1, 2

        ; Write 'l' (0x6C)
        addi    t0, x0, 0x6C        ; t0 = 'l'
        add     t2, a0, t1
        sb      t0, 0(t2)
        addi    t0, x0, 0x0F
        sb      t0, 1(t2)
        addi    t1, t1, 2

        ; Write 'o' (0x6F)
        addi    t0, x0, 0x6F        ; t0 = 'o'
        add     t2, a0, t1
        sb      t0, 0(t2)
        addi    t0, x0, 0x0F
        sb      t0, 1(t2)
        addi    t1, t1, 2

        ; Write ',' (0x2C)
        addi    t0, x0, 0x2C        ; t0 = ','
        add     t2, a0, t1
        sb      t0, 0(t2)
        addi    t0, x0, 0x0F
        sb      t0, 1(t2)
        addi    t1, t1, 2

        ; Write ' ' (0x20) - space
        addi    t0, x0, 0x20        ; t0 = ' '
        add     t2, a0, t1
        sb      t0, 0(t2)
        addi    t0, x0, 0x0F
        sb      t0, 1(t2)
        addi    t1, t1, 2

        ; Write 'W' (0x57)
        addi    t0, x0, 0x57        ; t0 = 'W'
        add     t2, a0, t1
        sb      t0, 0(t2)
        addi    t0, x0, 0x0E        ; Yellow on black for emphasis
        sb      t0, 1(t2)
        addi    t1, t1, 2

        ; Write 'o' (0x6F)
        addi    t0, x0, 0x6F        ; t0 = 'o'
        add     t2, a0, t1
        sb      t0, 0(t2)
        addi    t0, x0, 0x0E
        sb      t0, 1(t2)
        addi    t1, t1, 2

        ; Write 'r' (0x72)
        addi    t0, x0, 0x72        ; t0 = 'r'
        add     t2, a0, t1
        sb      t0, 0(t2)
        addi    t0, x0, 0x0E
        sb      t0, 1(t2)
        addi    t1, t1, 2

        ; Write 'l' (0x6C)
        addi    t0, x0, 0x6C        ; t0 = 'l'
        add     t2, a0, t1
        sb      t0, 0(t2)
        addi    t0, x0, 0x0E
        sb      t0, 1(t2)
        addi    t1, t1, 2

        ; Write 'd' (0x64)
        addi    t0, x0, 0x64        ; t0 = 'd'
        add     t2, a0, t1
        sb      t0, 0(t2)
        addi    t0, x0, 0x0E
        sb      t0, 1(t2)
        addi    t1, t1, 2

        ; Write '!' (0x21)
        addi    t0, x0, 0x21        ; t0 = '!'
        add     t2, a0, t1
        sb      t0, 0(t2)
        addi    t0, x0, 0x0C        ; Light red on black
        sb      t0, 1(t2)

        ; Halt
        ecall
