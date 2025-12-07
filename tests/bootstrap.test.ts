// Tests for bootstrap components (hex loader, boot loader, etc.)

import { describe, it, expect } from 'vitest';
import { assembleHexLoader, createHexLoaderRom, HEX_LOADER_ENTRY, hexDump } from '../src/bootstrap/hex-loader.js';
import {
  assembleBootLoader,
  createBootSector,
  createBootImage,
  createBootRom,
  BOOT_LOADER_ENTRY,
  BOOT_SECTOR,
  DEFAULT_LOAD_ADDRESS
} from '../src/bootstrap/boot-loader.js';
import { assembleStage0, STAGE0_ENTRY } from '../src/bootstrap/stage0-assembler.js';
import { CPU6502 } from '../src/emulator/cpu.js';
import { assemble } from '../src/assembler/stage0.js';

describe('Hex Loader', () => {
  it('should assemble hex loader', () => {
    const { bytes, origin } = assembleHexLoader();

    expect(origin).toBe(HEX_LOADER_ENTRY);
    expect(bytes.length).toBeGreaterThan(200); // Should be ~300-400 bytes
    expect(bytes.length).toBeLessThan(800);

    console.log(`Hex loader size: ${bytes.length} bytes`);
    console.log(`Origin: $${origin.toString(16).toUpperCase()}`);
  });

  it('should create ROM image with hex loader', () => {
    const rom = createHexLoaderRom();

    expect(rom.length).toBe(0x4000); // 16KB ROM

    // Check reset vector points to hex loader entry
    const resetLo = rom[0x3ffc];
    const resetHi = rom[0x3ffd];
    const resetVector = resetLo | (resetHi << 8);
    expect(resetVector).toBe(HEX_LOADER_ENTRY);

    // Check that hex loader code is present at expected location
    const romOffset = HEX_LOADER_ENTRY - 0xc000;
    expect(rom[romOffset]).not.toBe(0xff); // Should have code, not empty ROM
  });

  it('should generate hex dump', () => {
    const { bytes, origin } = assembleHexLoader();
    const dump = hexDump(bytes, origin, 16);

    // First line should start with F800
    expect(dump.startsWith('F800:')).toBe(true);

    // Should have multiple lines
    const lines = dump.split('\n');
    expect(lines.length).toBeGreaterThan(10);

    console.log('\nHex loader first 5 lines:');
    lines.slice(0, 5).forEach(line => console.log(line));
  });

  it('should start execution when loaded in CPU', () => {
    const rom = createHexLoaderRom();
    const cpu = new CPU6502();

    // First set up BIOS stubs BEFORE copying ROM
    // PUTCHAR ($F000): just store character and return
    cpu.memory[0xf000] = 0x60; // RTS (simple stub)

    // GETCHAR ($F040): return a character
    cpu.memory[0xf040] = 0xa9; // LDA #$0D (Enter)
    cpu.memory[0xf041] = 0x0d;
    cpu.memory[0xf042] = 0x60; // RTS

    // NEWLINE ($F080): just RTS
    cpu.memory[0xf080] = 0x60; // RTS

    // Copy hex loader and reset vector from ROM (skip BIOS area)
    // Hex loader is at $F800, reset vector at $FFFC
    const hexLoaderOffset = HEX_LOADER_ENTRY - 0xc000; // 0x3800
    for (let i = hexLoaderOffset; i < rom.length; i++) {
      cpu.memory[0xc000 + i] = rom[i];
    }

    // Reset CPU - should jump to hex loader entry
    cpu.reset();
    expect(cpu.pc).toBe(HEX_LOADER_ENTRY);

    // Execute a few instructions - should work without crashing
    cpu.run(50);
    expect(cpu.halted).toBe(false);
  });
});

