/**
 * RISC-V Shell
 *
 * Command-line shell for interactive system control.
 */

import { RiscVCpu, SYSCALL } from './cpu.js';
import { TEXT_COLS, TEXT_ROWS } from './graphics.js';

/** List of built-in commands */
export const BUILTIN_COMMANDS = [
  'help',
  'cls',
  'echo',
  'mem',
  'regs',
  'peek',
  'poke',
  'exit',
] as const;

type BuiltinCommand = (typeof BUILTIN_COMMANDS)[number];

/**
 * Parsed command result
 */
export interface ParsedCommand {
  command: string;
  args: string[];
}

/**
 * Command parser utility
 */
export class CommandParser {
  /**
   * Parse a command line into command and arguments
   */
  static parse(line: string): ParsedCommand {
    const trimmed = line.trim();
    if (!trimmed) {
      return { command: '', args: [] };
    }

    const parts = trimmed.split(/\s+/);
    return {
      command: parts[0],
      args: parts.slice(1),
    };
  }

  /**
   * Parse a number from string (supports hex with 0x prefix)
   */
  static parseNumber(str: string): number {
    if (str.startsWith('0x') || str.startsWith('0X')) {
      return parseInt(str.slice(2), 16);
    }
    return parseInt(str, 10);
  }
}

/**
 * Interactive shell
 */
export class Shell {
  private prompt: string = '> ';
  private inputBuffer: string = '';

  constructor(private cpu: RiscVCpu) {}

  /**
   * Get the shell prompt string
   */
  getPrompt(): string {
    return this.prompt;
  }

  /**
   * Print the prompt to the console
   */
  printPrompt(): void {
    this.print(this.prompt);
  }

  /**
   * Check if a command is a builtin
   */
  isBuiltin(command: string): boolean {
    return (BUILTIN_COMMANDS as readonly string[]).includes(command);
  }

  /**
   * Execute a command string
   */
  executeCommand(line: string): void {
    const { command, args } = CommandParser.parse(line);

    if (!command) {
      return;
    }

    if (this.isBuiltin(command)) {
      this.executeBuiltin(command as BuiltinCommand, args);
    } else {
      this.println(`Unknown command: ${command}`);
    }
  }

  /**
   * Execute a builtin command
   */
  private executeBuiltin(command: BuiltinCommand, args: string[]): void {
    switch (command) {
      case 'help':
        this.cmdHelp();
        break;
      case 'cls':
        this.cmdCls();
        break;
      case 'echo':
        this.cmdEcho(args);
        break;
      case 'mem':
        this.cmdMem();
        break;
      case 'regs':
        this.cmdRegs();
        break;
      case 'peek':
        this.cmdPeek(args);
        break;
      case 'poke':
        this.cmdPoke(args);
        break;
      case 'exit':
        this.cmdExit();
        break;
    }
  }

  /**
   * Help command - list available commands
   */
  private cmdHelp(): void {
    this.println('Available commands:');
    this.println('  help  - Show this help');
    this.println('  cls   - Clear screen');
    this.println('  echo  - Print arguments');
    this.println('  mem   - Show memory info');
    this.println('  regs  - Show CPU registers');
    this.println('  peek  - Read memory (peek <addr>)');
    this.println('  poke  - Write memory (poke <addr> <val>)');
    this.println('  exit  - Halt system');
  }

  /**
   * Clear screen command
   */
  private cmdCls(): void {
    // Clear all screen memory
    for (let y = 0; y < TEXT_ROWS; y++) {
      for (let x = 0; x < TEXT_COLS; x++) {
        this.cpu.gpu.writeTextVram(x, y, 0x20, 0x07);
      }
    }
    // Reset cursor
    this.cpu.gpu.setCursorPosition(0, 0);
  }

  /**
   * Echo command - print arguments
   */
  private cmdEcho(args: string[]): void {
    this.println(args.join(' '));
  }

  /**
   * Memory info command
   */
  private cmdMem(): void {
    const memorySize = this.cpu.getMemorySize();
    this.println(`Memory: ${memorySize} bytes (${(memorySize / 1024).toFixed(0)}KB)`);
  }

  /**
   * Show CPU registers
   */
  private cmdRegs(): void {
    this.println('CPU Registers:');
    for (let i = 0; i < 32; i += 4) {
      const line = [];
      for (let j = 0; j < 4; j++) {
        const reg = i + j;
        const val = this.cpu.getReg(reg);
        line.push(`x${reg.toString().padStart(2, '0')}=${val.toString(16).padStart(8, '0')}`);
      }
      this.println(line.join(' '));
    }
    this.println(`pc=${this.cpu.pc.toString(16).padStart(8, '0')}`);
  }

  /**
   * Peek command - read memory
   */
  private cmdPeek(args: string[]): void {
    if (args.length < 1) {
      this.println('Usage: peek <address>');
      return;
    }

    const addr = CommandParser.parseNumber(args[0]);
    const value = this.cpu.readByte(addr);
    this.println(`[${addr.toString(16).padStart(4, '0')}] = ${value.toString(16).padStart(2, '0')}`);
  }

  /**
   * Poke command - write memory
   */
  private cmdPoke(args: string[]): void {
    if (args.length < 2) {
      this.println('Usage: poke <address> <value>');
      return;
    }

    const addr = CommandParser.parseNumber(args[0]);
    const value = CommandParser.parseNumber(args[1]);
    this.cpu.writeByte(addr, value & 0xFF);
    this.println(`[${addr.toString(16).padStart(4, '0')}] = ${(value & 0xFF).toString(16).padStart(2, '0')}`);
  }

  /**
   * Exit command - halt CPU
   */
  private cmdExit(): void {
    this.cpu.halted = true;
    this.cpu.exitCode = 0;
  }

  /**
   * Process input from keyboard buffer
   * Returns true if a command was executed
   */
  processInput(): boolean {
    // Read all available keys
    while (this.cpu.keyboard.hasKey()) {
      const key = this.cpu.keyboard.readKey();

      if (key === 0x0D || key === 0x0A) {
        // Enter key - execute command
        this.println(''); // Newline after input
        this.executeCommand(this.inputBuffer);
        this.inputBuffer = '';
        return true;
      } else if (key === 0x08) {
        // Backspace
        if (this.inputBuffer.length > 0) {
          this.inputBuffer = this.inputBuffer.slice(0, -1);
          // Echo backspace visually
          this.printChar(0x08);
        }
      } else if (key >= 0x20 && key < 0x7F) {
        // Printable character
        this.inputBuffer += String.fromCharCode(key);
        // Echo character
        this.printChar(key);
      }
    }

    return false;
  }

  /**
   * Print a string to console
   */
  private print(str: string): void {
    for (const char of str) {
      this.printChar(char.charCodeAt(0));
    }
  }

  /**
   * Print a string with newline
   */
  private println(str: string): void {
    this.print(str);
    this.printChar(0x0A);
  }

  /**
   * Print a single character using the CPU's syscall mechanism
   */
  private printChar(char: number): void {
    // Use the CPU's internal console output mechanism
    this.cpu.consoleOutput += String.fromCharCode(char);

    // Also update the GPU for visual display
    this.cpu.gpu.putcharWithCursor(char);
  }
}
