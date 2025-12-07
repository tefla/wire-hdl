; ============================================================
; Boot Loader ROM - $FC00
; ============================================================
; Reads boot sector from HDD first, then tries floppy if no boot
; Uses BIOS routines for console output
; ============================================================

.ORG $FC00

; Zero page usage:
;   $E0-$E1  Entry point
;   $E2-$E3  Load address
;   $E4-$E5  Sector count
;   $E6-$E7  Source pointer
;   $E8      Boot device (0=HDD, 1=Floppy)
;
; I/O Addresses - HDD:
;   $8020 - DISK_STATUS
;   $8021 - DISK_CMD
;   $8022 - DISK_SEC_LO
;   $8023 - DISK_SEC_HI
;   $8024 - DISK_BUF_LO
;   $8025 - DISK_BUF_HI
;   $8026 - DISK_COUNT
;
; I/O Addresses - Floppy:
;   $8040 - FLOPPY_STATUS (bit 6 = no disk)
;   $8041 - FLOPPY_CMD
;   $8042 - FLOPPY_SEC_LO
;   $8043 - FLOPPY_SEC_HI
;   $8044 - FLOPPY_BUF_LO
;   $8045 - FLOPPY_BUF_HI
;   $8046 - FLOPPY_COUNT
;
; BIOS routines:
;   $F000 - PUTCHAR
;   $F080 - NEWLINE
;
; Disk buffer: $4800

; ============================================================
; BOOT_ENTRY - Main boot loader entry point
; ============================================================
BOOT_ENTRY:
    ; Print "BOOT" message
    LDA #$42            ; 'B'
    JSR $F000           ; PUTCHAR
    LDA #$4F            ; 'O'
    JSR $F000
    LDA #$4F            ; 'O'
    JSR $F000
    LDA #$54            ; 'T'
    JSR $F000
    JSR $F080           ; NEWLINE

    ; Try HDD first
    LDA #$00
    STA $E8             ; Boot device = HDD

    ; Read boot sector (sector 0) into disk buffer
    LDA #$00
    STA $8022           ; DISK_SEC_LO
    STA $8023           ; DISK_SEC_HI

    LDA #$00            ; Buffer at $4800
    STA $8024           ; DISK_BUF_LO
    LDA #$48
    STA $8025           ; DISK_BUF_HI

    LDA #$01            ; Read 1 sector
    STA $8026           ; DISK_COUNT

    LDA #$01            ; READ command
    STA $8021           ; DISK_CMD

    ; Wait for disk ready
WAIT_DISK:
    LDA $8020           ; DISK_STATUS
    AND #$02            ; Check busy bit
    BNE WAIT_DISK
    LDA $8020           ; DISK_STATUS
    AND #$80            ; Check error bit
    BEQ DISK_OK1
    JMP TRY_FLOPPY      ; HDD error, try floppy
DISK_OK1:

    ; Check magic bytes "WF"
    LDA $4800           ; DISK_BUFFER[0]
    CMP #$57            ; 'W'
    BNE TRY_FLOPPY      ; No magic, try floppy
    LDA $4801           ; DISK_BUFFER[1]
    CMP #$46            ; 'F'
    BNE TRY_FLOPPY      ; No magic, try floppy
    JMP BOOT_VALID      ; Magic found, boot from HDD

; ============================================================
; TRY_FLOPPY - Try booting from floppy drive
; ============================================================
TRY_FLOPPY:
    ; Check if floppy is present
    LDA $8040           ; FLOPPY_STATUS
    AND #$40            ; bit 6 = no disk
    BEQ FLOPPY_OK1      ; Floppy present, continue
    JMP NO_BOOT         ; No floppy inserted
FLOPPY_OK1:

    ; Floppy is inserted, try to boot from it
    LDA #$01
    STA $E8             ; Boot device = Floppy

    ; Read floppy boot sector
    LDA #$00
    STA $8042           ; FLOPPY_SEC_LO
    STA $8043           ; FLOPPY_SEC_HI

    LDA #$00            ; Buffer at $4800
    STA $8044           ; FLOPPY_BUF_LO
    LDA #$48
    STA $8045           ; FLOPPY_BUF_HI

    LDA #$01            ; Read 1 sector
    STA $8046           ; FLOPPY_COUNT

    LDA #$01            ; READ command
    STA $8041           ; FLOPPY_CMD

    ; Wait for floppy ready
WAIT_FLOPPY:
    LDA $8040           ; FLOPPY_STATUS
    AND #$02            ; Check busy bit
    BNE WAIT_FLOPPY
    LDA $8040           ; FLOPPY_STATUS
    AND #$80            ; Check error bit
    BEQ FLOPPY_OK2      ; No error, continue
    JMP NO_BOOT         ; Error reading floppy
FLOPPY_OK2:

    ; Check magic bytes "WF"
    LDA $4800           ; DISK_BUFFER[0]
    CMP #$57            ; 'W'
    BEQ FLOPPY_OK3
    JMP NO_BOOT
FLOPPY_OK3:
    LDA $4801           ; DISK_BUFFER[1]
    CMP #$46            ; 'F'
    BEQ BOOT_VALID
    JMP NO_BOOT

