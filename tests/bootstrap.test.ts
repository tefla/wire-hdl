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

import { assembleShell, getShellHexPairs } from '../src/bootstrap/shell.js';
import { assembleBios } from '../src/assembler/bios.js';

// I/O registers for bootstrap tests
const IO = {
  SERIAL_STATUS: 0x8030,
  SERIAL_DATA: 0x8031,
  KBD_STATUS: 0x8010,
  KBD_DATA: 0x8011,
};

/**
 * Test computer for bootstrap testing with proper I/O simulation
 */
class BootstrapComputer {
  cpu: CPU6502;
  memory: Uint8Array;
  output: string = '';
  keyBuffer: number[] = [];

  constructor() {
    this.memory = new Uint8Array(65536);
    this.loadRom();
    this.cpu = new CPU6502(this.memory);
    this.cpu.reset();
  }

  private loadRom(): void {
    // Load BIOS
    const bios = assembleBios();
    for (let i = 0; i < bios.length; i++) {
      this.memory[0xc000 + i] = bios[i];
    }

    // Load hex loader at $F800
    const hexLoader = assembleHexLoader();
    for (let i = 0; i < hexLoader.bytes.length; i++) {
      this.memory[0xf800 + i] = hexLoader.bytes[i];
    }

    // Set reset vector to hex loader
    this.memory[0xfffc] = 0x00;
    this.memory[0xfffd] = 0xf8;
  }

  sendKey(key: number): void {
    this.keyBuffer.push(key & 0xff);
  }

  sendString(str: string): void {
    for (const ch of str) {
      this.sendKey(ch.charCodeAt(0));
    }
  }

  sendLine(str: string): void {
    this.sendString(str);
    this.sendKey(0x0d); // Enter
  }

  private processIO(): void {
    // Handle serial output
    const serialData = this.memory[IO.SERIAL_DATA];
    if (serialData !== 0) {
      this.output += String.fromCharCode(serialData);
      this.memory[IO.SERIAL_DATA] = 0;
    }

    // Handle keyboard
    if (this.keyBuffer.length > 0 && this.memory[IO.KBD_DATA] === 0) {
      this.memory[IO.KBD_DATA] = this.keyBuffer.shift()!;
      this.memory[IO.KBD_STATUS] = 0x01;
    } else if (this.memory[IO.KBD_DATA] !== 0) {
      this.memory[IO.KBD_STATUS] = 0x01;
    } else {
      this.memory[IO.KBD_STATUS] = 0x00;
    }

    this.memory[IO.SERIAL_STATUS] = 0x02; // TX ready
  }

  run(instructions: number): void {
    for (let i = 0; i < instructions; i++) {
      this.cpu.step();
      this.processIO();
    }
  }

  runUntilOutput(expected: string, maxInstructions: number = 1000000, settleInstructions: number = 2000): boolean {
    for (let i = 0; i < maxInstructions; i++) {
      this.cpu.step();
      this.processIO();
      if (this.output.includes(expected)) {
        // Let any remaining output drain so callers can assert on full responses
        this.run(settleInstructions);
        return true;
      }
    }
    return false;
  }

  clearOutput(): void {
    this.output = '';
  }
}

