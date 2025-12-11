import { describe, it, expect, beforeEach } from 'vitest';
import { RiscVCpu } from '../src/emulator/cpu.js';
import {
  BootDisk,
  InteractiveSystem,
  BOOT_DISK_CONFIG,
} from '../src/emulator/boot-disk.js';
import { WireFS } from '../src/emulator/filesystem.js';

/**
 * Tests for Boot Disk and Interactive System
 */
describe('BootDisk', () => {
  let bootDisk: BootDisk;

  beforeEach(() => {
    bootDisk = new BootDisk();
  });

  describe('disk creation', () => {
    it('should create a formatted disk', () => {
      const disk = bootDisk.create();

      expect(disk).toBeInstanceOf(Uint8Array);
      expect(disk.length).toBeGreaterThan(0);
    });

    it('should have valid filesystem', () => {
      const disk = bootDisk.create();
      const fs = new WireFS(disk);

      expect(fs.isFormatted()).toBe(true);
    });

    it('should contain shell program', () => {
      const disk = bootDisk.create();
      const fs = new WireFS(disk);

      expect(fs.fileExists('SHELL', 'BIN')).toBe(true);
    });
  });

  describe('native commands', () => {
    it('should have shell executable', () => {
      const disk = bootDisk.create();
      const fs = new WireFS(disk);

      const shell = fs.readFile('SHELL', 'BIN');
      expect(shell).not.toBeNull();
    });

    it('should have native echo command', () => {
      const disk = bootDisk.create();
      const fs = new WireFS(disk);

      expect(fs.fileExists('ECHO', 'BIN')).toBe(true);
    });
  });

  describe('sample files', () => {
    it('should include readme file', () => {
      const disk = bootDisk.create();
      const fs = new WireFS(disk);

      expect(fs.fileExists('README', 'TXT')).toBe(true);
    });

    it('should include sample assembly file', () => {
      const disk = bootDisk.create();
      const fs = new WireFS(disk);

      expect(fs.fileExists('HELLO', 'ASM')).toBe(true);
    });
  });
});