BOOT_VALID:

    ; Get entry point
    LDA $4802           ; DISK_BUFFER[2] - Entry low
    STA $E0
    LDA $4803           ; DISK_BUFFER[3] - Entry high
    STA $E1

    ; Get load address
    LDA $4804           ; DISK_BUFFER[4] - Load low
    STA $E2
    LDA $4805           ; DISK_BUFFER[5] - Load high
    STA $E3

    ; Get sector count
    LDA $4806           ; DISK_BUFFER[6] - Count low
    STA $E4
    LDA $4807           ; DISK_BUFFER[7] - Count high
    STA $E5

    ; Print "OK"
    LDA #$4F            ; 'O'
    JSR $F000
    LDA #$4B            ; 'K'
    JSR $F000
    JSR $F080

    ; If more than 1 sector, load additional sectors
    LDA $E5             ; Check high byte
    BNE LOAD_MORE
    LDA $E4             ; Check if > 1
    CMP #$02
    BCC COPY_BOOT       ; <= 1 sector, just copy boot sector

LOAD_MORE:
    ; Load remaining sectors (sector 1 onwards)
    ; Check which drive we're booting from
    LDA $E8             ; Boot device
    BNE LOAD_FROM_FLOPPY

    ; Load from HDD
    LDA #$01
    STA $8022           ; DISK_SEC_LO
    LDA #$00
    STA $8023           ; DISK_SEC_HI
    ; Set buffer to load_address + 504 ($1F8)
    ; Boot sector has 504 bytes of code, continuation starts there
    LDA $E2
    CLC
    ADC #$F8            ; Add $F8 (low byte of 504)
    STA $8024           ; DISK_BUF_LO
    LDA $E3
    ADC #$01            ; Add $01 (high byte of 504) + carry
    STA $8025           ; DISK_BUF_HI
    SEC
    LDA $E4
    SBC #$01            ; Subtract 1 for boot sector
    STA $8026           ; DISK_COUNT
    BEQ COPY_BOOT
    LDA #$01            ; READ command
    STA $8021           ; DISK_CMD
WAIT_DISK2:
    LDA $8020           ; DISK_STATUS
    AND #$02
    BNE WAIT_DISK2
    LDA $8020           ; DISK_STATUS
    AND #$80
    BNE DISK_ERROR
    JMP COPY_BOOT

LOAD_FROM_FLOPPY:
    ; Load from floppy
    LDA #$01
    STA $8042           ; FLOPPY_SEC_LO
    LDA #$00
    STA $8043           ; FLOPPY_SEC_HI
    ; Set buffer to load_address + 504 ($1F8)
    ; Boot sector has 504 bytes of code, continuation starts there
    LDA $E2
    CLC
    ADC #$F8            ; Add $F8 (low byte of 504)
    STA $8044           ; FLOPPY_BUF_LO
    LDA $E3
    ADC #$01            ; Add $01 (high byte of 504) + carry
    STA $8045           ; FLOPPY_BUF_HI
    SEC
    LDA $E4
    SBC #$01            ; Subtract 1 for boot sector
    STA $8046           ; FLOPPY_COUNT
    BEQ COPY_BOOT
    LDA #$01            ; READ command
    STA $8041           ; FLOPPY_CMD
WAIT_FLOPPY2:
    LDA $8040           ; FLOPPY_STATUS
    AND #$02
    BNE WAIT_FLOPPY2
    LDA $8040           ; FLOPPY_STATUS
    AND #$80
    BNE DISK_ERROR

COPY_BOOT:
    ; Copy boot sector data (starting at offset 8) to load address
    ; This is the first 504 bytes of code/data
    ; Use $E6/$E7 as source pointer
    LDA #$08            ; $4808 = DISK_BUFFER + 8
    STA $E6
    LDA #$48
    STA $E7

    LDY #$00
COPY_LOOP:
    LDA ($E6),Y         ; Load from source
    STA ($E2),Y         ; Store at load address
    INY
    BNE COPY_LOOP       ; Copy 256 bytes

    ; Increment high bytes for second 256 bytes
    INC $E3             ; Increment dest high byte
    INC $E7             ; Increment src high byte
COPY_LOOP2:
    LDA ($E6),Y         ; Continue copy
    STA ($E2),Y
    INY
    CPY #$F8            ; 504 - 256 = 248 bytes
    BNE COPY_LOOP2
    DEC $E3             ; Restore load address high byte

    ; Print "GO" and jump to entry point
    LDA #$47            ; 'G'
    JSR $F000
    LDA #$4F            ; 'O'
    JSR $F000
    JSR $F080

    JMP ($00E0)         ; Jump to entry point

; ============================================================
; DISK_ERROR - Handle disk error
; ============================================================
DISK_ERROR:
    LDA #$45            ; 'E'
    JSR $F000
    LDA #$52            ; 'R'
    JSR $F000
    LDA #$52            ; 'R'
    JSR $F000
    JSR $F080
    JMP BOOT_ENTRY      ; Retry

; ============================================================
; NO_BOOT - No bootable disk
; ============================================================
NO_BOOT:
    ; Print "NO BOOT"
    LDA #$4E            ; 'N'
    JSR $F000
    LDA #$4F            ; 'O'
    JSR $F000
    LDA #$20            ; ' '
    JSR $F000
    LDA #$42            ; 'B'
    JSR $F000
    LDA #$4F            ; 'O'
    JSR $F000
    LDA #$4F            ; 'O'
    JSR $F000
    LDA #$54            ; 'T'
    JSR $F000
    JSR $F080

    ; Fall through to hex loader if present
    JMP $F800           ; Jump to hex loader

; ============================================================
; End of Boot Loader
; ============================================================

