; TESTBIG.ASM - Test streaming with large file (>8KB)
; This file uses comments to exceed the 8KB buffer limit
; while keeping the actual code small for fast assembly

.ORG $0800

; ============================================================
; The actual code is just a few instructions
; ============================================================

START:
        LDA #$42        ; Load test value
        RTS             ; Return

; ============================================================
; Below is padding to make this file larger than 8KB
; Each comment line is about 70-80 characters
; We need about 120 lines to reach 8KB (120 * 70 = 8400 bytes)
; ============================================================

; PADDING LINE 001 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 002 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 003 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 004 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 005 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 006 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 007 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 008 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 009 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 010 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 011 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 012 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 013 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 014 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 015 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 016 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 017 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 018 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 019 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 020 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 021 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 022 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 023 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 024 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 025 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 026 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 027 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 028 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 029 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 030 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 031 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 032 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 033 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 034 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 035 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 036 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 037 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 038 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 039 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 040 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 041 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 042 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 043 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 044 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 045 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 046 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 047 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 048 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 049 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 050 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 051 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 052 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 053 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 054 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 055 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 056 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 057 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 058 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 059 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 060 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 061 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 062 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 063 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 064 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 065 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 066 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 067 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 068 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 069 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 070 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 071 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 072 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 073 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 074 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 075 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 076 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 077 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 078 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 079 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 080 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 081 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 082 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 083 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 084 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 085 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 086 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 087 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 088 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 089 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 090 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 091 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 092 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 093 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 094 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 095 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 096 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 097 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 098 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 099 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 100 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 101 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 102 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 103 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 104 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 105 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 106 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 107 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 108 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 109 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 110 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 111 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 112 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 113 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 114 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 115 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 116 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 117 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 118 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 119 - This is filler text to make the file larger than eight kilobytes
; PADDING LINE 120 - This is filler text to make the file larger than eight kilobytes

; End of file - total size should be > 8KB
