; TESTDB2.ASM - Test .DB with label (original failing case)

.ORG $0800

DATA:
        .DB $00         ; This was failing before

START:
        LDA DATA
        RTS
