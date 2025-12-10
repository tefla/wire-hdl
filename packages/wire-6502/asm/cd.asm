; ============================================================
; CD.COM - Change current working directory environment
; ============================================================
; This program updates the shell environment block used for the
; prompt. It expects the shell command buffer to still contain
; the typed command line at $0300.

        .ORG $0800

; BIOS entry points
PUTCHAR     = $F000
NEWLINE     = $F080

; Buffers
CMD_BUF     = $0300      ; Shell command buffer
ENV_LEN     = $0200      ; Stored length of current path
ENV_PATH    = $0201      ; Path bytes (max 63)
ENV_MAX     = 63

; Zero page
ARG_POS     = $50        ; Offset within CMD_BUF where argument starts

; ------------------------------------------------------------
; Entry
; ------------------------------------------------------------
START:
        JSR FIND_ARG
        BCC CD_PRINT          ; No argument, just print current path
        JSR UPDATE_ENV
CD_PRINT:
        JSR PRINT_ENV
        RTS

; ------------------------------------------------------------
; PRINT_ENV - Print the current path followed by newline
; ------------------------------------------------------------
PRINT_ENV:
        LDY ENV_LEN
        BEQ PE_ROOT
        LDY #0
PE_LOOP:
        CPY ENV_LEN
        BEQ PE_ARROW
        LDA ENV_PATH,Y
        JSR PUTCHAR
        INY
        JMP PE_LOOP

PE_ROOT:
        LDA #'/'
        JSR PUTCHAR

PE_ARROW:
        JSR NEWLINE
        RTS

; ------------------------------------------------------------
; FIND_ARG - Locate first argument after command name
; Returns: C=1 if found, ARG_POS set; C=0 if none
; ------------------------------------------------------------
FIND_ARG:
        LDY #0
FA_SKIP_CMD:
        LDA CMD_BUF,Y
        BEQ FA_NONE
        CMP #' '
        BEQ FA_SKIP_SPACE
        INY
        JMP FA_SKIP_CMD

FA_SKIP_SPACE:
        INY
        LDA CMD_BUF,Y
        CMP #' '
        BEQ FA_SKIP_SPACE
        CMP #0
        BEQ FA_NONE
        CMP #$0D
        BEQ FA_NONE
        STY ARG_POS
        SEC
        RTS

FA_NONE:
        CLC
        RTS

; ------------------------------------------------------------
; UPDATE_ENV - Copy argument into ENV_PATH (absolute or relative)
; ------------------------------------------------------------
UPDATE_ENV:
        LDY #0               ; Destination index
        LDX ARG_POS          ; Source index
        LDA CMD_BUF,X
        CMP #'/'
        BEQ UE_COPY          ; Absolute path

        ; Relative: start from existing env length
        LDY ENV_LEN
        CPY #0
        BEQ UE_APPEND

        ; Ensure separator
        DEY
        LDA ENV_PATH,Y
        INY
        CMP #'/'
        BEQ UE_APPEND
        LDA #'/'
        STA ENV_PATH,Y
        INY

UE_APPEND:
        LDX ARG_POS

UE_COPY:
        LDA CMD_BUF,X
        BEQ UE_DONE
        CMP #' '
        BEQ UE_DONE
        CMP #$0D
        BEQ UE_DONE
        AND #$DF             ; Uppercase
        STA ENV_PATH,Y
        INX
        INY
        CPY #ENV_MAX
        BCS UE_DONE
        JMP UE_COPY

UE_DONE:
        STY ENV_LEN
        RTS

        ; End of file
