import { describe, it, expect } from 'vitest';
import { CPU6502 } from '../src/emulator/cpu.js';
import { assembleShell } from '../src/bootstrap/shell.js';

const ZP_OUT_LO = 0xf0;
const ZP_OUT_HI = 0xf1;
const ZP_IN_LO = 0xf2;
const ZP_IN_HI = 0xf3;
const ZP_END_LO = 0xf4;
const ZP_END_HI = 0xf5;
const ZP_SRC_LO = 0xf6;
const ZP_SRC_HI = 0xf7;
const ZP_DST_LO = 0xf8;
const ZP_DST_HI = 0xf9;
const ZP_TMP_LO = 0xfa;
const ZP_TMP_HI = 0xfb;
const ZP_SCRATCH = 0xfc;

const OUTPUT_BASE = 0x9100;
const INPUT_BASE = 0x9000;
const DISK_BASE = 0xa000;

interface DirEntry {
  name: string;
  ext: string;
  start: number;
  size: number;
}

function writeBytes(memory: Uint8Array, start: number, bytes: number[]): void {
  for (let i = 0; i < bytes.length; i++) {
    memory[start + i] = bytes[i] & 0xff;
  }
}

function createDirEntry({ name, ext, start, size }: DirEntry): Uint8Array {
  const entry = new Uint8Array(32);
  entry[0] = 0x01; // active

  const upperName = name.toUpperCase().padEnd(8, ' ');
  const upperExt = ext.toUpperCase().padEnd(3, ' ');

  for (let i = 0; i < 8; i++) {
    entry[1 + i] = upperName.charCodeAt(i);
  }
  for (let i = 0; i < 3; i++) {
    entry[9 + i] = upperExt.charCodeAt(i);
  }

  entry[0x0c] = start & 0xff;
  entry[0x0d] = (start >> 8) & 0xff;

  entry[0x0e] = size & 0xff;
  entry[0x0f] = (size >> 8) & 0xff;

  // Sector count (minimum 1)
  const sectors = Math.max(1, Math.ceil(size / 512));
  entry[0x12] = sectors & 0xff;
  entry[0x13] = (sectors >> 8) & 0xff;

  return entry;
}

function buildDirectorySector(entries: DirEntry[]): Uint8Array {
  const sector = new Uint8Array(512);
  entries.forEach((entry, idx) => {
    const raw = createDirEntry(entry);
    sector.set(raw, idx * 32);
  });
  return sector;
}

function encodeCommands(commands: string[]): Uint8Array {
  const bytes: number[] = [];
  for (const cmd of commands) {
    for (const ch of cmd) {
      bytes.push(ch.charCodeAt(0));
    }
    bytes.push(0x0d); // Enter
  }
  // Add one extra Enter so the shell quickly returns to the prompt after the last command
  bytes.push(0x0d);
  return new Uint8Array(bytes);
}

function installStubBios(memory: Uint8Array): void {
  // PUTCHAR ($F000): store A into output buffer and advance pointer (preserve Y)
  writeBytes(memory, 0xf000, [
    0x84, ZP_SCRATCH, // STY SCRATCH
    0xa0, 0x00, // LDY #$00
    0x91, ZP_OUT_LO, // STA (OUT),Y
    0xe6, ZP_OUT_LO, // INC OUT_LO
    0xd0, 0x02, // BNE skip
    0xe6, ZP_OUT_HI, // INC OUT_HI
    0xa4, ZP_SCRATCH, // LDY SCRATCH
    0x60, // RTS
  ]);

  // GETCHAR ($F040): feed scripted input until it is exhausted, then return CR forever
  writeBytes(memory, 0xf040, [
    0xa5, ZP_IN_HI, // LDA IN_HI
    0xc5, ZP_END_HI, // CMP END_HI
    0x90, 0x0b, // BCC read
    0xd0, 0x06, // BNE return_cr
    0xa5, ZP_IN_LO, // LDA IN_LO
    0xc5, ZP_END_LO, // CMP END_LO
    0x90, 0x03, // BCC read
    0xa9, 0x0d, // return_cr: LDA #$0D
    0x60, // RTS
    0xa0, 0x00, // read: LDY #$00
    0xb1, ZP_IN_LO, // LDA (IN),Y
    0xe6, ZP_IN_LO, // INC IN_LO
    0xd0, 0x02, // BNE done
    0xe6, ZP_IN_HI, // INC IN_HI
    0x60, // done: RTS
  ]);

  // NEWLINE ($F080): print LF
  writeBytes(memory, 0xf080, [
    0xa9, 0x0a, // LDA #$0A
    0x20, 0x00, 0xf0, // JSR PUTCHAR
    0x60, // RTS
  ]);

  // DISK_READ ($F200): copy one 512-byte sector from DISK_BASE + sector*512 into buffer
  writeBytes(memory, 0xf200, [
    0xa5, 0x30, // LDA $30 (sector low)
    0x0a, // ASL A
    0x85, ZP_TMP_LO, // STA TMP_LO (sector*2 low)
    0xa5, 0x31, // LDA $31 (sector high)
    0x2a, // ROL A
    0x85, ZP_TMP_HI, // STA TMP_HI (sector*2 high - mostly zero for small sectors)
    0xa9, 0x00, // LDA #$00 -> src low
    0x85, ZP_SRC_LO, // STA SRC_LO
    0xa9, (DISK_BASE >> 8) & 0xff, // LDA #>DISK_BASE
    0x65, ZP_TMP_LO, // ADC TMP_LO (sector*2) => high byte of sector*512
    0x85, ZP_SRC_HI, // STA SRC_HI
    0xa5, 0x32, // LDA $32 (buffer low)
    0x85, ZP_DST_LO, // STA DST_LO
    0xa5, 0x33, // LDA $33 (buffer high)
    0x85, ZP_DST_HI, // STA DST_HI
    0xa0, 0x00, // LDY #$00
    // Copy first 256 bytes
    0xb1, ZP_SRC_LO, // LDA (SRC),Y
    0x91, ZP_DST_LO, // STA (DST),Y
    0xc8, // INY
    0xd0, 0xf9, // BNE copy first page
    0xe6, ZP_SRC_HI, // INC SRC_HI
    0xe6, ZP_DST_HI, // INC DST_HI
    0xa0, 0x00, // LDY #$00
    // Copy second 256 bytes
    0xb1, ZP_SRC_LO, // LDA (SRC),Y
    0x91, ZP_DST_LO, // STA (DST),Y
    0xc8, // INY
    0xd0, 0xf9, // BNE copy second page
    0x18, // CLC (success)
    0x60, // RTS
  ]);
}

