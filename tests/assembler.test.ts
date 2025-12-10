import { describe, it, expect } from 'vitest';
import { assemble, OPCODES, createRomImage, HELLO_WORLD } from '../src/assembler/stage0.js';

describe('Stage 0 Assembler', () => {
  it('should assemble implied mode instructions', () => {
    const result = assemble(`
      INX
      DEX
      INY
      DEY
      HLT
    `);
    expect(Array.from(result.bytes)).toEqual([
      OPCODES.INX, // 0xE8
      OPCODES.DEX, // 0xCA
      OPCODES.INY, // 0xC8
      OPCODES.DEY, // 0x88
      OPCODES.HLT, // 0x02
    ]);
  });

  it('should assemble immediate mode instructions', () => {
    const result = assemble(`
      LDA #$42
      LDX #$10
      LDY #$FF
    `);
    expect(Array.from(result.bytes)).toEqual([
      0xA9, 0x42, // LDA #$42
      0xA2, 0x10, // LDX #$10
      0xA0, 0xFF, // LDY #$FF
    ]);
  });

  it('should assemble absolute mode instructions', () => {
    const result = assemble(`
      STA $1234
      LDA $ABCD
      JMP $8000
    `);
    expect(Array.from(result.bytes)).toEqual([
      0x8D, 0x34, 0x12, // STA $1234 (lo, hi)
      0xAD, 0xCD, 0xAB, // LDA abs $ABCD
      0x4C, 0x00, 0x80, // JMP $8000
    ]);
  });

  it('should handle labels', () => {
    const result = assemble(`
      .ORG $0200
      START:
        LDA #$00
        JMP START
    `);
    expect(result.labels.get('START')).toBe(0x0200);
    expect(Array.from(result.bytes)).toEqual([
      0xA9, 0x00,       // LDA #$00
      0x4C, 0x00, 0x02, // JMP $0200
    ]);
  });

  it('should handle relative branches', () => {
    const result = assemble(`
      .ORG $0200
      LOOP:
        INX
        BNE LOOP
    `);
    // BNE at address 0x0201, target is 0x0200
    // Offset = target - (pc + 2) = 0x0200 - 0x0203 = -3 = 0xFD
    expect(Array.from(result.bytes)).toEqual([
      0xE8,       // INX
      0xD0, 0xFD, // BNE -3 (back to LOOP)
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
    // BEQ at 0x0202, SKIP at 0x0205
    // Offset = 0x0205 - (0x0202 + 2) = 0x0205 - 0x0204 = 1
    expect(Array.from(result.bytes)).toEqual([
      0xA9, 0x00, // LDA #$00
      0xF0, 0x01, // BEQ +1 (skip over INX)
      0xE8,       // INX
      0x02,       // HLT
    ]);
  });

  it('should assemble Hello World', () => {
    const result = assemble(HELLO_WORLD);
    expect(result.origin).toBe(0x8000);
    expect(result.bytes.length).toBeGreaterThan(0);

    // First instruction should be LDA #$48 ('H')
    expect(result.bytes[0]).toBe(0xA9);
    expect(result.bytes[1]).toBe(0x48);
  });

  it('should create ROM image with reset vector', () => {
    const code = new Uint8Array([0xA9, 0x42, 0x02]); // LDA #$42, HLT
    const rom = createRomImage(code, 0x8000);

    // Code should be at offset 0 (0x8000 - 0x8000)
    expect(rom[0]).toBe(0xA9);
    expect(rom[1]).toBe(0x42);
    expect(rom[2]).toBe(0x02);

    // Reset vector at 0x7FFC should point to 0x8000
    expect(rom[0x7FFC]).toBe(0x00); // lo byte
    expect(rom[0x7FFD]).toBe(0x80); // hi byte
  });

  it('should assemble stack operations', () => {
    const result = assemble(`
      PHA
      PLA
      TXS
    `);
    expect(Array.from(result.bytes)).toEqual([
      0x48, // PHA
      0x68, // PLA
      0x9A, // TXS
    ]);
  });

  it('should assemble ALU operations', () => {
    const result = assemble(`
      CLC
      ADC #$10
      SEC
      SBC #$05
      AND #$0F
      ORA #$F0
      EOR #$FF
      CMP #$42
    `);
    expect(Array.from(result.bytes)).toEqual([
      0x18,       // CLC
      0x69, 0x10, // ADC #$10
      0x38,       // SEC
      0xE9, 0x05, // SBC #$05
      0x29, 0x0F, // AND #$0F
      0x09, 0xF0, // ORA #$F0
      0x49, 0xFF, // EOR #$FF
      0xC9, 0x42, // CMP #$42
    ]);
  });

  it('should assemble JSR/RTS', () => {
    const result = assemble(`
      .ORG $8000
      START:
        JSR SUBROUTINE
        HLT
      SUBROUTINE:
        INX
        RTS
    `);
    expect(Array.from(result.bytes)).toEqual([
      0x20, 0x04, 0x80, // JSR $8004 (SUBROUTINE)
      0x02,             // HLT
      0xE8,             // INX
      0x60,             // RTS
    ]);
  });

  it('should handle .DW with forward references', () => {
    // This test verifies that .DW directives with forward label references
    // are correctly resolved. This was a bug where .DW would emit 0x00 0x00
    // for forward references because the label resolution happened too early.
    const result = assemble(`
      .ORG $1000
      ; Table of pointers (using forward references)
      TABLE:
        .DW DATA_A, DATA_B, DATA_C
      CODE:
        LDA TABLE
        RTS
      DATA_A: .DB $11
      DATA_B: .DB $22
      DATA_C: .DB $33
    `);

    // TABLE is at $1000, each .DW is 2 bytes, so:
    // - TABLE+0 ($1000) points to DATA_A
    // - TABLE+2 ($1002) points to DATA_B
    // - TABLE+4 ($1004) points to DATA_C
    // CODE is at $1006 (3 bytes for LDA abs + 1 byte for RTS = 4 bytes)
    // DATA_A is at $100A
    // DATA_B is at $100B
    // DATA_C is at $100C

    const bytes = Array.from(result.bytes);

    // First .DW should be pointer to DATA_A ($100A)
    expect(bytes[0]).toBe(0x0A);  // Low byte of $100A
    expect(bytes[1]).toBe(0x10);  // High byte of $100A

    // Second .DW should be pointer to DATA_B ($100B)
    expect(bytes[2]).toBe(0x0B);  // Low byte of $100B
    expect(bytes[3]).toBe(0x10);  // High byte of $100B

    // Third .DW should be pointer to DATA_C ($100C)
    expect(bytes[4]).toBe(0x0C);  // Low byte of $100C
    expect(bytes[5]).toBe(0x10);  // High byte of $100C

    // CODE follows
    expect(bytes[6]).toBe(0xAD);  // LDA abs opcode
    expect(bytes[7]).toBe(0x00);  // Low byte of TABLE ($1000)
    expect(bytes[8]).toBe(0x10);  // High byte of TABLE ($1000)
    expect(bytes[9]).toBe(0x60);  // RTS

    // DATA bytes
    expect(bytes[10]).toBe(0x11); // DATA_A
    expect(bytes[11]).toBe(0x22); // DATA_B
    expect(bytes[12]).toBe(0x33); // DATA_C
  });
});
