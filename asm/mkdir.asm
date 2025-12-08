; ============================================================
; MKDIR.COM - Placeholder directory creator
; ============================================================
; The on-device filesystem routines for creating directories are
; not available yet. This utility simply reports that the host
; tooling should be used to create directories (see WireFS).

        .ORG $0800

PUTCHAR     = $F000
NEWLINE     = $F080

; Zero page scratch for print routine
TMPPTR      = $40

START:
        LDA #<MSG_INFO
        STA TMPPTR
        LDA #>MSG_INFO
        STA TMPPTR+1
        JSR PRINT_STR
        RTS

; ------------------------------------------------------------
; PRINT_STR - Null-terminated string via TMPPTR
; ------------------------------------------------------------
PRINT_STR:
        LDY #0
PS_LOOP:
        LDA (TMPPTR),Y
        BEQ PS_DONE
        JSR PUTCHAR
        INY
        BNE PS_LOOP
PS_DONE:
        JSR NEWLINE
        RTS

; ------------------------------------------------------------
; Messages
; ------------------------------------------------------------
MSG_INFO:
        .DB "mkdir is a host-side operation for now.", $0D, $0A
        .DB "Use the WireFS tools or shell updates to create folders.", 0

        ; End of file