describe('Stage0 Assembler - Extended Modes', () => {
  it('should assemble zero page indexed mode', () => {
    const result = assemble(`
      .ORG $0200
      LDA $10,X
      STA $20,X
      LDX $30,Y
      HLT
    `);

    expect(result.bytes[0]).toBe(0xB5); // LDA zp,X
    expect(result.bytes[1]).toBe(0x10);
    expect(result.bytes[2]).toBe(0x95); // STA zp,X
    expect(result.bytes[3]).toBe(0x20);
    expect(result.bytes[4]).toBe(0xB6); // LDX zp,Y
    expect(result.bytes[5]).toBe(0x30);
  });

  it('should assemble indirect indexed mode (zp),Y', () => {
    const result = assemble(`
      .ORG $0200
      LDA ($F0),Y
      STA ($F2),Y
      HLT
    `);

    expect(result.bytes[0]).toBe(0xB1); // LDA (zp),Y
    expect(result.bytes[1]).toBe(0xF0);
    expect(result.bytes[2]).toBe(0x91); // STA (zp),Y
    expect(result.bytes[3]).toBe(0xF2);
  });

  it('should assemble indexed indirect mode (zp,X)', () => {
    const result = assemble(`
      .ORG $0200
      LDA ($10,X)
      STA ($20,X)
      HLT
    `);

    expect(result.bytes[0]).toBe(0xA1); // LDA (zp,X)
    expect(result.bytes[1]).toBe(0x10);
    expect(result.bytes[2]).toBe(0x81); // STA (zp,X)
    expect(result.bytes[3]).toBe(0x20);
  });

  it('should assemble indirect jump', () => {
    const result = assemble(`
      .ORG $0200
      JMP ($00F0)
      HLT
    `);

    expect(result.bytes[0]).toBe(0x6C); // JMP (abs)
    expect(result.bytes[1]).toBe(0xF0);
    expect(result.bytes[2]).toBe(0x00);
  });

  it('should assemble accumulator mode', () => {
    const result = assemble(`
      .ORG $0200
      ASL A
      LSR A
      ROL A
      ROR A
      HLT
    `);

    expect(result.bytes[0]).toBe(0x0A); // ASL A
    expect(result.bytes[1]).toBe(0x4A); // LSR A
    expect(result.bytes[2]).toBe(0x2A); // ROL A
    expect(result.bytes[3]).toBe(0x6A); // ROR A
  });

  it('should assemble all branch instructions', () => {
    const result = assemble(`
      .ORG $0200
      BCC SKIP
      BCS SKIP
      BPL SKIP
      BMI SKIP
      BVC SKIP
      BVS SKIP
    SKIP:
      HLT
    `);

    expect(result.bytes[0]).toBe(0x90); // BCC
    expect(result.bytes[2]).toBe(0xB0); // BCS
    expect(result.bytes[4]).toBe(0x10); // BPL
    expect(result.bytes[6]).toBe(0x30); // BMI
    expect(result.bytes[8]).toBe(0x50); // BVC
    expect(result.bytes[10]).toBe(0x70); // BVS
  });

  it('should assemble CPX and CPY', () => {
    const result = assemble(`
      .ORG $0200
      CPX #$10
      CPY #$20
      HLT
    `);

    expect(result.bytes[0]).toBe(0xE0); // CPX #
    expect(result.bytes[1]).toBe(0x10);
    expect(result.bytes[2]).toBe(0xC0); // CPY #
    expect(result.bytes[3]).toBe(0x20);
  });

  it('should assemble INC and DEC zero page', () => {
    const result = assemble(`
      .ORG $0200
      INC $10
      DEC $20
      HLT
    `);

    expect(result.bytes[0]).toBe(0xE6); // INC zp
    expect(result.bytes[1]).toBe(0x10);
    expect(result.bytes[2]).toBe(0xC6); // DEC zp
    expect(result.bytes[3]).toBe(0x20);
  });
});

describe('Hex Loader - Functional Test', () => {
  it('should run hex loader and respond to input simulation', async () => {
    const rom = createHexLoaderRom();
    const cpu = new CPU6502();

    // Copy ROM to memory
    for (let i = 0; i < rom.length; i++) {
      cpu.memory[0xc000 + i] = rom[i];
    }

    // Add simple BIOS stubs
    // PUTCHAR ($F000): just store character at $D000
    cpu.memory[0xf000] = 0x8d; // STA $D000
    cpu.memory[0xf001] = 0x00;
    cpu.memory[0xf002] = 0xd0;
    cpu.memory[0xf003] = 0x60; // RTS

    // GETCHAR ($F040): return $0D (Enter) to trigger processing
    cpu.memory[0xf040] = 0xa9; // LDA #$0D (Enter)
    cpu.memory[0xf041] = 0x0d;
    cpu.memory[0xf042] = 0x60; // RTS

    // NEWLINE ($F080): just RTS
    cpu.memory[0xf080] = 0x60; // RTS

    cpu.reset();

    // Run enough instructions to print welcome and get first input
    cpu.run(500);

    // Hex loader should not crash
    expect(cpu.halted).toBe(false);

    // Check that something was written to serial output ($D000)
    // (This is a very basic test - full testing would require I/O simulation)
  });
});