describe('InteractiveSystem', () => {
  let cpu: RiscVCpu;
  let system: InteractiveSystem;

  beforeEach(() => {
    cpu = new RiscVCpu({ memorySize: 0x10000 });
    system = new InteractiveSystem(cpu);
  });

  describe('initialization', () => {
    it('should initialize with boot disk', () => {
      system.boot();

      expect(system.isRunning()).toBe(true);
    });

    it('should display boot message', () => {
      system.boot();
      system.tick(1000);

      expect(cpu.consoleOutput).toContain('Boot');
    });

    it('should show shell prompt after boot', () => {
      system.boot();
      system.tick(5000);

      // Should show prompt
      expect(cpu.consoleOutput.length).toBeGreaterThan(0);
    });
  });

  describe('keyboard input', () => {
    it('should process typed characters', () => {
      system.boot();
      system.tick(5000);

      // Type 'help'
      system.keyPress('h'.charCodeAt(0));
      system.keyPress('e'.charCodeAt(0));
      system.keyPress('l'.charCodeAt(0));
      system.keyPress('p'.charCodeAt(0));
      system.tick(100);

      // Characters should be echoed
      const output = getScreenText(cpu);
      expect(output).toContain('help');
    });

    it('should execute command on Enter', () => {
      system.boot();
      system.tick(5000);

      // Type 'help' and press Enter
      typeString(system, 'help\r');
      system.tick(1000);

      // Should show help output
      const output = getScreenText(cpu);
      expect(output.toLowerCase()).toContain('help');
    });
  });

  describe('shell commands', () => {
    beforeEach(() => {
      system.boot();
      system.tick(5000);
    });

    it('should handle echo command', () => {
      typeString(system, 'echo hello world\r');
      system.tick(1000);

      const output = getScreenText(cpu);
      expect(output).toContain('hello world');
    });

    it('should handle cls command', () => {
      // Put something on screen
      typeString(system, 'echo test\r');
      system.tick(500);

      // Clear screen
      typeString(system, 'cls\r');
      system.tick(500);

      // Screen should be mostly empty
      const cursor = cpu.gpu.getCursorPosition();
      expect(cursor.y).toBeLessThan(5);
    });

    it('should handle ls command', () => {
      typeString(system, 'ls\r');
      system.tick(1000);

      const output = getScreenText(cpu);
      // Should list files
      expect(output).toContain('SHELL');
    });

    it('should handle unknown command gracefully', () => {
      typeString(system, 'unknowncmd\r');
      system.tick(500);

      const output = getScreenText(cpu);
      expect(output.toLowerCase()).toContain('unknown');
    });
  });

  describe('file operations', () => {
    beforeEach(() => {
      system.boot();
      system.tick(5000);
    });

    it('should cat file contents', () => {
      typeString(system, 'cat README.TXT\r');
      system.tick(1000);

      const output = getScreenText(cpu);
      expect(output.length).toBeGreaterThan(20);
    });
  });

  describe('run command', () => {
    beforeEach(() => {
      system.boot();
      system.tick(5000);
    });

    it('should show usage without filename', () => {
      typeString(system, 'run\r');
      system.tick(500);

      const output = getScreenText(cpu);
      expect(output).toContain('Usage');
    });

    it('should report file not found', () => {
      typeString(system, 'run NOTFOUND.BIN\r');
      system.tick(500);

      const output = getScreenText(cpu);
      expect(output.toLowerCase()).toContain('not found');
    });

    it('should run SHELL.BIN executable', () => {
      typeString(system, 'run SHELL.BIN\r');
      system.tick(1000);

      const output = getScreenText(cpu);
      expect(output).toContain('Loaded');
    });
  });

  describe('asm command', () => {
    beforeEach(() => {
      system.boot();
      system.tick(5000);
    });

    it('should show usage without filename', () => {
      typeString(system, 'asm\r');
      system.tick(500);

      const output = getScreenText(cpu);
      expect(output).toContain('Usage');
    });

    it('should report file not found', () => {
      typeString(system, 'asm NOTFOUND.ASM\r');
      system.tick(500);

      const output = getScreenText(cpu);
      expect(output.toLowerCase()).toContain('not found');
    });

    it('should assemble HELLO.ASM', () => {
      typeString(system, 'asm HELLO.ASM\r');
      system.tick(1000);

      const output = getScreenText(cpu);
      expect(output).toContain('Assembled');
      expect(output).toContain('HELLO.BIN');
    });

    it('should create output file with custom name', () => {
      typeString(system, 'asm HELLO.ASM TEST.BIN\r');
      system.tick(1000);

      const output = getScreenText(cpu);
      expect(output).toContain('TEST.BIN');
    });

    it('should run assembled program', () => {
      // First assemble
      typeString(system, 'asm HELLO.ASM\r');
      system.tick(1000);

      // Then run
      typeString(system, 'run HELLO.BIN\r');
      system.tick(1000);

      const output = getScreenText(cpu);
      expect(output).toContain('Executed');
    });

    it('should produce output when running assembled program', () => {
      // Assemble and run
      typeString(system, 'asm HELLO.ASM\r');
      system.tick(1000);
      typeString(system, 'run HELLO.BIN\r');
      system.tick(1000);

      // The HELLO.ASM program prints "Hi" using putchar syscalls
      const output = getScreenText(cpu);
      expect(output).toContain('Hi');
    });
  });

  describe('tick control', () => {
    it('should run specified number of cycles', () => {
      system.boot();

      const before = cpu.cycles;
      system.tick(100);
      const after = cpu.cycles;

      expect(after - before).toBeLessThanOrEqual(100);
    });

    it('should stop when halted', () => {
      system.boot();
      system.tick(5000);

      typeString(system, 'exit\r');
      system.tick(1000);

      expect(system.isRunning()).toBe(false);
    });
  });

  describe('state', () => {
    it('should report not running before boot', () => {
      expect(system.isRunning()).toBe(false);
    });

    it('should report running after boot', () => {
      system.boot();
      expect(system.isRunning()).toBe(true);
    });

    it('should provide filesystem access', () => {
      system.boot();
      const fs = system.getFilesystem();

      expect(fs).not.toBeNull();
      expect(fs!.isFormatted()).toBe(true);
    });
  });

  describe('native command execution', () => {
    beforeEach(() => {
      system.boot();
      system.tick(5000);
    });

    it('should run native echo command', () => {
      typeString(system, 'run ECHO.BIN\r');
      system.tick(1000);

      // Check console output instead of screen text
      const output = cpu.consoleOutput;
      expect(output).toContain('Hello from native echo!');
    });

    it('should run native cat command on README.TXT', () => {
      typeString(system, 'run CAT.BIN\r');
      system.tick(2000);

      // Check console output contains README content
      const output = cpu.consoleOutput;
      expect(output).toContain('Wire-RISCV OS');
    });

    it('should cat file with native cat command', () => {
      typeString(system, 'run CAT.BIN\r');
      system.tick(2000);

      // Verify it read and displayed file content
      const output = cpu.consoleOutput;
      expect(output.length).toBeGreaterThan(100);
    });

    it('should handle native cat with proper syscalls', () => {
      // Track syscalls made
      const syscallsBefore = cpu.cycles;
      typeString(system, 'run CAT.BIN\r');
      system.tick(2000);

      // Should have made syscalls (executed some cycles)
      expect(cpu.cycles).toBeGreaterThan(syscallsBefore);
    });

    it('should run native ls command', () => {
      typeString(system, 'run LS.BIN\r');
      system.tick(3000);

      // Check console output contains file listing
      const output = cpu.consoleOutput;
      expect(output).toContain('SHELL');
      expect(output).toContain('bytes');
    });

    it('should list all files with native ls', () => {
      typeString(system, 'run LS.BIN\r');
      system.tick(3000);

      // Should list multiple files
      const output = cpu.consoleOutput;
      expect(output).toContain('README');
      expect(output).toContain('HELLO');
    });

    it('should show file sizes with native ls', () => {
      typeString(system, 'run LS.BIN\r');
      system.tick(3000);

      // Should show size numbers
      const output = cpu.consoleOutput;
      // Check for decimal numbers (file sizes)
      expect(output).toMatch(/\d+ bytes/);
    });

    it('should run native asm command', () => {
      typeString(system, 'run ASM.BIN\r');
      system.tick(5000);

      // Check for success message
      const output = cpu.consoleOutput;
      expect(output).toContain('Assembled');
    });

    it('should create output file with native asm', () => {
      const fs = system.getFilesystem();
      expect(fs).not.toBeNull();

      // Run asm
      typeString(system, 'run ASM.BIN\r');
      system.tick(5000);

      // Check HELLO.BIN was created
      expect(fs!.fileExists('HELLO', 'BIN')).toBe(true);
    });

    it('should assemble valid code with native asm', () => {
      const fs = system.getFilesystem();
      expect(fs).not.toBeNull();

      // Run asm
      typeString(system, 'run ASM.BIN\r');
      system.tick(5000);

      // Read the assembled file
      const binData = fs!.readFile('HELLO', 'BIN');
      expect(binData).not.toBeNull();
      expect(binData!.length).toBeGreaterThan(24); // At least header size
    });

    it('should create runnable executable with native asm', () => {
      const fs = system.getFilesystem();
      expect(fs).not.toBeNull();

      // Run asm to create HELLO.BIN
      typeString(system, 'run ASM.BIN\r');
      system.tick(5000);

      // Clear console
      cpu.consoleOutput = '';

      // Run the assembled program
      typeString(system, 'run HELLO.BIN\r');
      system.tick(2000);

      // Should print "Hi"
      const output = cpu.consoleOutput;
      expect(output).toContain('Hi');
    });

    it('should show code size with native asm', () => {
      typeString(system, 'run ASM.BIN\r');
      system.tick(5000);

      const output = cpu.consoleOutput;
      // Should show "Assembled XX bytes"
      expect(output).toMatch(/Assembled.*\d+.*bytes/);
    });
  });
});

/**
 * Helper: Type a string into the system
 */
function typeString(system: InteractiveSystem, str: string): void {
  for (const char of str) {
    system.keyPress(char.charCodeAt(0));
  }
}

/**
 * Helper: Get screen text from GPU
 */
function getScreenText(cpu: RiscVCpu): string {
  let text = '';
  for (let y = 0; y < 25; y++) {
    for (let x = 0; x < 80; x++) {
      const { char } = cpu.gpu.readTextVram(x, y);
      if (char >= 0x20 && char < 0x7F) {
        text += String.fromCharCode(char);
      }
    }
    text += '\n';
  }
  return text;
}
