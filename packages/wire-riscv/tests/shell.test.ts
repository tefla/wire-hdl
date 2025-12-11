import { describe, it, expect, beforeEach } from 'vitest';
import { RiscVCpu } from '../src/emulator/cpu.js';
import { Shell, CommandParser, BUILTIN_COMMANDS } from '../src/emulator/shell.js';

/**
 * Tests for the Shell
 */
describe('Shell', () => {
  let cpu: RiscVCpu;
  let shell: Shell;

  beforeEach(() => {
    cpu = new RiscVCpu({ memorySize: 0x10000 }); // 64KB
    shell = new Shell(cpu);
  });

  describe('command parser', () => {
    it('should parse simple command', () => {
      const result = CommandParser.parse('help');
      expect(result.command).toBe('help');
      expect(result.args).toEqual([]);
    });

    it('should parse command with single argument', () => {
      const result = CommandParser.parse('echo hello');
      expect(result.command).toBe('echo');
      expect(result.args).toEqual(['hello']);
    });

    it('should parse command with multiple arguments', () => {
      const result = CommandParser.parse('echo hello world foo');
      expect(result.command).toBe('echo');
      expect(result.args).toEqual(['hello', 'world', 'foo']);
    });

    it('should handle extra whitespace', () => {
      const result = CommandParser.parse('  echo   hello   world  ');
      expect(result.command).toBe('echo');
      expect(result.args).toEqual(['hello', 'world']);
    });

    it('should handle empty input', () => {
      const result = CommandParser.parse('');
      expect(result.command).toBe('');
      expect(result.args).toEqual([]);
    });

    it('should handle whitespace-only input', () => {
      const result = CommandParser.parse('   ');
      expect(result.command).toBe('');
      expect(result.args).toEqual([]);
    });

    it('should parse hex numbers in arguments', () => {
      const result = CommandParser.parse('peek 0x1000');
      expect(result.command).toBe('peek');
      expect(result.args).toEqual(['0x1000']);
    });
  });

  describe('builtin commands', () => {
    it('should have required builtin commands', () => {
      expect(BUILTIN_COMMANDS).toContain('help');
      expect(BUILTIN_COMMANDS).toContain('cls');
      expect(BUILTIN_COMMANDS).toContain('echo');
      expect(BUILTIN_COMMANDS).toContain('mem');
      expect(BUILTIN_COMMANDS).toContain('exit');
    });

    it('should recognize builtin commands', () => {
      expect(shell.isBuiltin('help')).toBe(true);
      expect(shell.isBuiltin('cls')).toBe(true);
      expect(shell.isBuiltin('echo')).toBe(true);
      expect(shell.isBuiltin('unknown')).toBe(false);
    });
  });

  describe('help command', () => {
    it('should list available commands', () => {
      shell.executeCommand('help');

      const output = cpu.consoleOutput;
      expect(output).toContain('help');
      expect(output).toContain('cls');
      expect(output).toContain('echo');
    });
  });

  describe('echo command', () => {
    it('should print arguments', () => {
      shell.executeCommand('echo hello');
      expect(cpu.consoleOutput).toContain('hello');
    });

    it('should print multiple arguments with spaces', () => {
      shell.executeCommand('echo hello world');
      expect(cpu.consoleOutput).toContain('hello world');
    });

    it('should print newline for empty echo', () => {
      const outputBefore = cpu.consoleOutput;
      shell.executeCommand('echo');
      expect(cpu.consoleOutput.length).toBeGreaterThan(outputBefore.length);
    });
  });

  describe('cls command', () => {
    it('should clear the screen', () => {
      // Put some content on screen
      shell.executeCommand('echo hello');

      // Clear screen
      shell.executeCommand('cls');

      // Screen should be cleared (all spaces)
      const { char } = cpu.gpu.readTextVram(0, 0);
      expect(char).toBe(0x20);
    });

    it('should reset cursor to top-left', () => {
      // Move cursor
      shell.executeCommand('echo hello');

      // Clear screen
      shell.executeCommand('cls');

      const cursor = cpu.gpu.getCursorPosition();
      expect(cursor.x).toBe(0);
      expect(cursor.y).toBe(0);
    });
  });

  describe('mem command', () => {
    it('should show memory information', () => {
      shell.executeCommand('mem');
      const output = cpu.consoleOutput;

      // Should show total memory
      expect(output.toLowerCase()).toContain('memory');
    });
  });

  describe('peek command', () => {
    it('should read memory address', () => {
      // Write known value to memory
      cpu.writeByte(0x2000, 0x42);

      shell.executeCommand('peek 0x2000');
      const output = cpu.consoleOutput;

      // Should show the value
      expect(output).toContain('42');
    });

    it('should handle decimal addresses', () => {
      cpu.writeByte(100, 0x55);

      shell.executeCommand('peek 100');
      const output = cpu.consoleOutput;

      expect(output).toContain('55');
    });
  });

  describe('poke command', () => {
    it('should write to memory address', () => {
      shell.executeCommand('poke 0x2000 0x42');

      expect(cpu.readByte(0x2000)).toBe(0x42);
    });

    it('should handle decimal values', () => {
      shell.executeCommand('poke 0x2000 66');

      expect(cpu.readByte(0x2000)).toBe(66);
    });
  });

  describe('exit command', () => {
    it('should halt the CPU', () => {
      shell.executeCommand('exit');
      expect(cpu.halted).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should show error for unknown command', () => {
      shell.executeCommand('unknown_command');

      const output = cpu.consoleOutput;
      expect(output.toLowerCase()).toContain('unknown');
    });

    it('should handle peek with missing address', () => {
      shell.executeCommand('peek');

      const output = cpu.consoleOutput;
      expect(output.toLowerCase()).toContain('usage');
    });

    it('should handle poke with missing arguments', () => {
      shell.executeCommand('poke 0x1000');

      const output = cpu.consoleOutput;
      expect(output.toLowerCase()).toContain('usage');
    });
  });

  describe('prompt', () => {
    it('should have a prompt string', () => {
      expect(shell.getPrompt()).toBeTruthy();
      expect(shell.getPrompt().length).toBeGreaterThan(0);
    });

    it('should print prompt', () => {
      shell.printPrompt();

      const output = cpu.consoleOutput;
      expect(output).toContain(shell.getPrompt());
    });
  });

  describe('command execution loop', () => {
    it('should process typed input', () => {
      // Type "echo test" + Enter
      const input = 'echo test\r';
      for (const char of input) {
        cpu.keyboard.keyPress(char.charCodeAt(0));
      }

      // Process input
      shell.processInput();

      expect(cpu.consoleOutput).toContain('test');
    });

    it('should handle multiple commands', () => {
      shell.executeCommand('echo first');
      shell.executeCommand('echo second');

      expect(cpu.consoleOutput).toContain('first');
      expect(cpu.consoleOutput).toContain('second');
    });
  });
});

/**
 * Tests for Shell Integration
 */
describe('Shell Integration', () => {
  let cpu: RiscVCpu;
  let shell: Shell;

  beforeEach(() => {
    cpu = new RiscVCpu({ memorySize: 0x10000 });
    shell = new Shell(cpu);
  });

  it('should run interactive session', () => {
    // Simulate user typing "help" then "exit"
    const commands = 'help\rexit\r';
    for (const char of commands) {
      cpu.keyboard.keyPress(char.charCodeAt(0));
    }

    // Process both commands
    shell.processInput();
    if (!cpu.halted) {
      shell.processInput();
    }

    // Should have shown help and then halted
    expect(cpu.consoleOutput).toContain('help');
    expect(cpu.halted).toBe(true);
  });
});