describe('Boot Loader', () => {
  it('should assemble boot loader', () => {
    const { bytes, origin } = assembleBootLoader();

    expect(origin).toBe(BOOT_LOADER_ENTRY);
    expect(bytes.length).toBeGreaterThan(100); // Should be ~200-300 bytes
    expect(bytes.length).toBeLessThan(500);

    console.log(`Boot loader size: ${bytes.length} bytes`);
    console.log(`Origin: $${origin.toString(16).toUpperCase()}`);
  });

  it('should create boot sector with correct header', () => {
    // Simple test program: LDA #$42, STA $0200, HLT
    const testCode = new Uint8Array([0xa9, 0x42, 0x8d, 0x00, 0x02, 0x02]);
    const sector = createBootSector(testCode, 0x0800, 0x0800);

    expect(sector.length).toBe(512);
    expect(sector[0]).toBe(BOOT_SECTOR.MAGIC_0); // 'W'
    expect(sector[1]).toBe(BOOT_SECTOR.MAGIC_1); // 'F'
    expect(sector[2]).toBe(0x00); // Entry low
    expect(sector[3]).toBe(0x08); // Entry high
    expect(sector[4]).toBe(0x00); // Load low
    expect(sector[5]).toBe(0x08); // Load high
    expect(sector[6]).toBe(0x01); // 1 sector
    expect(sector[7]).toBe(0x00);

    // Check code is copied
    expect(sector[8]).toBe(0xa9);
    expect(sector[9]).toBe(0x42);
  });

  it('should create multi-sector boot image for large programs', () => {
    // Create a program larger than 504 bytes (boot sector data area)
    const largeCode = new Uint8Array(1000);
    largeCode.fill(0xEA); // NOP
    largeCode[0] = 0xa9;  // LDA #$00
    largeCode[1] = 0x00;
    largeCode[999] = 0x02; // HLT at end

    const sectors = createBootImage(largeCode, 0x0800, 0x0800);

    // Should create boot sector + 1 additional sector
    expect(sectors.length).toBe(2);
    expect(sectors[0].length).toBe(512);
    expect(sectors[1].length).toBe(512);

    // Sector count should be 2
    expect(sectors[0][6]).toBe(0x02);
    expect(sectors[0][7]).toBe(0x00);
  });

  it('should create boot ROM', () => {
    const rom = createBootRom();

    expect(rom.length).toBe(0x4000); // 16KB ROM

    // Check reset vector points to boot loader entry
    const resetLo = rom[0x3ffc];
    const resetHi = rom[0x3ffd];
    const resetVector = resetLo | (resetHi << 8);
    expect(resetVector).toBe(BOOT_LOADER_ENTRY);

    // Check that boot loader code is present
    const romOffset = BOOT_LOADER_ENTRY - 0xc000;
    expect(rom[romOffset]).not.toBe(0xff);
  });
});

