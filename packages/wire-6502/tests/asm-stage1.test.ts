// Tests for ASM.COM (Stage 1 assembler)
// These tests run the assembled ASM.COM in the emulator

import { describe, it, expect } from 'vitest';
import { CPU6502 } from '../src/emulator/cpu.js';
import { assembleShell } from '../src/bootstrap/shell.js';
import { assembleBios } from '../src/assembler/bios.js';
import { assembleHexLoader } from '../src/bootstrap/hex-loader.js';
import { createFloppyDisk } from '../src/bootstrap/disk-image.js';

// I/O addresses
const IO = {
  KBD_STATUS: 0x8010,
  KBD_DATA: 0x8011,
  DISK_STATUS: 0x8020,
  DISK_CMD: 0x8021,
  DISK_SEC_LO: 0x8022,
  DISK_SEC_HI: 0x8023,
  DISK_BUF_LO: 0x8024,
  DISK_BUF_HI: 0x8025,
  DISK_COUNT: 0x8026,
  SERIAL_STATUS: 0x8030,
  SERIAL_DATA: 0x8031,
  FLOPPY_STATUS: 0x8040,
  FLOPPY_CMD: 0x8041,
  FLOPPY_SEC_LO: 0x8042,
  FLOPPY_SEC_HI: 0x8043,
  FLOPPY_BUF_LO: 0x8044,
  FLOPPY_BUF_HI: 0x8045,
  FLOPPY_COUNT: 0x8046,
};

// ASM.COM zero page locations
const ASM_ZP = {
  PASS: 0x38,
  LINENUM: 0x3a,
  OPERAND: 0x3c,
  ADDRMODE: 0x3e,
  MNEMBUF: 0x40,
  LABELBUF: 0x48,
  TMPPTR: 0x56,
  CURPC: 0x5e,
  SRCPTR: 0x60,
  SYM_TAB: 0x6000,  // Symbol table starts here
};

/**
 * Test computer with floppy and HDD support for ASM.COM tests
 */
class TestComputer {
  cpu: CPU6502;
  memory: Uint8Array;
  output: string = '';
  keyBuffer: number[] = [];
  floppy: Uint8Array[] | null = null;
  hdd: Map<number, Uint8Array> = new Map();

  constructor() {
    this.memory = new Uint8Array(65536);
    this.loadRom();
    this.cpu = new CPU6502(this.memory);
    this.cpu.reset();
  }

  private loadRom(): void {
    const bios = assembleBios();
    for (let i = 0; i < bios.length; i++) {
      this.memory[0xc000 + i] = bios[i];
    }

    const hexLoader = assembleHexLoader();
    for (let i = 0; i < hexLoader.bytes.length; i++) {
      this.memory[0xf800 + i] = hexLoader.bytes[i];
    }

    this.memory[0xfffc] = 0x00;
    this.memory[0xfffd] = 0xf8;
  }

  insertFloppy(sectors: Uint8Array[]): void {
    this.floppy = sectors;
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
    this.sendKey(0x0d);
  }

