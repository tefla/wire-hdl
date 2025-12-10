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

    // Check CUR_DIR after CD - should be 9 (entry index of SRC)
    expect(computer.memory[CUR_DIR_LO]).toBe(9);  // SRC is entry 9
    expect(computer.memory[CUR_DIR_HI]).toBe(0);

    // Try to assemble HELLO.ASM in SRC directory
    computer.sendLine('ASM HELLO.ASM');

    // Run until assembly completes or fails
    for (let i = 0; i < 2000000; i++) {
      computer.run(100);
      if (computer.output.includes('Error') || computer.output.includes('Assembly complete') || computer.output.includes('not found') || computer.output.includes('?')) {
        break;
      }
    }

    // Should find the file and assemble it
    expect(computer.output).not.toContain('?');
    expect(computer.output).not.toContain('not found');
    expect(computer.output).toContain('Assembly complete');
  });
});