describe('Shell Direct Load Test', () => {
  it('should run shell when directly loaded into memory', () => {
    const computer = new BootstrapComputer();

    // Directly load shell into memory at $0800
    const { bytes } = assembleShell();
    for (let i = 0; i < bytes.length; i++) {
      computer.memory[0x0800 + i] = bytes[i];
    }

    // Set PC to shell entry and run
    computer.cpu.pc = 0x0800;

    // Run until we see prompt (which comes after banner)
    const found = computer.runUntilOutput('A>', 100000);
    expect(found).toBe(true);
    expect(computer.output).toContain('WireOS v1');
  });

  it('should respond to HELP command when directly loaded', () => {
    const computer = new BootstrapComputer();

    // Load shell
    const { bytes } = assembleShell();
    for (let i = 0; i < bytes.length; i++) {
      computer.memory[0x0800 + i] = bytes[i];
    }
    computer.cpu.pc = 0x0800;

    // Run until prompt
    computer.runUntilOutput('A>', 100000);
    computer.clearOutput();

    // Test HELP - wait for MEM (last command in help output)
    computer.sendLine('HELP');
    computer.runUntilOutput('MEM', 100000);
    expect(computer.output).toContain('HELP');
    expect(computer.output).toContain('VER');
  });

  it('should respond to VER command when directly loaded', () => {
    const computer = new BootstrapComputer();

    // Load shell
    const { bytes } = assembleShell();
    for (let i = 0; i < bytes.length; i++) {
      computer.memory[0x0800 + i] = bytes[i];
    }
    computer.cpu.pc = 0x0800;

    // Run until prompt
    computer.runUntilOutput('A>', 100000);
    computer.clearOutput();

    // Test VER
    computer.sendLine('VER');
    computer.runUntilOutput('v1.0', 100000);
    expect(computer.output).toContain('WireOS v1.0');
  });

  it('should respond to MEM command when directly loaded', () => {
    const computer = new BootstrapComputer();

    // Load shell
    const { bytes } = assembleShell();
    for (let i = 0; i < bytes.length; i++) {
      computer.memory[0x0800 + i] = bytes[i];
    }
    computer.cpu.pc = 0x0800;

    // Run until prompt
    computer.runUntilOutput('A>', 100000);
    computer.clearOutput();

    // Test MEM - wait for ROM: 16K which appears after RAM: 32K
    computer.sendLine('MEM');
    computer.runUntilOutput('16K', 100000);
    expect(computer.output).toContain('RAM: 32K');
    expect(computer.output).toContain('ROM: 16K');
  });

  it('should return to hex loader with HEX command', () => {
    const computer = new BootstrapComputer();

    // Load shell
    const { bytes } = assembleShell();
    for (let i = 0; i < bytes.length; i++) {
      computer.memory[0x0800 + i] = bytes[i];
    }
    computer.cpu.pc = 0x0800;

    // Run until prompt
    computer.runUntilOutput('A>', 100000);
    computer.clearOutput();

    // Test HEX command
    computer.sendLine('HEX');
    const found = computer.runUntilOutput('HEX v1', 100000);
    expect(found).toBe(true);
  });
});