function createShellMachine(commands: string[], diskSectors: Record<number, Uint8Array>) {
  const memory = new Uint8Array(0x10000);

  // Load shell
  const { bytes: shellBytes, origin } = assembleShell();
  memory.set(shellBytes, origin);

  // Stub BIOS routines
  installStubBios(memory);

  // Scripted input
  const script = encodeCommands(commands);
  memory.set(script, INPUT_BASE);
  const scriptEnd = INPUT_BASE + script.length;
  memory[ZP_IN_LO] = INPUT_BASE & 0xff;
  memory[ZP_IN_HI] = (INPUT_BASE >> 8) & 0xff;
  memory[ZP_END_LO] = scriptEnd & 0xff;
  memory[ZP_END_HI] = (scriptEnd >> 8) & 0xff;

  // Output buffer pointer
  memory[ZP_OUT_LO] = OUTPUT_BASE & 0xff;
  memory[ZP_OUT_HI] = (OUTPUT_BASE >> 8) & 0xff;

  // Install disk sectors at DISK_BASE + sector*512
  for (const [sectorStr, data] of Object.entries(diskSectors)) {
    const sector = parseInt(sectorStr, 10);
    memory.set(data, DISK_BASE + sector * 512);
  }

  // Reset vector
  memory[0xfffc] = origin & 0xff;
  memory[0xfffd] = (origin >> 8) & 0xff;

  const cpu = new CPU6502(memory);
  cpu.reset();

  const readOutput = (): string => {
    const outPtr = memory[ZP_OUT_LO] | (memory[ZP_OUT_HI] << 8);
    const len = outPtr - OUTPUT_BASE;
    const slice = memory.slice(OUTPUT_BASE, OUTPUT_BASE + len);
    return String.fromCharCode(...slice);
  };

  return { cpu, memory, readOutput };
}

function runUntil(outputContains: string, cpu: CPU6502, readOutput: () => string, maxSteps = 200000): string {
  for (let i = 0; i < maxSteps && !cpu.halted; i++) {
    cpu.step();
    if ((i & 0xff) === 0) {
      const out = readOutput();
      if (out.includes(outputContains)) {
        return out;
      }
    }
  }
  return readOutput();
}

describe('Shell commands on an emulated HDD', () => {
  it('lists directory entries from the hard drive', () => {
    const dirSector = buildDirectorySector([
      { name: 'SHELL', ext: 'COM', start: 4, size: 0x200 },
      { name: 'ASM0', ext: 'COM', start: 5, size: 0x180 },
    ]);

    const { cpu, readOutput } = createShellMachine(['DIR'], {
      2: dirSector,
    });

    const output = runUntil('ASM0.COM', cpu, readOutput);
    expect(output).toContain('SHELL.COM');
    expect(output).toContain('ASM0.COM');
  });

  it('runs a COM program from the hard drive', () => {
    const dirSector = buildDirectorySector([
      { name: 'HELLO', ext: 'COM', start: 4, size: 0x10 },
    ]);

    // Minimal COM program at sector 4: print 'X' then HLT
    const program = new Uint8Array(512);
    program.set([
      0xa9, 0x58, // LDA #'X'
      0x20, 0x00, 0xf0, // JSR PUTCHAR
      0x02, // HLT
    ]);

    const { cpu, readOutput } = createShellMachine(['HELLO'], {
      2: dirSector,
      4: program,
    });

    const output = runUntil('X', cpu, readOutput);
    expect(output).toContain('HELLO'); // Command echoed
    expect(output).toContain('X'); // Program output
  });
});
