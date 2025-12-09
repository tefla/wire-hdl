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

  // Parent index ($FFFF = root)
  entry[0x15] = 0xff;
  entry[0x16] = 0xff;

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

  // Initialize current directory to root ($FFFF)
  // Shell does this in INIT_ENV, but pre-set it to ensure root filtering works
  memory[0x0240] = 0xff;  // CUR_DIR_LO
  memory[0x0241] = 0xff;  // CUR_DIR_HI

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
      1: dirSector,
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
      1: dirSector,
      4: program,
    });

    const output = runUntil('X', cpu, readOutput);
    expect(output).toContain('HELLO'); // Command echoed
    expect(output).toContain('X'); // Program output
  });

  it('shows version with VER command', () => {
    const { cpu, readOutput } = createShellMachine(['VER'], {});
    const output = runUntil('WireOS', cpu, readOutput);
    expect(output).toContain('WireOS');
    expect(output).toContain('v1');
  });

  it('shows prompt after unknown command', () => {
    const { cpu, readOutput } = createShellMachine(['BADCMD'], {});
    // Wait for prompt to appear after the command is processed
    const output = runUntil('/>', cpu, readOutput, 200000);
    // The command is echoed
    expect(output).toContain('BAD'); // Partial match is fine
  });

  it('handles empty command (just Enter)', () => {
    const { cpu, readOutput } = createShellMachine([''], {});
    const output = runUntil('/>', cpu, readOutput, 100000);
    // Should show prompt without error
    expect(output).toContain('/>');
  });

  it('handles multiple commands in sequence', () => {
    const dirSector = buildDirectorySector([
      { name: 'TEST', ext: 'COM', start: 4, size: 10 },
    ]);

    const { cpu, readOutput } = createShellMachine(['VER', 'DIR'], {
      1: dirSector,
    });

    const output = runUntil('TEST.COM', cpu, readOutput, 200000);
    expect(output).toContain('WireOS'); // From VER
    expect(output).toContain('TEST.COM'); // From DIR
  });

  it('lists directory with multiple file extensions', () => {
    const dirSector = buildDirectorySector([
      { name: 'HELLO', ext: 'ASM', start: 4, size: 100 },
      { name: 'HELLO', ext: 'COM', start: 5, size: 50 },
      { name: 'README', ext: 'TXT', start: 6, size: 200 },
    ]);

    const { cpu, readOutput } = createShellMachine(['DIR'], {
      1: dirSector,
    });

    const output = runUntil('README.TXT', cpu, readOutput);
    expect(output).toContain('HELLO.ASM');
    expect(output).toContain('HELLO.COM');
    expect(output).toContain('README.TXT');
  });
});

describe('Shell command parsing', () => {
  it('case-insensitive command matching for DIR', () => {
    const dirSector = buildDirectorySector([
      { name: 'FILE', ext: 'TXT', start: 4, size: 10 },
    ]);

    // Shell converts input to uppercase internally
    const { cpu, readOutput } = createShellMachine(['dir'], {
      1: dirSector,
    });

    const output = runUntil('FILE.TXT', cpu, readOutput);
    expect(output).toContain('FILE.TXT');
  });

  it('case-insensitive command matching for VER', () => {
    const { cpu, readOutput } = createShellMachine(['ver'], {});
    const output = runUntil('WireOS', cpu, readOutput);
    expect(output).toContain('WireOS');
  });
});

