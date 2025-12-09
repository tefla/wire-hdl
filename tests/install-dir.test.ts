// Test for INSTALL command followed by DIR command
// This test replicates the issue where DIR shows nothing after INSTALL

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

/**
 * Test computer with floppy and HDD support
 */
class TestComputer {
  cpu: CPU6502;
  memory: Uint8Array;
  output: string = '';
  keyBuffer: number[] = [];

  // Floppy disk sectors (null = no disk)
  floppy: Uint8Array[] | null = null;

  // HDD sectors (simulated)
  hdd: Map<number, Uint8Array> = new Map();

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

  insertFloppy(sectors: Uint8Array[]): void {
    this.floppy = sectors;
  }

  ejectFloppy(): void {
    this.floppy = null;
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

    // Handle floppy status
    if (this.floppy === null) {
      this.memory[IO.FLOPPY_STATUS] = 0x40; // No disk
    } else {
      this.memory[IO.FLOPPY_STATUS] = 0x01; // Ready
    }

    // Handle floppy commands
    const floppyCmd = this.memory[IO.FLOPPY_CMD];
    if (floppyCmd !== 0 && this.floppy !== null) {
      const sector = this.memory[IO.FLOPPY_SEC_LO] | (this.memory[IO.FLOPPY_SEC_HI] << 8);
      const bufLo = this.memory[IO.FLOPPY_BUF_LO];
      const bufHi = this.memory[IO.FLOPPY_BUF_HI];
      const bufAddr = bufLo | (bufHi << 8);
      const count = this.memory[IO.FLOPPY_COUNT];

      if (floppyCmd === 1) {
        // Read from floppy
        for (let i = 0; i < count; i++) {
          const sectorData = this.floppy[sector + i] || new Uint8Array(512);
          for (let j = 0; j < 512; j++) {
            this.memory[bufAddr + i * 512 + j] = sectorData[j];
          }
        }
      } else if (floppyCmd === 2) {
        // Write to floppy (not typically done during INSTALL)
        for (let i = 0; i < count; i++) {
          const sectorData = new Uint8Array(512);
          for (let j = 0; j < 512; j++) {
            sectorData[j] = this.memory[bufAddr + i * 512 + j];
          }
          this.floppy[sector + i] = sectorData;
        }
      }

      this.memory[IO.FLOPPY_CMD] = 0; // Clear command
    }

    // Handle HDD status
    this.memory[IO.DISK_STATUS] = 0x01; // Ready

    // Handle HDD commands
    const diskCmd = this.memory[IO.DISK_CMD];
    if (diskCmd !== 0) {
      const sector = this.memory[IO.DISK_SEC_LO] | (this.memory[IO.DISK_SEC_HI] << 8);
      const bufLo = this.memory[IO.DISK_BUF_LO];
      const bufHi = this.memory[IO.DISK_BUF_HI];
      const bufAddr = bufLo | (bufHi << 8);
      const count = this.memory[IO.DISK_COUNT];

      if (diskCmd === 1) {
        // Read from HDD
        for (let i = 0; i < count; i++) {
          const sectorData = this.hdd.get(sector + i) || new Uint8Array(512);
          for (let j = 0; j < 512; j++) {
            this.memory[bufAddr + i * 512 + j] = sectorData[j];
          }
        }
      } else if (diskCmd === 2) {
        // Write to HDD
        for (let i = 0; i < count; i++) {
          const sectorData = new Uint8Array(512);
          for (let j = 0; j < 512; j++) {
            sectorData[j] = this.memory[bufAddr + i * 512 + j];
          }
          this.hdd.set(sector + i, sectorData);
        }
      }

      this.memory[IO.DISK_CMD] = 0; // Clear command
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
        // Let any remaining output drain
        this.run(5000);
        return true;
      }
    }
    return false;
  }

  clearOutput(): void {
    this.output = '';
  }

  // Debug: dump HDD sectors
  dumpHddSector(sector: number): void {
    const data = this.hdd.get(sector);
    if (!data) {
      console.log(`HDD sector ${sector}: empty`);
      return;
    }
    const hex = Array.from(data.slice(0, 64)).map(b => b.toString(16).padStart(2, '0')).join(' ');
    console.log(`HDD sector ${sector}: ${hex}...`);
  }
}