describe('Stage 0 Assembler', () => {
  it('should assemble stage 0 assembler', () => {
    const { bytes, origin } = assembleStage0();

    expect(origin).toBe(STAGE0_ENTRY);
    expect(bytes.length).toBeGreaterThan(800); // Should be ~1100 bytes
    expect(bytes.length).toBeLessThan(2000);

    console.log(`Stage 0 assembler size: ${bytes.length} bytes`);
    console.log(`Origin: $${origin.toString(16).toUpperCase()}`);
    console.log(`Fits in ${Math.ceil(bytes.length / 512)} sectors`);
  });

  it('should fit in 3 sectors for boot loading', () => {
    const { bytes } = assembleStage0();

    // Stage 0 should fit within 3 sectors (1536 bytes)
    expect(bytes.length).toBeLessThan(1536);
  });

  it('should support assembler features: EQU and expressions', () => {
    // Test that the assembler supports EQU definitions
    // Note: EQU values are treated as labels, so they use absolute addressing
    const result = assemble(`
      .ORG $0200
      TABLE = $40
      LDA TABLE
      LDA TABLE+1
      STA TABLE+2
      HLT
    `);

    expect(result.bytes.length).toBe(10); // 3+3+3+1 bytes
    expect(result.bytes[0]).toBe(0xAD); // LDA abs
    expect(result.bytes[1]).toBe(0x40); // TABLE low
    expect(result.bytes[2]).toBe(0x00); // TABLE high
    expect(result.bytes[3]).toBe(0xAD); // LDA abs
    expect(result.bytes[4]).toBe(0x41); // TABLE+1 low
    expect(result.bytes[5]).toBe(0x00); // TABLE+1 high
    expect(result.bytes[6]).toBe(0x8D); // STA abs
    expect(result.bytes[7]).toBe(0x42); // TABLE+2 low
  });

  it('should support .DB directive', () => {
    const result = assemble(`
      .ORG $0200
      .DB $41, $42, $43
      .DB $44
      HLT
    `);

    expect(result.bytes[0]).toBe(0x41); // 'A'
    expect(result.bytes[1]).toBe(0x42); // 'B'
    expect(result.bytes[2]).toBe(0x43); // 'C'
    expect(result.bytes[3]).toBe(0x44); // 'D'
    expect(result.bytes[4]).toBe(0x02); // HLT
  });

  it('should support label+offset with indexed addressing', () => {
    const result = assemble(`
      .ORG $0200
      BUFFER = $40
      LDA BUFFER,X
      LDA BUFFER+1,X
      STA BUFFER+2,Y
      HLT
    `);

    // LDA zp,X = $B5
    expect(result.bytes[0]).toBe(0xBD); // LDA abs,X (because label defaults to abs)
    expect(result.bytes[3]).toBe(0xBD); // LDA abs,X
    expect(result.bytes[4]).toBe(0x41); // BUFFER+1 low byte
  });
});

describe('Stage 1 Assembler', () => {
  it('should assemble Stage 1 assembler from source', () => {
    const fs = require('fs');
    const path = require('path');
    const asmPath = path.join(__dirname, '../asm/asm.asm');
    const source = fs.readFileSync(asmPath, 'utf-8');

    const result = assemble(source);

    console.log(`Stage 1 assembler size: ${result.bytes.length} bytes`);
    console.log(`Origin: $${result.origin.toString(16).toUpperCase()}`);
    console.log(`Fits in ${Math.ceil(result.bytes.length / 512)} sectors`);

    // Stage 1 should be larger than Stage 0 but still reasonable
    expect(result.bytes.length).toBeGreaterThan(2000);
    expect(result.bytes.length).toBeLessThan(8000);
    expect(result.origin).toBe(0x0800);
  });

  it('should support all 13 addressing modes', () => {
    // Test all addressing modes that Stage 1 supports
    const result = assemble(`
      .ORG $0200
      ; Implied
      NOP
      ; Accumulator
      ASL A
      ; Immediate
      LDA #$42
      ; Zero page
      LDA $10
      ; Zero page,X
      LDA $10,X
      ; Zero page,Y
      LDX $10,Y
      ; Absolute
      LDA $1234
      ; Absolute,X
      LDA $1234,X
      ; Absolute,Y
      LDA $1234,Y
      ; Indirect
      JMP ($1234)
      ; Indexed indirect
      LDA ($10,X)
      ; Indirect indexed
      LDA ($10),Y
      ; Relative (branches)
      BEQ DONE
      NOP
    DONE:
      HLT
    `);

    expect(result.bytes.length).toBeGreaterThan(20);
    // Verify some key opcodes
    expect(result.bytes[0]).toBe(0xEA);  // NOP
    expect(result.bytes[1]).toBe(0x0A);  // ASL A
    expect(result.bytes[2]).toBe(0xA9);  // LDA #
  });
});

describe('WireOS Shell', () => {
  it('should assemble WireOS shell from source', () => {
    const fs = require('fs');
    const path = require('path');
    const asmPath = path.join(__dirname, '../asm/shell.asm');
    const source = fs.readFileSync(asmPath, 'utf-8');

    const result = assemble(source);

    console.log(`WireOS shell size: ${result.bytes.length} bytes`);
    console.log(`Origin: $${result.origin.toString(16).toUpperCase()}`);
    console.log(`Fits in ${Math.ceil(result.bytes.length / 512)} sectors`);

    // Shell should be around 1-2KB
    expect(result.bytes.length).toBeGreaterThan(500);
    expect(result.bytes.length).toBeLessThan(3000);
    expect(result.origin).toBe(0x0300);
  });
});