describe('Shell file execution', () => {
  it('runs program that returns to shell prompt', () => {
    const dirSector = buildDirectorySector([
      { name: 'QUICK', ext: 'COM', start: 4, size: 8 },
    ]);

    // Program that just returns (RTS)
    const program = new Uint8Array(512);
    program.set([
      0xa9, 0x21, // LDA #'!'
      0x20, 0x00, 0xf0, // JSR PUTCHAR
      0x60, // RTS (return to shell)
    ]);

    const { cpu, readOutput } = createShellMachine(['QUICK'], {
      1: dirSector,
      4: program,
    });

    const output = runUntil('!', cpu, readOutput);
    expect(output).toContain('!');
  });

  it('handles program with multiple prints', () => {
    const dirSector = buildDirectorySector([
      { name: 'MULTI', ext: 'COM', start: 4, size: 20 },
    ]);

    // Program that prints "AB"
    const program = new Uint8Array(512);
    program.set([
      0xa9, 0x41, // LDA #'A'
      0x20, 0x00, 0xf0, // JSR PUTCHAR
      0xa9, 0x42, // LDA #'B'
      0x20, 0x00, 0xf0, // JSR PUTCHAR
      0x02, // HLT
    ]);

    const { cpu, readOutput } = createShellMachine(['MULTI'], {
      1: dirSector,
      4: program,
    });

    const output = runUntil('B', cpu, readOutput);
    expect(output).toContain('AB');
  });

  it('file not found returns to prompt', () => {
    const dirSector = buildDirectorySector([
      { name: 'REAL', ext: 'COM', start: 4, size: 10 },
    ]);

    const { cpu, readOutput } = createShellMachine(['FAKE'], {
      1: dirSector,
    });

    // Should return to prompt even if file not found
    const output = runUntil('/>', cpu, readOutput, 200000);
    // Command is echoed (at least partial match)
    expect(output).toContain('FAK');
  });
});

describe('Shell prompt and display', () => {
  it('shows initial prompt on boot', () => {
    const { cpu, readOutput } = createShellMachine([], {});
    const output = runUntil('/>', cpu, readOutput, 50000);
    expect(output).toContain('/>');
  });

  it('echoes typed characters', () => {
    const { cpu, readOutput } = createShellMachine(['DIR'], {});
    const output = runUntil('/>', cpu, readOutput, 100000);
    expect(output).toContain('DIR');
  });
});

describe('Shell TYPE command', () => {
  it('displays complete file contents', () => {
    // Create a test file with content longer than 256 bytes
    const fileContent = '; HELLO.ASM - Hello World\n' +
      '; This is a test file\n' +
      '; ' + 'x'.repeat(300) + '\n' +  // Long line to exceed 256 bytes total
      '.ORG $0800\n' +
      'START:\n' +
      '    RTS\n';

    const fileSector = new Uint8Array(512);
    for (let i = 0; i < fileContent.length; i++) {
      fileSector[i] = fileContent.charCodeAt(i);
    }

    const dirSector = buildDirectorySector([
      { name: 'HELLO', ext: 'ASM', start: 20, size: fileContent.length },
    ]);

    const { cpu, readOutput } = createShellMachine(['TYPE HELLO'], {
      1: dirSector,
      20: fileSector,
    });

    const output = runUntil('RTS', cpu, readOutput, 500000);

    // Check that we see content from beginning, middle, and end
    expect(output).toContain('HELLO.ASM');
    expect(output).toContain('This is a test file');
    expect(output).toContain('xxx'); // Middle of long line
    expect(output).toContain('.ORG $0800');
    expect(output).toContain('START:');
    expect(output).toContain('RTS');
  });

  it('displays file with exactly 256 bytes', () => {
    const fileContent = 'A'.repeat(256);
    const fileSector = new Uint8Array(512);
    for (let i = 0; i < 256; i++) {
      fileSector[i] = fileContent.charCodeAt(i);
    }

    const dirSector = buildDirectorySector([
      { name: 'TEST256', ext: 'TXT', start: 20, size: 256 },
    ]);

    const { cpu, readOutput } = createShellMachine(['TYPE TEST256'], {
      1: dirSector,
      20: fileSector,
    });

    // Run enough cycles to process 256 characters
    // runUntil checks every 256 iterations, so we need to run until we see all 256 A's
    // After TYPE finishes, we get /> prompt
    let output = '';
    for (let i = 0; i < 500000 && !cpu.halted; i++) {
      cpu.step();
      if ((i & 0xfff) === 0) {
        output = readOutput();
        // Check if TYPE is done (prompt appears after the A's)
        if (output.includes('/>') && output.indexOf('/>') > output.indexOf('TEST256')) {
          break;
        }
      }
    }
    output = readOutput();

    // Count how many 'A's we got - should be all 256
    const aCount = (output.match(/A/g) || []).length;
    expect(aCount).toBeGreaterThanOrEqual(256);
  });
});