describe('Shell Bootstrap via Hex Loader', () => {
  it('should boot to hex loader and show prompt', () => {
    const computer = new BootstrapComputer();
    const found = computer.runUntilOutput('>', 100000);
    expect(found).toBe(true);
    expect(computer.output).toContain('HEX v1');
  });

  it('should accept hex bytes via hex loader', () => {
    const computer = new BootstrapComputer();
    computer.runUntilOutput('>', 100000);
    computer.clearOutput();

    // Enter a simple program: LDA #$42, STA $8031, HLT
    computer.sendLine('A9 42 8D 31 80 02');
    computer.run(50000);

    // Should show confirmation with address
    expect(computer.output).toContain('0200');
  });

  it('should execute entered program', () => {
    const computer = new BootstrapComputer();
    computer.runUntilOutput('>', 100000);
    computer.clearOutput();

    // Enter a program that outputs 'X': LDA #$58, STA $8031, HLT
    computer.sendLine('A9 58 8D 31 80 02');
    computer.run(50000);
    computer.clearOutput();

    // Reset load address to start (hex loader increments after each byte)
    computer.sendLine('L 0200');
    computer.run(10000);
    computer.clearOutput();

    // Execute
    computer.sendLine('E');
    computer.run(10000);

    // Should output 'X'
    expect(computer.output).toContain('X');
  });

  it('should assemble shell correctly', () => {
    const { bytes, origin } = assembleShell();
    expect(origin).toBe(0x0800);
    expect(bytes.length).toBeGreaterThan(100);
    expect(bytes.length).toBeLessThan(1500); // Shell includes INSTALL command
    console.log(`Shell size: ${bytes.length} bytes`);
  });

  it('should bootstrap shell via hex loader', () => {
    const computer = new BootstrapComputer();

    // Boot to hex loader
    computer.runUntilOutput('>', 100000);
    console.log('After boot:', computer.output);
    computer.clearOutput();

    // Set load address to $0800
    computer.sendLine('L 0800');
    computer.run(50000);
    console.log('After L 0800:', computer.output);

    // Get shell hex bytes
    const hexPairs = getShellHexPairs();
    console.log(`Entering ${hexPairs.length} bytes...`);

    // Enter shell in chunks of 8 bytes per line (less per line = faster processing)
    // Each line needs many instructions for character reading, parsing, and storing
    for (let i = 0; i < hexPairs.length; i += 8) {
      const chunk = hexPairs.slice(i, i + 8).join(' ');
      computer.sendLine(chunk);
      computer.run(200000); // 200K instructions per line
    }
    console.log('After entering bytes, output length:', computer.output.length);

    // Check final load address
    const finalAddrLo = computer.memory[0xf0];
    const finalAddrHi = computer.memory[0xf1];
    const finalAddr = finalAddrLo | (finalAddrHi << 8);
    console.log('Final load address:', finalAddr.toString(16));

    // Reset load address to start before executing
    computer.sendLine('L 0800');
    computer.run(50000);

    // Execute shell
    computer.clearOutput();
    computer.sendLine('E');

    // Run until we see shell banner
    const found = computer.runUntilOutput('WireOS', 500000);
    console.log('After E, output:', computer.output.slice(0, 200));
    console.log('PC:', computer.cpu.pc.toString(16));
    expect(found).toBe(true);
    expect(computer.output).toContain('WireOS v1');
    expect(computer.output).toContain('A>');
  });

  // Helper to bootstrap shell
  function bootstrapShell(computer: BootstrapComputer): void {
    computer.runUntilOutput('>', 100000);
    computer.sendLine('L 0800');
    computer.run(50000);

    const hexPairs = getShellHexPairs();
    for (let i = 0; i < hexPairs.length; i += 8) {
      computer.sendLine(hexPairs.slice(i, i + 8).join(' '));
      computer.run(200000);
    }

    // Reset load address before executing
    computer.sendLine('L 0800');
    computer.run(50000);

    computer.sendLine('E');
    computer.runUntilOutput('A>', 500000);
  }

  it('should respond to HELP command after bootstrap', () => {
    const computer = new BootstrapComputer();
    bootstrapShell(computer);
    computer.clearOutput();

    // Test HELP command
    computer.sendLine('HELP');
    computer.runUntilOutput('Commands:', 100000);
    expect(computer.output).toContain('HELP');
    expect(computer.output).toContain('VER');
    expect(computer.output).toContain('HEX');
    expect(computer.output).toContain('MEM');
  });

  it('should respond to VER command', () => {
    const computer = new BootstrapComputer();
    bootstrapShell(computer);
    computer.clearOutput();

    computer.sendLine('VER');
    computer.runUntilOutput('v1.0', 100000);
    expect(computer.output).toContain('WireOS v1.0');
  });

  it('should respond to MEM command', () => {
    const computer = new BootstrapComputer();
    bootstrapShell(computer);
    computer.clearOutput();

    computer.sendLine('MEM');
    computer.runUntilOutput('32K', 100000);
    expect(computer.output).toContain('RAM: 32K');
    expect(computer.output).toContain('ROM: 16K');
  });

  it('should return to hex loader with HEX command', () => {
    const computer = new BootstrapComputer();
    bootstrapShell(computer);
    computer.clearOutput();

    // HEX command should return to hex loader
    computer.sendLine('HEX');
    const found = computer.runUntilOutput('HEX v1', 100000);
    expect(found).toBe(true);
  });
});
