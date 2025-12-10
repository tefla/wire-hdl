import { describe, it, expect } from 'vitest';
import {
  assemble,
  createRomImage,
  MACRO_EXAMPLE,
  CONDITIONAL_EXAMPLE,
  REPEAT_EXAMPLE,
  EXPRESSION_EXAMPLE,
} from '../src/assembler/stage1.js';
import { OPCODES } from '../src/assembler/stage0.js';

describe('Stage 1 Assembler', () => {
  describe('Basic Assembly (Stage 0 compatibility)', () => {
    it('should assemble implied mode instructions', () => {
      const result = assemble(`
        INX
        DEX
        INY
        DEY
        HLT
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        OPCODES.INX,
        OPCODES.DEX,
        OPCODES.INY,
        OPCODES.DEY,
        OPCODES.HLT,
      ]);
    });

    it('should assemble immediate mode instructions', () => {
      const result = assemble(`
        LDA #$42
        LDX #$10
        LDY #$FF
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0xA9, 0x42,
        0xA2, 0x10,
        0xA0, 0xFF,
      ]);
    });

    it('should assemble absolute mode instructions', () => {
      const result = assemble(`
        STA $1234
        LDA $ABCD
        JMP $8000
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0x8D, 0x34, 0x12,
        0xAD, 0xCD, 0xAB,
        0x4C, 0x00, 0x80,
      ]);
    });

    it('should handle labels', () => {
      const result = assemble(`
        .ORG $0200
        START:
          LDA #$00
          JMP START
      `);
      expect(result.errors).toHaveLength(0);
      expect(result.labels.get('START')).toBe(0x0200);
      expect(Array.from(result.bytes)).toEqual([
        0xA9, 0x00,
        0x4C, 0x00, 0x02,
      ]);
    });

    it('should handle relative branches', () => {
      const result = assemble(`
        .ORG $0200
        LOOP:
          INX
          BNE LOOP
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0xE8,
        0xD0, 0xFD,
      ]);
    });

    it('should handle forward branches', () => {
      const result = assemble(`
        .ORG $0200
          LDA #$00
          BEQ SKIP
          INX
        SKIP:
          HLT
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0xA9, 0x00,
        0xF0, 0x01,
        0xE8,
        0x02,
      ]);
    });

    it('should handle .DW with forward references', () => {
      const result = assemble(`
        .ORG $1000
        TABLE:
          .DW DATA_A, DATA_B, DATA_C
        CODE:
          LDA TABLE
          RTS
        DATA_A: .DB $11
        DATA_B: .DB $22
        DATA_C: .DB $33
      `);
      expect(result.errors).toHaveLength(0);
      const bytes = Array.from(result.bytes);
      expect(bytes[0]).toBe(0x0A);
      expect(bytes[1]).toBe(0x10);
      expect(bytes[2]).toBe(0x0B);
      expect(bytes[3]).toBe(0x10);
      expect(bytes[4]).toBe(0x0C);
      expect(bytes[5]).toBe(0x10);
    });
  });

  describe('Macros', () => {
    it('should define and expand simple macros', () => {
      const result = assemble(`
        .ORG $8000

        .MACRO INC_TWICE
          INX
          INX
        .ENDM

        START:
          INC_TWICE
          HLT
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0xE8, 0xE8, // INX, INX from macro
        0x02,       // HLT
      ]);
    });

    it('should expand macros with parameters', () => {
      const result = assemble(`
        .ORG $8000

        .MACRO LOAD_VALUE val
          LDA #\\val
        .ENDM

        START:
          LOAD_VALUE $42
          LOAD_VALUE $FF
          HLT
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0xA9, 0x42, // LDA #$42
        0xA9, 0xFF, // LDA #$FF
        0x02,       // HLT
      ]);
    });

    it('should expand macros with multiple parameters', () => {
      const result = assemble(`
        .ORG $8000

        .MACRO STORE addr, val
          LDA #\\val
          STA \\addr
        .ENDM

        START:
          STORE $1000, $42
          HLT
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0xA9, 0x42,       // LDA #$42
        0x8D, 0x00, 0x10, // STA $1000
        0x02,             // HLT
      ]);
    });

    it('should handle local labels in macros', () => {
      const result = assemble(`
        .ORG $8000

        .MACRO DELAY count
          LDX #\\count
        @LOOP:
          DEX
          BNE @LOOP
        .ENDM

        START:
          DELAY $10
          DELAY $20
          HLT
      `);
      expect(result.errors).toHaveLength(0);
      // Each macro expansion should have unique local labels
      const bytes = Array.from(result.bytes);
      // First DELAY: LDX #$10, DEX, BNE back
      expect(bytes[0]).toBe(0xA2); // LDX immediate
      expect(bytes[1]).toBe(0x10);
      expect(bytes[2]).toBe(0xCA); // DEX
      expect(bytes[3]).toBe(0xD0); // BNE
      // Second DELAY should also work
      expect(bytes[5]).toBe(0xA2); // LDX immediate
      expect(bytes[6]).toBe(0x20);
    });

    it('should handle numeric parameter references (\\1, \\2)', () => {
      const result = assemble(`
        .ORG $8000

        .MACRO ADD_VALUES a, b
          LDA #\\1
          CLC
          ADC #\\2
        .ENDM

        START:
          ADD_VALUES $10, $20
          HLT
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0xA9, 0x10, // LDA #$10
        0x18,       // CLC
        0x69, 0x20, // ADC #$20
        0x02,       // HLT
      ]);
    });
  });

  describe('Conditional Assembly', () => {
    it('should include code when .IF condition is true', () => {
      const result = assemble(`
        .ORG $8000
        .DEFINE DEBUG 1

        .IF DEBUG
          LDA #$42
        .ENDIF
        HLT
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0xA9, 0x42, // LDA #$42
        0x02,       // HLT
      ]);
    });

    it('should exclude code when .IF condition is false', () => {
      const result = assemble(`
        .ORG $8000
        .DEFINE DEBUG 0

        .IF DEBUG
          LDA #$42
        .ENDIF
        HLT
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0x02, // HLT only
      ]);
    });

    it('should handle .ELSE correctly', () => {
      const result = assemble(`
        .ORG $8000
        .DEFINE MODE 0

        .IF MODE
          LDA #$42
        .ELSE
          LDA #$FF
        .ENDIF
        HLT
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0xA9, 0xFF, // LDA #$FF (from ELSE branch)
        0x02,       // HLT
      ]);
    });

    it('should handle .IFDEF for defined symbols', () => {
      const result = assemble(`
        .ORG $8000
        .DEFINE FEATURE_A 1

        .IFDEF FEATURE_A
          LDA #$AA
        .ENDIF
        .IFDEF FEATURE_B
          LDA #$BB
        .ENDIF
        HLT
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0xA9, 0xAA, // LDA #$AA (FEATURE_A defined)
        0x02,       // HLT (FEATURE_B not defined, skipped)
      ]);
    });

    it('should handle .IFNDEF for undefined symbols', () => {
      const result = assemble(`
        .ORG $8000

        .IFNDEF UNDEFINED
          LDA #$42
        .ENDIF
        HLT
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0xA9, 0x42,
        0x02,
      ]);
    });

    it('should handle comparison operators in .IF', () => {
      const result = assemble(`
        .ORG $8000
        .DEFINE VERSION 2

        .IF VERSION >= 2
          LDA #$02
        .ENDIF
        .IF VERSION < 1
          LDA #$00
        .ENDIF
        HLT
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0xA9, 0x02, // VERSION >= 2 is true
        0x02,       // VERSION < 1 is false, skipped
      ]);
    });
  });

  describe('Repeat Blocks', () => {
    it('should repeat code blocks', () => {
      const result = assemble(`
        .ORG $8000
        .REPEAT 3
          NOP
        .ENDR
        HLT
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0xEA, 0xEA, 0xEA, // 3 NOPs
        0x02,             // HLT
      ]);
    });

    it('should repeat data definitions', () => {
      const result = assemble(`
        .ORG $8000
        TABLE:
        .REPEAT 4
          .DB $FF
        .ENDR
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0xFF, 0xFF, 0xFF, 0xFF,
      ]);
    });

    it('should handle nested repeat blocks', () => {
      const result = assemble(`
        .ORG $8000
        .REPEAT 2
          .REPEAT 2
            NOP
          .ENDR
        .ENDR
        HLT
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0xEA, 0xEA, 0xEA, 0xEA, // 2*2 = 4 NOPs
        0x02,                   // HLT
      ]);
    });
  });

  describe('Enhanced Expressions', () => {
    it('should handle bitwise OR', () => {
      const result = assemble(`
        .ORG $8000
        LDA #$F0 | $0F
        HLT
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0xA9, 0xFF, // $F0 | $0F = $FF
        0x02,
      ]);
    });

    it('should handle bitwise AND', () => {
      const result = assemble(`
        .ORG $8000
        LDA #$FF & $0F
        HLT
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0xA9, 0x0F,
        0x02,
      ]);
    });

    it('should handle bitwise XOR', () => {
      const result = assemble(`
        .ORG $8000
        LDA #$AA ^ $55
        HLT
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0xA9, 0xFF, // $AA ^ $55 = $FF
        0x02,
      ]);
    });

    it('should handle left shift', () => {
      const result = assemble(`
        .ORG $8000
        LDA #$01 << 4
        HLT
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0xA9, 0x10, // $01 << 4 = $10
        0x02,
      ]);
    });

    it('should handle right shift', () => {
      const result = assemble(`
        .ORG $8000
        LDA #$80 >> 4
        HLT
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0xA9, 0x08, // $80 >> 4 = $08
        0x02,
      ]);
    });

    it('should handle multiplication', () => {
      const result = assemble(`
        .ORG $8000
        LDA #$04 * $10
        HLT
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0xA9, 0x40, // $04 * $10 = $40
        0x02,
      ]);
    });

    it('should handle division', () => {
      const result = assemble(`
        .ORG $8000
        LDA #$40 / $10
        HLT
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0xA9, 0x04, // $40 / $10 = $04
        0x02,
      ]);
    });

    it('should handle modulo', () => {
      const result = assemble(`
        .ORG $8000
        LDA #$45 % $10
        HLT
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0xA9, 0x05, // $45 % $10 = $05
        0x02,
      ]);
    });

    it('should handle operator precedence', () => {
      const result = assemble(`
        .ORG $8000
        LDA #$02 + $03 * $04
        HLT
      `);
      expect(result.errors).toHaveLength(0);
      // Should be 2 + (3 * 4) = 14, not (2 + 3) * 4 = 20
      expect(Array.from(result.bytes)).toEqual([
        0xA9, 0x0E, // 14 = $0E
        0x02,
      ]);
    });

    it('should handle parenthesized expressions', () => {
      const result = assemble(`
        .ORG $8000
        LDA #($02 + $03) * $04
        HLT
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0xA9, 0x14, // (2 + 3) * 4 = 20 = $14
        0x02,
      ]);
    });

    it('should handle low/high byte operators with expressions', () => {
      const result = assemble(`
        .ORG $8000
        BASE = $1234
        LDA #<BASE
        LDX #>BASE
        HLT
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0xA9, 0x34, // <$1234 = $34
        0xA2, 0x12, // >$1234 = $12
        0x02,
      ]);
    });

    it('should handle current PC (*) in expressions', () => {
      const result = assemble(`
        .ORG $8000
        START:
          JMP *+3    ; Jump over the HLT
          HLT
          NOP
      `);
      expect(result.errors).toHaveLength(0);
      // JMP is at $8000, * = $8000 at parse time, *+3 = $8003
      const bytes = Array.from(result.bytes);
      expect(bytes[0]).toBe(0x4C); // JMP
      expect(bytes[1]).toBe(0x03); // lo byte of $8003
      expect(bytes[2]).toBe(0x80); // hi byte of $8003
      expect(bytes[3]).toBe(0x02); // HLT at $8003
      expect(bytes[4]).toBe(0xEA); // NOP at $8004
    });
  });

  describe('New Directives', () => {
    it('should handle .ASCIIZ (null-terminated string)', () => {
      const result = assemble(`
        .ORG $8000
        MESSAGE:
          .ASCIIZ "Hi"
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0x48, 0x69, 0x00, // "Hi" + null
      ]);
    });

    it('should handle .ASCII (non-terminated string)', () => {
      const result = assemble(`
        .ORG $8000
        MESSAGE:
          .ASCII "Hi"
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0x48, 0x69, // "Hi" without null
      ]);
    });

    it('should handle .DS (define storage)', () => {
      const result = assemble(`
        .ORG $8000
        BUFFER:
          .DS 4
        END:
          HLT
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0x00, 0x00, 0x00, 0x00, // 4 zero bytes
        0x02,                   // HLT
      ]);
      expect(result.labels.get('END')).toBe(0x8004);
    });

    it('should handle .DS with fill value', () => {
      const result = assemble(`
        .ORG $8000
        BUFFER:
          .DS 3, $FF
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0xFF, 0xFF, 0xFF,
      ]);
    });

    it('should handle .RES (alias for .DS)', () => {
      const result = assemble(`
        .ORG $8000
        BUFFER:
          .RES 2, $AA
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0xAA, 0xAA,
      ]);
    });

    it('should handle .ALIGN directive', () => {
      const result = assemble(`
        .ORG $8000
        START:
          NOP        ; at $8000
          .ALIGN 4   ; pad to $8004
        ALIGNED:
          HLT
      `);
      expect(result.errors).toHaveLength(0);
      expect(result.labels.get('ALIGNED')).toBe(0x8004);
      expect(Array.from(result.bytes)).toEqual([
        0xEA,             // NOP at $8000
        0x00, 0x00, 0x00, // padding to align to 4
        0x02,             // HLT at $8004
      ]);
    });

    it('should handle .ALIGN with fill value', () => {
      const result = assemble(`
        .ORG $8001
        START:
          NOP
          .ALIGN 4, $EA
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0xEA,       // NOP at $8001
        0xEA, 0xEA, // fill with $EA (NOP) to align to $8004
      ]);
    });

    it('should handle .PROC and .ENDPROC for scoping', () => {
      const result = assemble(`
        .ORG $8000
        .PROC MAIN
          JSR HELPER
          RTS
        .ENDPROC

        .PROC HELPER
          INX
          RTS
        .ENDPROC
      `);
      expect(result.errors).toHaveLength(0);
      expect(result.labels.get('MAIN')).toBe(0x8000);
      expect(result.labels.get('HELPER')).toBe(0x8004);
    });
  });

  describe('Number Formats', () => {
    it('should handle hex with $ prefix', () => {
      const result = assemble(`
        .ORG $8000
        LDA #$FF
      `);
      expect(result.errors).toHaveLength(0);
      expect(result.bytes[1]).toBe(0xFF);
    });

    it('should handle hex with 0x prefix', () => {
      const result = assemble(`
        .ORG $8000
        LDA #0xFF
      `);
      expect(result.errors).toHaveLength(0);
      expect(result.bytes[1]).toBe(0xFF);
    });

    it('should handle binary with 0b prefix', () => {
      const result = assemble(`
        .ORG $8000
        LDA #0b11110000
      `);
      expect(result.errors).toHaveLength(0);
      expect(result.bytes[1]).toBe(0xF0);
    });

    it('should handle decimal numbers', () => {
      const result = assemble(`
        .ORG $8000
        LDA #255
      `);
      expect(result.errors).toHaveLength(0);
      expect(result.bytes[1]).toBe(0xFF);
    });

    it('should handle character literals', () => {
      const result = assemble(`
        .ORG $8000
        LDA #'A'
        LDX #'Z'
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0xA9, 0x41, // 'A' = 65
        0xA2, 0x5A, // 'Z' = 90
      ]);
    });

    it('should handle escape sequences in character literals', () => {
      const result = assemble(`
        .ORG $8000
        LDA #'\\n'
        LDX #'\\0'
      `);
      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0xA9, 0x0A, // newline = 10
        0xA2, 0x00, // null = 0
      ]);
    });
  });

  describe('Error Handling', () => {
    it('should report undefined label errors', () => {
      const result = assemble(`
        .ORG $8000
        JMP UNDEFINED
      `);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Undefined label');
    });

    it('should report branch out of range errors', () => {
      const result = assemble(`
        .ORG $8000
        START:
          .DS 200
        FAR:
          BNE START  ; More than 128 bytes back
      `);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('out of range');
    });
  });

  describe('Include Files', () => {
    it('should include files when resolver is provided', () => {
      const includes: Record<string, string> = {
        'defs.inc': `
          CONST_A = $10
          CONST_B = $20
        `,
      };

      const result = assemble(`
        .ORG $8000
        .INCLUDE "defs.inc"
        LDA #CONST_A
        LDX #CONST_B
        HLT
      `, {
        includeResolver: (filename) => includes[filename] || null,
      });

      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0xA9, 0x10,
        0xA2, 0x20,
        0x02,
      ]);
    });

    it('should report error for missing include files', () => {
      const result = assemble(`
        .ORG $8000
        .INCLUDE "missing.inc"
      `, {
        includeResolver: () => null,
      });

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('not found');
    });
  });

  describe('Predefined Constants', () => {
    it('should use predefined constants from options', () => {
      const result = assemble(`
        .ORG $8000
        LDA #VERSION
        HLT
      `, {
        defines: { VERSION: 0x42 },
      });

      expect(result.errors).toHaveLength(0);
      expect(Array.from(result.bytes)).toEqual([
        0xA9, 0x42,
        0x02,
      ]);
    });
  });

  describe('Example Programs', () => {
    it('should assemble MACRO_EXAMPLE without errors', () => {
      const result = assemble(MACRO_EXAMPLE);
      expect(result.errors).toHaveLength(0);
      expect(result.bytes.length).toBeGreaterThan(0);
    });

    it('should assemble CONDITIONAL_EXAMPLE without errors', () => {
      const result = assemble(CONDITIONAL_EXAMPLE);
      expect(result.errors).toHaveLength(0);
      expect(result.bytes.length).toBeGreaterThan(0);
    });

    it('should assemble REPEAT_EXAMPLE without errors', () => {
      const result = assemble(REPEAT_EXAMPLE);
      expect(result.errors).toHaveLength(0);
      expect(result.bytes.length).toBeGreaterThan(0);
    });

    it('should assemble EXPRESSION_EXAMPLE without errors', () => {
      const result = assemble(EXPRESSION_EXAMPLE);
      expect(result.errors).toHaveLength(0);
      expect(result.bytes.length).toBeGreaterThan(0);
    });
  });

  describe('ROM Image Creation', () => {
    it('should create ROM image with reset vector', () => {
      const code = new Uint8Array([0xA9, 0x42, 0x02]);
      const rom = createRomImage(code, 0x8000);

      expect(rom[0]).toBe(0xA9);
      expect(rom[1]).toBe(0x42);
      expect(rom[2]).toBe(0x02);

      expect(rom[0x7FFC]).toBe(0x00);
      expect(rom[0x7FFD]).toBe(0x80);
    });
  });
});