describe('INSTALL and DIR integration', () => {
  it('should show files after INSTALL command', () => {
    const computer = new TestComputer();

    // Create and insert floppy disk
    const floppySectors = createFloppyDisk();
    computer.insertFloppy(floppySectors);

    // Load shell directly into memory
    const { bytes, origin } = assembleShell();
    for (let i = 0; i < bytes.length; i++) {
      computer.memory[origin + i] = bytes[i];
    }
    computer.cpu.pc = origin;

    // Run until we see the prompt
    const gotPrompt = computer.runUntilOutput('/>', 100000);
    expect(gotPrompt).toBe(true);
    console.log('Initial output:', computer.output);
    computer.clearOutput();

    // Run INSTALL
    computer.sendLine('INSTALL');
    const installDone = computer.runUntilOutput('Done', 500000);
    console.log('After INSTALL:', computer.output);
    expect(installDone).toBe(true);
    expect(computer.output).toContain('Installing...');

    // Debug: Check what was written to HDD
    console.log('\nHDD contents after INSTALL:');
    computer.dumpHddSector(0);  // Boot sector
    computer.dumpHddSector(1);  // Directory sector 1 (first)
    computer.dumpHddSector(2);  // Directory sector 2
    computer.dumpHddSector(3);  // Directory sector 3

    computer.clearOutput();

    // Now run DIR
    computer.sendLine('DIR');
    const dirDone = computer.runUntilOutput('/>', 200000);
    console.log('After DIR:', computer.output);

    // We expect to see files!
    expect(computer.output).toContain('SHELL.COM');
  });

  it('should copy floppy sector 1 (directory) to HDD sector 1', () => {
    const computer = new TestComputer();

    // Create and insert floppy disk
    const floppySectors = createFloppyDisk();
    computer.insertFloppy(floppySectors);

    // Debug: Check floppy directory sector content (sector 1 is first directory sector)
    console.log('Floppy sector 1 (directory):');
    const floppyDir = floppySectors[1];
    if (floppyDir) {
      // First directory entry
      const status = floppyDir[0];
      const name = String.fromCharCode(...floppyDir.slice(1, 9)).trim();
      const ext = String.fromCharCode(...floppyDir.slice(9, 12)).trim();
      console.log(`  Entry 0: status=${status.toString(16)}, name="${name}", ext="${ext}"`);
    }

    // Load shell directly
    const { bytes, origin } = assembleShell();
    for (let i = 0; i < bytes.length; i++) {
      computer.memory[origin + i] = bytes[i];
    }
    computer.cpu.pc = origin;

    // Run until prompt
    computer.runUntilOutput('/>', 100000);
    computer.clearOutput();

    // Run INSTALL
    computer.sendLine('INSTALL');
    computer.runUntilOutput('Done', 500000);

    // Check HDD sector 1 matches floppy sector 1
    const hddDir = computer.hdd.get(1);
    expect(hddDir).toBeDefined();

    if (hddDir && floppyDir) {
      console.log('\nComparing floppy sector 1 to HDD sector 1:');
      console.log('Floppy[0-15]:', Array.from(floppyDir.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
      console.log('HDD[0-15]:   ', Array.from(hddDir.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));

      // They should be equal
      for (let i = 0; i < 512; i++) {
        if (floppyDir[i] !== hddDir[i]) {
          console.log(`Mismatch at byte ${i}: floppy=${floppyDir[i].toString(16)}, hdd=${hddDir[i].toString(16)}`);
        }
      }
      expect(hddDir[0]).toBe(floppyDir[0]); // Status byte should match
    }
  });

  it('should run ASM TEST.ASM', () => {
    // Test ASM.COM execution
    const computer = new TestComputer();

    // Create and insert floppy disk
    const floppySectors = createFloppyDisk();
    computer.insertFloppy(floppySectors);

    // Load shell directly into memory
    const { bytes, origin } = assembleShell();
    for (let i = 0; i < bytes.length; i++) {
      computer.memory[origin + i] = bytes[i];
    }
    computer.cpu.pc = origin;

    // Run until we see the prompt
    const gotPrompt = computer.runUntilOutput('/>', 100000);
    expect(gotPrompt).toBe(true);
    computer.clearOutput();

    // Run INSTALL first
    computer.sendLine('INSTALL');
    const installDone = computer.runUntilOutput('Done', 500000);
    expect(installDone).toBe(true);
    computer.clearOutput();

    // Now try ASM TEST.ASM
    computer.sendLine('ASM TEST.ASM');

    // Run until we see ASM's banner "Assembler"
    const sawBanner = computer.runUntilOutput('Assembler', 500000);
    console.log('Output after ASM command:', computer.output);
    console.log('PC after ASM command:', computer.cpu.pc.toString(16));

    // Debug: dump memory at critical areas
    console.log('Memory at $0200:', Array.from(computer.memory.slice(0x200, 0x210)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    console.log('Memory at $0300 (CMD_BUF):', Array.from(computer.memory.slice(0x300, 0x320)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    console.log('CMD_BUF as string:', String.fromCharCode(...computer.memory.slice(0x300, 0x320).filter(b => b >= 0x20 && b < 0x7f)));
    console.log('Zero page $50-$5F:', Array.from(computer.memory.slice(0x50, 0x60)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    console.log('TMPPTR ($56-$57):', computer.memory[0x56].toString(16), computer.memory[0x57].toString(16));
    console.log('FILESEC ($5C):', computer.memory[0x5c].toString(16));
    console.log('FILESIZE ($5E-$5F):', computer.memory[0x5e].toString(16), computer.memory[0x5f].toString(16));
    console.log('Memory at $0800 (ASM entry):', Array.from(computer.memory.slice(0x800, 0x820)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    console.log('Memory at $2000 (SRC_BUF):', Array.from(computer.memory.slice(0x2000, 0x2040)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    console.log('SRC_BUF as string:', String.fromCharCode(...computer.memory.slice(0x2000, 0x2100).filter(b => b >= 0x20 && b < 0x7f)).substring(0, 100));

    expect(sawBanner).toBe(true);

    // Run more to see what happens - but trace key variables
    console.log('--- Starting assembly loop trace ---');
    console.log('SRCPTR ($60-$61):', computer.memory[0x60].toString(16), computer.memory[0x61].toString(16));
    console.log('PASS ($38):', computer.memory[0x38]);
    console.log('LINENUM ($3A-$3B):', computer.memory[0x3a], computer.memory[0x3b]);

    // Show source around current position
    const srcptr = computer.memory[0x60] | (computer.memory[0x61] << 8);
    console.log('Source at SRCPTR (raw bytes):', Array.from(computer.memory.slice(srcptr, srcptr + 20)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    console.log('Source at SRCPTR:', String.fromCharCode(...computer.memory.slice(srcptr, srcptr + 40).filter(b => b >= 0x20 && b < 0x7f)));
    console.log('MNEMBUF ($40-$47):', String.fromCharCode(...computer.memory.slice(0x40, 0x48).filter(b => b >= 0x20 && b < 0x7f)));
    console.log('LABELBUF ($48-$4F):', String.fromCharCode(...computer.memory.slice(0x48, 0x50).filter(b => b >= 0x20 && b < 0x7f)));

    // Show the beginning of the source to understand offsets
    console.log('First 120 bytes of source:');
    let lines = '';
    for (let i = 0; i < 120; i++) {
      const b = computer.memory[0x2000 + i];
      if (b === 0x0a) lines += `[${i}:LF]`;
      else if (b >= 0x20 && b < 0x7f) lines += String.fromCharCode(b);
      else lines += `[${i}:${b.toString(16)}]`;
    }
    console.log(lines);

    // Run in smaller chunks to trace what's happening
    for (let i = 0; i < 100; i++) {
      computer.run(100000);
      const pc = computer.cpu.pc;
      const srcptrLo = computer.memory[0x60];
      const srcptrHi = computer.memory[0x61];
      const srcptr = srcptrLo | (srcptrHi << 8);
      const linenum = computer.memory[0x3a] | (computer.memory[0x3b] << 8);
      const pass = computer.memory[0x38];
      const errflag = computer.memory[0x39];
      const toktype = computer.memory[0x59];

      // Check if assembly completed (returned to shell area)
      if (pc >= 0xc000 || computer.output.includes('bytes') || computer.output.includes('Error') || computer.output.includes('failed')) {
        console.log(`Iteration ${i}: PC=$${pc.toString(16)}, SRCPTR=$${srcptr.toString(16)}, LINE=${linenum}, PASS=${pass}, ERR=${errflag}, TOK=${toktype}`);
        break;
      }

      // Sample every 10 iterations to see progress
      if (i % 10 === 0) {
        console.log(`Iteration ${i}: PC=$${pc.toString(16)}, SRCPTR=$${srcptr.toString(16)}, LINE=${linenum}, PASS=${pass}, ERR=${errflag}, TOK=${toktype}`);
      }
    }

    console.log('Final output:', computer.output);
    console.log('Final PC:', computer.cpu.pc.toString(16));

    // Check if we get any error or success message
    const hasError = computer.output.includes('Error');
    const hasSuccess = computer.output.includes('bytes');
    console.log('Has error:', hasError, 'Has success:', hasSuccess);

    // We should see ASM loading the file
    expect(computer.output).toContain('Loading');
  });

  it('should check floppy disk layout', () => {
    const floppySectors = createFloppyDisk();

    console.log('Floppy disk layout:');
    console.log(`Total sectors: ${floppySectors.length}`);

    // Check boot sector (sector 0)
    const bootSector = floppySectors[0];
    const magic = String.fromCharCode(bootSector[0], bootSector[1]);
    console.log(`Sector 0 (boot): magic="${magic}"`);

    // Check directory sectors
    for (let dirSector = 1; dirSector <= 4; dirSector++) {
      const sector = floppySectors[dirSector];
      if (sector) {
        console.log(`\nSector ${dirSector}:`);
        // Each entry is 32 bytes, 16 entries per sector
        for (let entry = 0; entry < 16; entry++) {
          const offset = entry * 32;
          const status = sector[offset];
          if (status === 0x01) { // Active entry
            const name = String.fromCharCode(...sector.slice(offset + 1, offset + 9)).trim();
            const ext = String.fromCharCode(...sector.slice(offset + 9, offset + 12)).trim();
            const startSector = sector[offset + 0x0c] | (sector[offset + 0x0d] << 8);
            const size = sector[offset + 0x0e] | (sector[offset + 0x0f] << 8);
            console.log(`  Entry ${entry}: ${name}.${ext} start=${startSector} size=${size}`);
          } else if (status === 0xe5) {
            // Unused, skip
          } else if (status !== 0) {
            console.log(`  Entry ${entry}: status=${status.toString(16)}`);
          }
        }
      }
    }
  });
});