  private processIO(): void {
    const serialData = this.memory[IO.SERIAL_DATA];
    if (serialData !== 0) {
      this.output += String.fromCharCode(serialData);
      this.memory[IO.SERIAL_DATA] = 0;
    }

    if (this.keyBuffer.length > 0 && this.memory[IO.KBD_DATA] === 0) {
      this.memory[IO.KBD_DATA] = this.keyBuffer.shift()!;
      this.memory[IO.KBD_STATUS] = 0x01;
    } else if (this.memory[IO.KBD_DATA] !== 0) {
      this.memory[IO.KBD_STATUS] = 0x01;
    } else {
      this.memory[IO.KBD_STATUS] = 0x00;
    }

    this.memory[IO.SERIAL_STATUS] = 0x02;

    if (this.floppy === null) {
      this.memory[IO.FLOPPY_STATUS] = 0x40;
    } else {
      this.memory[IO.FLOPPY_STATUS] = 0x01;
    }

    const floppyCmd = this.memory[IO.FLOPPY_CMD];
    if (floppyCmd !== 0 && this.floppy !== null) {
      const sector = this.memory[IO.FLOPPY_SEC_LO] | (this.memory[IO.FLOPPY_SEC_HI] << 8);
      const bufAddr = this.memory[IO.FLOPPY_BUF_LO] | (this.memory[IO.FLOPPY_BUF_HI] << 8);
      const count = this.memory[IO.FLOPPY_COUNT];

      if (floppyCmd === 1) {
        for (let i = 0; i < count; i++) {
          const sectorData = this.floppy[sector + i] || new Uint8Array(512);
          for (let j = 0; j < 512; j++) {
            this.memory[bufAddr + i * 512 + j] = sectorData[j];
          }
        }
      } else if (floppyCmd === 2) {
        for (let i = 0; i < count; i++) {
          const sectorData = new Uint8Array(512);
          for (let j = 0; j < 512; j++) {
            sectorData[j] = this.memory[bufAddr + i * 512 + j];
          }
          this.floppy[sector + i] = sectorData;
        }
      }

      this.memory[IO.FLOPPY_CMD] = 0;
    }

    this.memory[IO.DISK_STATUS] = 0x01;

    const diskCmd = this.memory[IO.DISK_CMD];
    if (diskCmd !== 0) {
      const sector = this.memory[IO.DISK_SEC_LO] | (this.memory[IO.DISK_SEC_HI] << 8);
      const bufAddr = this.memory[IO.DISK_BUF_LO] | (this.memory[IO.DISK_BUF_HI] << 8);
      const count = this.memory[IO.DISK_COUNT];

      if (diskCmd === 1) {
        for (let i = 0; i < count; i++) {
          const sectorData = this.hdd.get(sector + i) || new Uint8Array(512);
          // Debug high sector reads
          if (sector >= 300 && this.debugReads) {
            console.log(`HDD READ: sector=${sector + i} -> buf=$${bufAddr.toString(16)}, first bytes: ${Array.from(sectorData.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
          }
          for (let j = 0; j < 512; j++) {
            this.memory[bufAddr + i * 512 + j] = sectorData[j];
          }
        }
      } else if (diskCmd === 2) {
        for (let i = 0; i < count; i++) {
          const sectorData = new Uint8Array(512);
          for (let j = 0; j < 512; j++) {
            sectorData[j] = this.memory[bufAddr + i * 512 + j];
          }
          this.hdd.set(sector + i, sectorData);
        }
      }

      this.memory[IO.DISK_CMD] = 0;
    }
  }

  debugReads = false;
  enableDebugReads(): void {
    this.debugReads = true;
  }

  run(instructions: number): void {
    for (let i = 0; i < instructions; i++) {
      this.cpu.step();
      this.processIO();
    }
  }

  runUntilOutput(expected: string, maxInstructions: number = 1000000): boolean {
    for (let i = 0; i < maxInstructions; i++) {
      this.cpu.step();
      this.processIO();
      if (this.output.includes(expected)) {
        this.run(5000);
        return true;
      }
    }
    return false;
  }

  clearOutput(): void {
    this.output = '';
  }

  /**
   * Get symbol table entry at given slot index
   * Each entry is 16 bytes: 8 bytes name + 2 bytes value + 1 byte defined flag + 5 bytes padding
   */
  getSymbolSlot(slotIndex: number): { name: string; value: number; defined: boolean; address: number } {
    const address = ASM_ZP.SYM_TAB + slotIndex * 16;
    const nameBytes = this.memory.slice(address, address + 8);
    const name = String.fromCharCode(...nameBytes.filter(b => b >= 0x20 && b < 0x7f));
    const value = this.memory[address + 8] | (this.memory[address + 9] << 8);
    const defined = this.memory[address + 10] !== 0;
    return { name, value, defined, address };
  }

  /**
   * Get all non-empty symbol slots
   */
  getSymbols(): Array<{ slot: number; name: string; value: number; defined: boolean; address: number }> {
    const symbols = [];
    for (let i = 0; i < 256; i++) {  // Max 256 symbols
      const entry = this.getSymbolSlot(i);
      if (this.memory[ASM_ZP.SYM_TAB + i * 16] !== 0) {
        symbols.push({ slot: i, ...entry });
      }
    }
    return symbols;
  }
}

describe('ASM.COM Stage 1 Assembler', () => {
  /**
   * Regression test for GET_SYM_PTR bug
   *
   * Bug: The original GET_SYM_PTR function used ROL on TMPPTR+1 during the X*16
   * multiplication, which corrupted the high byte of the base address ($60).
   * When X=1, TMPPTR should be $6010 (slot 1), but the bug caused it to be $0010.
   *
   * This caused symbols after the first one to be written to wrong memory locations,
   * and lookups would fail because the symbol table wasn't being searched correctly.
   *
   * Fix: Rewrite GET_SYM_PTR to calculate X*16 correctly:
   *   - Low byte: (X << 4) & $FF via ASL x4
   *   - High byte: X >> 4 via LSR x4
   *   - Add both to base TMPPTR=$6000
   */
  it('should correctly add symbols to different slots (GET_SYM_PTR regression)', () => {
    const computer = new TestComputer();

    // Create and insert floppy disk with TEST.ASM
    const floppySectors = createFloppyDisk();
    computer.insertFloppy(floppySectors);

    // Load shell directly into memory
    const { bytes, origin } = assembleShell();
    for (let i = 0; i < bytes.length; i++) {
      computer.memory[origin + i] = bytes[i];
    }
    computer.cpu.pc = origin;

    // Run until prompt
    const gotPrompt = computer.runUntilOutput('/>', 100000);
    expect(gotPrompt).toBe(true);
    computer.clearOutput();

    // Run INSTALL to copy files from floppy to HDD
    computer.sendLine('INSTALL');
    const installDone = computer.runUntilOutput('Done', 500000);
    expect(installDone).toBe(true);
    computer.clearOutput();

    // Run ASM TEST.ASM
    computer.sendLine('ASM TEST.ASM');

    // Run until we see output or error
    let errorFound = false;
    for (let i = 0; i < 100000 && !errorFound; i++) {
      computer.run(100);
      if (computer.output.includes('Error')) {
        errorFound = true;
      }
      if (computer.output.includes('/>')) {
        break;  // Back to prompt, assembly complete
      }
    }

    // Verify no error occurred
    expect(computer.output).not.toContain('Error');
    expect(computer.output).toContain('Loading');

    // Get all symbols from the symbol table
    const symbols = computer.getSymbols();

    // Verify we have multiple symbols (TEST.ASM defines PUTCHAR, NEWLINE, START, COUNT)
    expect(symbols.length).toBeGreaterThan(1);

    // Verify symbols are at correct addresses (each slot is 16 bytes apart)
    // Slot 0 should be at $6000, slot 1 at $6010, slot 2 at $6020, etc.
    for (let i = 0; i < symbols.length; i++) {
      const expectedAddress = ASM_ZP.SYM_TAB + symbols[i].slot * 16;
      expect(symbols[i].address).toBe(expectedAddress);
    }

    // Specifically verify slot 1 is at $6010 (this was the bug)
    if (symbols.length >= 2) {
      const slot1 = computer.getSymbolSlot(1);
      expect(slot1.address).toBe(0x6010);  // This would have been $0010 with the bug
    }

    // Log the symbols for debugging
    console.log('Symbol table after ASM TEST.ASM:');
    for (const sym of symbols) {
      console.log(`  Slot ${sym.slot} ($${sym.address.toString(16)}): "${sym.name}" = $${sym.value.toString(16)}`);
    }
  });

  it('should verify symbol slot address calculation', () => {
    // This is a pure unit test for the slot address formula
    // Slot N should be at SYM_TAB + N * 16
    const SYM_TAB = 0x6000;

    const testCases = [
      { slot: 0, expected: 0x6000 },
      { slot: 1, expected: 0x6010 },
      { slot: 2, expected: 0x6020 },
      { slot: 15, expected: 0x60F0 },
      { slot: 16, expected: 0x6100 },
      { slot: 255, expected: 0x6FF0 },
    ];

    for (const { slot, expected } of testCases) {
      const actual = SYM_TAB + slot * 16;
      expect(actual).toBe(expected);
    }
  });

  it('should produce correct machine code for TEST.ASM', () => {
    const computer = new TestComputer();

    // Create and insert floppy disk
    const floppySectors = createFloppyDisk();
    computer.insertFloppy(floppySectors);

    // Load shell
    const { bytes, origin } = assembleShell();
    for (let i = 0; i < bytes.length; i++) {
      computer.memory[origin + i] = bytes[i];
    }
    computer.cpu.pc = origin;

    // Run until prompt
    computer.runUntilOutput('/>', 100000);
    computer.clearOutput();

    // Install files
    computer.sendLine('INSTALL');
    computer.runUntilOutput('Done', 500000);
    computer.clearOutput();

    // Assemble TEST.ASM
    computer.sendLine('ASM TEST.ASM');

    // Run until assembly completes
    const gotComplete = computer.runUntilOutput('Assembly complete', 2000000);
    expect(gotComplete).toBe(true);

    // Check the output buffer at $4000 (OUT_BUF)
    const OUT_BUF = 0x4000;
    const outputBytes = computer.memory.slice(OUT_BUF, OUT_BUF + 32);

    console.log('Output buffer (first 32 bytes):');
    let hexDump = '';
    for (let i = 0; i < 32; i++) {
      hexDump += outputBytes[i].toString(16).padStart(2, '0') + ' ';
      if ((i + 1) % 16 === 0) hexDump += '\n';
    }
    console.log(hexDump);

    // First byte should be $A9 (LDA immediate)
    // TEST.ASM starts with: LDA #$4F
    expect(outputBytes[0]).toBe(0xa9);  // LDA immediate opcode
    expect(outputBytes[1]).toBe(0x4f);  // 'O'

    // Bytes 2-4 should be JSR $F000 (20 00 F0)
    expect(outputBytes[2]).toBe(0x20);  // JSR opcode
    expect(outputBytes[3]).toBe(0x00);  // Low byte of $F000
    expect(outputBytes[4]).toBe(0xf0);  // High byte of $F000
  });

  it('should assemble file with multiple EQU definitions', () => {
    const computer = new TestComputer();

    // Create and insert floppy disk
    const floppySectors = createFloppyDisk();
    computer.insertFloppy(floppySectors);

    // Load shell
    const { bytes, origin } = assembleShell();
    for (let i = 0; i < bytes.length; i++) {
      computer.memory[origin + i] = bytes[i];
    }
    computer.cpu.pc = origin;

    // Run until prompt
    computer.runUntilOutput('/>', 100000);
    computer.clearOutput();

    // Install files
    computer.sendLine('INSTALL');
    computer.runUntilOutput('Done', 500000);
    computer.clearOutput();

    // Assemble TEST.ASM (which has PUTCHAR and NEWLINE as EQU definitions)
    computer.sendLine('ASM TEST.ASM');

    // Run assembly
    for (let i = 0; i < 100000; i++) {
      computer.run(100);
      if (computer.output.includes('Error') || computer.output.includes('/>')) {
        break;
      }
    }

    // Should not have "Undefined symbol" error
    expect(computer.output).not.toContain('Undefined symbol');

    // Check symbols table has both EQU symbols
    const symbols = computer.getSymbols();
    const symbolNames = symbols.map(s => s.name.trim());

    // PUTCHAR and NEWLINE should both be in the symbol table
    expect(symbolNames).toContain('PUTCHAR');
    expect(symbolNames).toContain('NEWLINE');
  });

  it('should assemble file in subdirectory (CD SRC, ASM HELLO.ASM)', () => {
    const computer = new TestComputer();

    // Create and insert floppy disk
    const floppySectors = createFloppyDisk();
    computer.insertFloppy(floppySectors);

    // Load shell
    const { bytes, origin } = assembleShell();
    for (let i = 0; i < bytes.length; i++) {
      computer.memory[origin + i] = bytes[i];
    }
    computer.cpu.pc = origin;

    // Run until prompt
    computer.runUntilOutput('/>', 100000);
    computer.clearOutput();

    // Install files
    computer.sendLine('INSTALL');
    computer.runUntilOutput('Done', 500000);
    computer.clearOutput();

    // Check CUR_DIR before CD
    const CUR_DIR_LO = 0x0240;
    const CUR_DIR_HI = 0x0241;

    // CD to SRC
    computer.sendLine('CD SRC');
    computer.runUntilOutput('/SRC/', 100000);
    computer.clearOutput();

    // Check CUR_DIR after CD - should be 20 (entry index of SRC)
    expect(computer.memory[CUR_DIR_LO]).toBe(20);  // SRC is entry 20
    expect(computer.memory[CUR_DIR_HI]).toBe(0);

    // Try to assemble HELLO.ASM in SRC directory
    computer.sendLine('ASM HELLO.ASM');

    // Run until assembly completes or fails
    for (let i = 0; i < 2000000; i++) {
      computer.run(100);
      if (computer.output.includes('Error') || computer.output.includes('Assembly complete') || computer.output.includes('not found') || computer.output.includes('?') || computer.output.includes('/>')) {
        // Run a bit more to capture full output
        computer.run(10000);
        break;
      }
    }

    // Should find the file and assemble it
    expect(computer.output).not.toContain('?');
    expect(computer.output).not.toContain('not found');
    expect(computer.output).toContain('Assembly complete');
  });
});

describe('ASM.COM Directive Support (task-11.1)', () => {
  /**
   * Test for .DB (define byte) directive
   * Currently FAILING - .DB causes "Invalid addressing mode" error
   * This test documents the bug and will pass once fixed
   */
  it('should support .DB directive for single byte', async () => {
    const computer = new TestComputer();

    // Create and insert floppy disk
    const floppySectors = createFloppyDisk();
    computer.insertFloppy(floppySectors);

    // Load shell
    const { bytes, origin } = assembleShell();
    for (let i = 0; i < bytes.length; i++) {
      computer.memory[origin + i] = bytes[i];
    }
    computer.cpu.pc = origin;

    // Run until prompt
    const gotPrompt = computer.runUntilOutput('/>', 100000);
    expect(gotPrompt).toBe(true);
    computer.clearOutput();

    // Install files
    computer.sendLine('INSTALL');
    const installDone = computer.runUntilOutput('Done', 500000);
    expect(installDone).toBe(true);
    computer.clearOutput();

    // Assemble TESTDB.ASM which uses .DB directive
    computer.sendLine('ASM TESTDB.ASM');

    // Run until assembly completes or fails
    const gotComplete = computer.runUntilOutput('Assembly complete', 5000000);

    // Debug output if failed
    if (!gotComplete) {
      console.log('ASM TESTDB.ASM output:', computer.output);
    }

    // Should succeed without errors
    expect(computer.output).not.toContain('Error');
    expect(gotComplete).toBe(true);

    // Verify output bytes: .DB $42, .DB $01, $02, RTS
    // Expected: $42, $01, $02, $60
    const outputBuf = 0x4000;  // OUT_BUF
    expect(computer.memory[outputBuf + 0]).toBe(0x42);  // .DB $42
    expect(computer.memory[outputBuf + 1]).toBe(0x01);  // .DB $01
    expect(computer.memory[outputBuf + 2]).toBe(0x02);  // .DB $02
    expect(computer.memory[outputBuf + 3]).toBe(0x60);  // RTS
  });

  /**
   * Test for .DW (define word) directive
   * TESTDW.ASM has:
   *   .ORG $0800
   *   .DW $1234    ; Should emit $34, $12 (little-endian)
   *   .DW $ABCD    ; Should emit $CD, $AB
   *   RTS
   *
   * Expected output: $34 $12 $CD $AB $60
   */
  it('should support .DW directive for 16-bit word (little-endian)', async () => {
    const computer = new TestComputer();

    // Create and insert floppy disk
    const floppySectors = createFloppyDisk();
    computer.insertFloppy(floppySectors);

    // Load shell
    const { bytes, origin } = assembleShell();
    for (let i = 0; i < bytes.length; i++) {
      computer.memory[origin + i] = bytes[i];
    }
    computer.cpu.pc = origin;

    // Run until prompt
    const gotPrompt = computer.runUntilOutput('/>', 100000);
    expect(gotPrompt).toBe(true);
    computer.clearOutput();

    // Install files
    computer.sendLine('INSTALL');
    const installDone = computer.runUntilOutput('Done', 500000);
    expect(installDone).toBe(true);
    computer.clearOutput();

    // Assemble TESTDW.ASM which uses .DW directive
    computer.sendLine('ASM TESTDW.ASM');

    // Run until assembly completes or fails
    const gotComplete = computer.runUntilOutput('Assembly complete', 5000000);

    // Debug output if failed
    if (!gotComplete) {
      console.log('ASM TESTDW.ASM output:', computer.output);
    }

    // Should succeed without errors
    expect(computer.output).not.toContain('Error');
    expect(gotComplete).toBe(true);

    // Verify output bytes:
    // .DW $1234 = $34 $12 (little-endian)
    // .DW $ABCD = $CD $AB (little-endian)
    // RTS = $60
    const outputBuf = 0x4000;  // OUT_BUF
    expect(computer.memory[outputBuf + 0]).toBe(0x34);  // Low byte of $1234
    expect(computer.memory[outputBuf + 1]).toBe(0x12);  // High byte of $1234
    expect(computer.memory[outputBuf + 2]).toBe(0xcd);  // Low byte of $ABCD
    expect(computer.memory[outputBuf + 3]).toBe(0xab);  // High byte of $ABCD
    expect(computer.memory[outputBuf + 4]).toBe(0x60);  // RTS
  });
});

describe('ASM.COM Forward Reference Support (task-11.2)', () => {
  /**
   * Test for forward JMP reference
   * TESTFWD.ASM has:
   *   .ORG $0800
   *   JMP START    ; Forward reference to label not yet defined ($0800-$0802)
   *   NOP          ; ($0803)
   *   START:       ; Address $0804
   *   RTS
   *
   * Expected output: $4C $04 $08 $EA $60
   *   JMP $0804 (opcode $4C, addr $0804 little-endian)
   *   NOP ($EA)
   *   RTS ($60)
   */
  it('should resolve forward JMP references correctly', async () => {
    const computer = new TestComputer();

    // Create and insert floppy disk
    const floppySectors = createFloppyDisk();
    computer.insertFloppy(floppySectors);

    // Load shell
    const { bytes, origin } = assembleShell();
    for (let i = 0; i < bytes.length; i++) {
      computer.memory[origin + i] = bytes[i];
    }
    computer.cpu.pc = origin;

    // Run until prompt
    const gotPrompt = computer.runUntilOutput('/>', 100000);
    expect(gotPrompt).toBe(true);
    computer.clearOutput();

    // Install files
    computer.sendLine('INSTALL');
    const installDone = computer.runUntilOutput('Done', 500000);
    expect(installDone).toBe(true);
    computer.clearOutput();

    // Assemble TESTFWD.ASM which uses forward JMP reference
    computer.sendLine('ASM TESTFWD.ASM');

    // Run until assembly completes or fails
    const gotComplete = computer.runUntilOutput('Assembly complete', 5000000);

    // Debug output if failed
    if (!gotComplete) {
      console.log('ASM TESTFWD.ASM output:', computer.output);
    }

    // Should succeed without errors
    expect(computer.output).not.toContain('Error');
    expect(gotComplete).toBe(true);

    // Verify output bytes:
    // JMP $0804 = $4C $04 $08
    // NOP = $EA
    // RTS = $60
    const outputBuf = 0x4000;  // OUT_BUF
    expect(computer.memory[outputBuf + 0]).toBe(0x4c);  // JMP opcode
    expect(computer.memory[outputBuf + 1]).toBe(0x04);  // Low byte of $0804
    expect(computer.memory[outputBuf + 2]).toBe(0x08);  // High byte of $0804
    expect(computer.memory[outputBuf + 3]).toBe(0xea);  // NOP
    expect(computer.memory[outputBuf + 4]).toBe(0x60);  // RTS
  });
});

describe('ASM.COM Large File Streaming (task-11.3)', () => {
  /**
   * Test for large file streaming support
   * TESTBIG.ASM is ~11KB (exceeds 8KB buffer limit)
   * Contains mostly comments with just a few instructions
   *
   * Expected output: $A9 $42 $60
   *   LDA #$42 (opcode $A9, operand $42)
   *   RTS ($60)
   */
  it('should assemble files larger than 8KB using streaming', async () => {
    const computer = new TestComputer();

    // Create and insert floppy disk
    const floppySectors = createFloppyDisk();
    computer.insertFloppy(floppySectors);

    // Load shell
    const { bytes, origin } = assembleShell();
    for (let i = 0; i < bytes.length; i++) {
      computer.memory[origin + i] = bytes[i];
    }
    computer.cpu.pc = origin;

    // Run until prompt
    const gotPrompt = computer.runUntilOutput('/>', 100000);
    expect(gotPrompt).toBe(true);
    computer.clearOutput();

    // Install files
    computer.sendLine('INSTALL');
    const installDone = computer.runUntilOutput('Done', 500000);
    expect(installDone).toBe(true);
    computer.clearOutput();

    // Assemble TESTBIG.ASM (>8KB file, tests streaming)
    computer.sendLine('ASM TESTBIG.ASM');

    // Run until assembly completes or fails (may take longer due to size)
    const gotComplete = computer.runUntilOutput('Assembly complete', 20000000);

    // Debug output if failed
    if (!gotComplete) {
      console.log('ASM TESTBIG.ASM output:', computer.output);
    }

    // Should succeed without errors
    expect(computer.output).not.toContain('Error');
    expect(gotComplete).toBe(true);

    // Verify output bytes:
    // LDA #$42 = $A9 $42
    // RTS = $60
    const outputBuf = 0x4000;  // OUT_BUF
    expect(computer.memory[outputBuf + 0]).toBe(0xa9);  // LDA immediate
    expect(computer.memory[outputBuf + 1]).toBe(0x42);  // #$42
    expect(computer.memory[outputBuf + 2]).toBe(0x60);  // RTS
  });
});

describe('ASM.COM String Literal Support (task-11.5)', () => {
  /**
   * Test for .DB with string literals
   * TESTSTR.ASM has:
   *   .ORG $0800
   *   MSG1: .DB "Hi"           ; Should emit $48, $69
   *   MSG2: .DB "OK", $0D, $0A, 0  ; Should emit $4F, $4B, $0D, $0A, $00
   *   MSG3: .DB "A"            ; Should emit $41
   *   MSG4: .DB ""             ; Should emit nothing
   *   MSG5: .DB "X", "Y"       ; Should emit $58, $59
   *   END:  RTS                ; Should emit $60
   *
   * Expected output: $48 $69 $4F $4B $0D $0A $00 $41 $58 $59 $60
   */
  it('should support .DB directive with string literals', async () => {
    const computer = new TestComputer();

    // Create and insert floppy disk
    const floppySectors = createFloppyDisk();
    computer.insertFloppy(floppySectors);

    // Load shell
    const { bytes, origin } = assembleShell();
    for (let i = 0; i < bytes.length; i++) {
      computer.memory[origin + i] = bytes[i];
    }
    computer.cpu.pc = origin;

    // Run until prompt
    const gotPrompt = computer.runUntilOutput('/>', 100000);
    expect(gotPrompt).toBe(true);
    computer.clearOutput();

    // Install files
    computer.sendLine('INSTALL');
    computer.runUntilOutput('Done', 500000);
    computer.clearOutput();

    // Assemble TESTSTR.ASM
    computer.sendLine('ASM TESTSTR.ASM');

    // Run until assembly completes or fails
    const gotComplete = computer.runUntilOutput('Assembly complete', 5000000);

    // Debug output if failed
    if (!gotComplete) {
      console.log('ASM TESTSTR.ASM output:', computer.output);
    }

    // Should succeed without errors
    expect(computer.output).not.toContain('Error');
    expect(gotComplete).toBe(true);

    // Verify output bytes
    const outputBuf = 0x4000;  // OUT_BUF
    // MSG1: "Hi" = $48 $69
    expect(computer.memory[outputBuf + 0]).toBe(0x48);  // 'H'
    expect(computer.memory[outputBuf + 1]).toBe(0x69);  // 'i'
    // MSG2: "OK", $0D, $0A, 0 = $4F $4B $0D $0A $00
    expect(computer.memory[outputBuf + 2]).toBe(0x4f);  // 'O'
    expect(computer.memory[outputBuf + 3]).toBe(0x4b);  // 'K'
    expect(computer.memory[outputBuf + 4]).toBe(0x0d);  // CR
    expect(computer.memory[outputBuf + 5]).toBe(0x0a);  // LF
    expect(computer.memory[outputBuf + 6]).toBe(0x00);  // null
    // MSG3: "A" = $41
    expect(computer.memory[outputBuf + 7]).toBe(0x41);  // 'A'
    // MSG4: "" = nothing (0 bytes)
    // MSG5: "X", "Y" = $58 $59
    expect(computer.memory[outputBuf + 8]).toBe(0x58);  // 'X'
    expect(computer.memory[outputBuf + 9]).toBe(0x59);  // 'Y'
    // END: RTS = $60
    expect(computer.memory[outputBuf + 10]).toBe(0x60); // RTS
  });
});

describe('ASM.COM Self-Hosting (task-11.5)', () => {
  /**
   * Test that asm.asm can assemble itself (self-hosting)
   * This is the ultimate test of the assembler's completeness
   */
  it('should assemble asm.asm (self-hosting)', async () => {
    const computer = new TestComputer();

    // Create and insert floppy disk
    const floppySectors = createFloppyDisk();
    computer.insertFloppy(floppySectors);

    // Load shell
    const { bytes, origin } = assembleShell();
    for (let i = 0; i < bytes.length; i++) {
      computer.memory[origin + i] = bytes[i];
    }
    computer.cpu.pc = origin;

    // Run until prompt
    const gotPrompt = computer.runUntilOutput('/>', 100000);
    expect(gotPrompt).toBe(true);
    computer.clearOutput();

    // Install files from floppy
    computer.sendLine('INSTALL');
    computer.runUntilOutput('Done', 500000);
    computer.clearOutput();

    // Now we need to write asm.asm to the HDD
    // Read asm.asm source and write it to disk
    const fs = await import('fs');
    const path = await import('path');
    const asmSource = fs.readFileSync(
      path.join(__dirname, '../asm/asm.asm'),
      'utf-8'
    );
    const asmBytes = new Uint8Array(asmSource.length);
    for (let i = 0; i < asmSource.length; i++) {
      asmBytes[i] = asmSource.charCodeAt(i);
    }

    // Find free directory entry and sectors
    // Directory sector 1 has entries 0-15, sector 2 has 16-31, sector 3 has 32-47
    // Find first free entry (status byte != 1)
    let freeEntry = -1;
    for (let sec = 1; sec <= 3; sec++) {
      const dirSector = computer.hdd.get(sec);
      if (!dirSector) continue;
      for (let e = 0; e < 16; e++) {
        const offset = e * 32;
        if (dirSector[offset] !== 1) {  // Not active
          freeEntry = (sec - 1) * 16 + e;
          break;
        }
      }
      if (freeEntry >= 0) break;
    }

    if (freeEntry < 0) {
      console.log('No free directory entry found');
      expect(freeEntry).toBeGreaterThanOrEqual(0);
      return;
    }

    // Find free sectors using bitmap (sectors 4-19)
    // For simplicity, find a contiguous range starting at high sector numbers
    const sectorsNeeded = Math.ceil(asmBytes.length / 512);
    let startSector = 300;  // Start looking high to avoid conflicts

    // Write asm.asm data to HDD sectors
    for (let i = 0; i < sectorsNeeded; i++) {
      const sectorData = new Uint8Array(512);
      const offset = i * 512;
      const copyLen = Math.min(512, asmBytes.length - offset);
      for (let j = 0; j < copyLen; j++) {
        sectorData[j] = asmBytes[offset + j];
      }
      computer.hdd.set(startSector + i, sectorData);
    }

    // Create directory entry for ASM.ASM
    const dirSecNum = Math.floor(freeEntry / 16) + 1;
    const dirEntryIndex = freeEntry % 16;
    const dirSector = computer.hdd.get(dirSecNum) || new Uint8Array(512);
    const entryOffset = dirEntryIndex * 32;

    // Status = active (1)
    dirSector[entryOffset + 0] = 1;
    // Name = "ASM     " (8 chars, space-padded)
    const name = 'ASM     ';
    for (let i = 0; i < 8; i++) {
      dirSector[entryOffset + 1 + i] = name.charCodeAt(i);
    }
    // Extension = "ASM" (3 chars)
    dirSector[entryOffset + 9] = 'A'.charCodeAt(0);
    dirSector[entryOffset + 10] = 'S'.charCodeAt(0);
    dirSector[entryOffset + 11] = 'M'.charCodeAt(0);
    // Start sector (little-endian)
    dirSector[entryOffset + 12] = startSector & 0xff;
    dirSector[entryOffset + 13] = (startSector >> 8) & 0xff;
    // File size (32-bit little-endian)
    dirSector[entryOffset + 0x0e] = asmBytes.length & 0xff;
    dirSector[entryOffset + 0x0f] = (asmBytes.length >> 8) & 0xff;
    dirSector[entryOffset + 0x10] = (asmBytes.length >> 16) & 0xff;
    dirSector[entryOffset + 0x11] = (asmBytes.length >> 24) & 0xff;
    // Sector count
    dirSector[entryOffset + 18] = sectorsNeeded & 0xff;
    dirSector[entryOffset + 19] = (sectorsNeeded >> 8) & 0xff;
    // Parent = root (0xFFFF)
    dirSector[entryOffset + 21] = 0xff;
    dirSector[entryOffset + 22] = 0xff;

    computer.hdd.set(dirSecNum, dirSector);

    console.log(`Created ASM.ASM: entry=${freeEntry}, sector=${startSector}, size=${asmBytes.length}, sectors=${sectorsNeeded}`);

    // Debug: verify first sector content
    const firstSector = computer.hdd.get(startSector);
    if (firstSector) {
      console.log(`First sector (300) first 50 bytes: ${Array.from(firstSector.slice(0, 50)).map(b => String.fromCharCode(b)).join('')}`);
      console.log(`Expected first 50: ${asmSource.slice(0, 50)}`);
    } else {
      console.log('ERROR: Sector 300 not found in HDD!');
    }

    // Debug: verify directory entry
    const debugDirSec = computer.hdd.get(dirSecNum);
    if (debugDirSec) {
      const nameBytes = Array.from(debugDirSec.slice(entryOffset + 1, entryOffset + 9));
      const extBytes = Array.from(debugDirSec.slice(entryOffset + 9, entryOffset + 12));
      const ss = debugDirSec[entryOffset + 12] | (debugDirSec[entryOffset + 13] << 8);
      const sz = debugDirSec[entryOffset + 0x0e] | (debugDirSec[entryOffset + 0x0f] << 8) |
                 (debugDirSec[entryOffset + 0x10] << 16) | (debugDirSec[entryOffset + 0x11] << 24);
      const parent = debugDirSec[entryOffset + 0x15] | (debugDirSec[entryOffset + 0x16] << 8);
      console.log(`Dir entry: name='${nameBytes.map(b => String.fromCharCode(b)).join('')}' ext='${extBytes.map(b => String.fromCharCode(b)).join('')}' start=${ss} size=${sz} parent=${parent.toString(16)}`);
    }

    // Debug: check CUR_DIR values
    console.log(`CUR_DIR: LO=${computer.memory[0x0240].toString(16)} HI=${computer.memory[0x0241].toString(16)}`);

    // Enable debug reads for sector >= 300
    computer.enableDebugReads();

    // Now try to assemble it
    computer.sendLine('ASM ASM.ASM');

    // Run for a long time - self-hosting is slow
    // Allow up to 100 million instructions
    for (let i = 0; i < 100000000; i++) {
      computer.run(1000);
      if (computer.output.includes('Assembly complete') ||
          computer.output.includes('Error') ||
          computer.output.includes('Assembly failed')) {
        computer.run(10000);
        break;
      }
    }

    console.log('Self-hosting output:', computer.output.slice(-500));

    // Check result
    if (computer.output.includes('Error')) {
      // Extract error details
      const errorMatch = computer.output.match(/Error:.*line \$([0-9A-F]+)/);
      if (errorMatch) {
        const lineNum = parseInt(errorMatch[1], 16);
        console.log(`Error at line ${lineNum}`);
        // Show line content from source
        const lines = asmSource.split('\n');
        if (lineNum > 0 && lineNum <= lines.length) {
          console.log(`Line ${lineNum}: "${lines[lineNum - 1].slice(0, 80)}"`);
          if (lineNum > 1) console.log(`Line ${lineNum - 1}: "${lines[lineNum - 2].slice(0, 80)}"`);
          if (lineNum < lines.length) console.log(`Line ${lineNum + 1}: "${lines[lineNum].slice(0, 80)}"`);
        }
        // Show source buffer content at error point
        const srcBuf = 0x2000;
        console.log(`SRC_BUF first 100 bytes: ${Array.from(computer.memory.slice(srcBuf, srcBuf + 100)).map(b => String.fromCharCode(b)).join('').replace(/\n/g, '\\n')}`);
        const srcPtr = computer.memory[0x60] | (computer.memory[0x61] << 8);
        console.log(`SRCPTR: $${srcPtr.toString(16)}`);
        console.log(`Content at SRCPTR: "${Array.from(computer.memory.slice(srcPtr, srcPtr + 30)).map(b => b ? String.fromCharCode(b) : '.').join('').replace(/\n/g, '\\n')}"`);
        console.log(`STREAM_END: $${(computer.memory[0x70] | (computer.memory[0x71] << 8)).toString(16)}`);
        console.log(`STREAM_LEFT: $${(computer.memory[0x6c] | (computer.memory[0x6d] << 8) | (computer.memory[0x6e] << 16) | (computer.memory[0x6f] << 24)).toString(16)} (32-bit)`);
        console.log(`STREAM_SEC: ${computer.memory[0x6a] | (computer.memory[0x6b] << 8)}`);
        console.log(`MNEMBUF: "${Array.from(computer.memory.slice(0x40, 0x48)).map(b => b ? String.fromCharCode(b) : '.').join('')}"`);
        console.log(`LINENUM: ${computer.memory[0x3a] | (computer.memory[0x3b] << 8)}`);
      }
    }

    expect(computer.output).not.toContain('Error');
    expect(computer.output).toContain('Assembly complete');
  }, 120000);  // 2 minute timeout
});
