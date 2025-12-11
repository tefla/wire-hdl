/**
 * Boot Disk - Creates bootable disk images with shell and commands
 *
 * Provides a complete bootable system with:
 * - Shell program
 * - Built-in commands (cat, ls, asm)
 * - Sample files
 */

import { RiscVCpu } from './cpu.js';
import { WireFS, SECTOR_SIZE } from './filesystem.js';
import { Shell, CommandParser } from './shell.js';
import { NativeAssembler } from './native-assembler.js';
import { ExecutableBuilder, ProgramLoader, EXECUTABLE_MAGIC, HEADER_SIZE } from './program-loader.js';
import { Bootloader, BOOT_CONFIG } from './bootloader.js';
import { TEXT_COLS, TEXT_ROWS } from './graphics.js';

/** Boot disk configuration */
export const BOOT_DISK_CONFIG = {
  /** Total disk size in bytes (64KB) */
  DISK_SIZE: 64 * 1024,
  /** Shell load address */
  SHELL_LOAD_ADDRESS: BOOT_CONFIG.PROGRAM_BASE,
} as const;

/**
 * Creates bootable disk images
 */
export class BootDisk {
  private fs: WireFS;
  private storage: Uint8Array;

  constructor() {
    this.storage = new Uint8Array(BOOT_DISK_CONFIG.DISK_SIZE);
    this.fs = new WireFS(this.storage);
  }

  /**
   * Create a complete bootable disk
   */
  create(): Uint8Array {
    // Format filesystem
    this.fs.format();

    // Add shell program
    this.addShell();

    // Add command programs
    this.addCommand('CAT', this.createCatProgram());
    this.addCommand('LS', this.createLsProgram());
    this.addCommand('ASM', this.createAsmProgram());

    // Add sample files
    this.addSampleFiles();

    return this.storage;
  }

  /**
   * Add the shell program
   */
  private addShell(): void {
    // Shell is a simple program that prints prompt and reads input
    // For now, create a placeholder that the InteractiveSystem will use
    const shellCode = this.createShellProgram();
    const exe = new ExecutableBuilder()
      .setCode(shellCode)
      .setStackSize(1024)
      .build();

    this.fs.createFile('SHELL', 'BIN');
    this.fs.writeFile('SHELL', 'BIN', exe);
  }

  /**
   * Create shell program code
   */
  private createShellProgram(): Uint8Array {
    // Simple shell that uses syscalls
    // This is a minimal implementation - the real shell logic
    // is handled by InteractiveSystem for easier testing
    const asm = new NativeAssembler();
    const code = asm.assemble(`
; Shell - prints prompt and waits
; The InteractiveSystem handles the actual shell logic

        ADDI a0, zero, 62   ; '>'
        ADDI a7, zero, 1    ; putchar syscall
        ECALL

        ADDI a0, zero, 32   ; ' '
        ECALL

; Wait loop - InteractiveSystem handles input
loop:   ADDI t0, zero, 0
        BEQ zero, zero, loop
`);
    return code;
  }

  /**
   * Create cat command program
   */
  private createCatProgram(): Uint8Array {
    // Cat prints file contents - placeholder
    const asm = new NativeAssembler();
    return asm.assemble(`
; CAT - display file contents
; Arguments passed in memory by shell
        ECALL   ; Exit (actual implementation in InteractiveSystem)
`);
  }

  /**
   * Create ls command program
   */
  private createLsProgram(): Uint8Array {
    const asm = new NativeAssembler();
    return asm.assemble(`
; LS - list files
        ECALL   ; Exit (actual implementation in InteractiveSystem)
`);
  }

  /**
   * Create asm command program
   */
  private createAsmProgram(): Uint8Array {
    const asm = new NativeAssembler();
    return asm.assemble(`
; ASM - assembler
        ECALL   ; Exit (actual implementation in InteractiveSystem)
`);
  }

  /**
   * Add a command program to disk
   */
  private addCommand(name: string, code: Uint8Array): void {
    const exe = new ExecutableBuilder()
      .setCode(code)
      .setStackSize(512)
      .build();

    this.fs.createFile(name, 'BIN');
    this.fs.writeFile(name, 'BIN', exe);
  }

  /**
   * Add sample files to disk
   */
  private addSampleFiles(): void {
    // README
    const readme = `Wire-RISCV OS
=============
Commands:
  help  - Show help
  ls    - List files
  cat   - Display file
  echo  - Print text
  cls   - Clear screen
  exit  - Halt system
`;
    this.fs.createFile('README', 'TXT');
    this.fs.writeFile('README', 'TXT', new TextEncoder().encode(readme));

    // Sample assembly file
    const helloAsm = `; Hello World
        ADDI a0, zero, 72   ; 'H'
        ADDI a7, zero, 1    ; putchar
        ECALL
        ADDI a0, zero, 105  ; 'i'
        ECALL
        ADDI a0, zero, 10   ; newline
        ECALL
        ECALL               ; exit
`;
    this.fs.createFile('HELLO', 'ASM');
    this.fs.writeFile('HELLO', 'ASM', new TextEncoder().encode(helloAsm));
  }
}

/**
 * Interactive system that manages boot and shell interaction
 */
export class InteractiveSystem {
  private cpu: RiscVCpu;
  private fs: WireFS | null = null;
  private shell: Shell | null = null;
  private running: boolean = false;
  private booted: boolean = false;
  private inputBuffer: string = '';

  constructor(cpu: RiscVCpu) {
    this.cpu = cpu;
  }

  /**
   * Boot the system from disk
   */
  boot(): void {
    // Create boot disk
    const bootDisk = new BootDisk();
    const diskImage = bootDisk.create();

    // Initialize filesystem from disk
    this.fs = new WireFS(diskImage);

    // Create shell
    this.shell = new Shell(this.cpu);

    // Initialize CPU
    this.cpu.reset();

    // Print boot message
    this.printBootMessage();

    // Show shell prompt
    this.shell.printPrompt();

    this.running = true;
    this.booted = true;
  }

  /**
   * Print boot message to screen
   */
  private printBootMessage(): void {
    const msg = 'Booting Wire-RISCV...\n\n';
    for (const char of msg) {
      this.cpu.gpu.putcharWithCursor(char.charCodeAt(0));
    }
    this.cpu.consoleOutput += msg;
  }

  /**
   * Check if system is running
   */
  isRunning(): boolean {
    return this.running && !this.cpu.halted;
  }

  /**
   * Get the filesystem
   */
  getFilesystem(): WireFS | null {
    return this.fs;
  }

  /**
   * Press a key
   */
  keyPress(ascii: number): void {
    if (!this.running) return;

    this.cpu.keyboard.keyPress(ascii);

    // Handle input immediately for responsiveness
    this.processInput(ascii);
  }

  /**
   * Process keyboard input
   */
  private processInput(ascii: number): void {
    if (ascii === 0x0D || ascii === 0x0A) {
      // Enter - execute command
      this.cpu.gpu.putcharWithCursor(0x0A);
      this.cpu.consoleOutput += '\n';

      if (this.inputBuffer.trim()) {
        this.executeCommand(this.inputBuffer);
      }

      this.inputBuffer = '';

      // Show prompt if not halted
      if (!this.cpu.halted && this.shell) {
        this.shell.printPrompt();
      }
    } else if (ascii === 0x08) {
      // Backspace
      if (this.inputBuffer.length > 0) {
        this.inputBuffer = this.inputBuffer.slice(0, -1);
        this.cpu.gpu.putcharWithCursor(ascii);
      }
    } else if (ascii >= 0x20 && ascii < 0x7F) {
      // Printable character
      this.inputBuffer += String.fromCharCode(ascii);
      this.cpu.gpu.putcharWithCursor(ascii);
      this.cpu.consoleOutput += String.fromCharCode(ascii);
    }
  }

  /**
   * Execute a shell command
   */
  private executeCommand(line: string): void {
    const { command, args } = CommandParser.parse(line);

    if (!command) return;

    // Handle built-in commands
    switch (command.toLowerCase()) {
      case 'help':
        this.cmdHelp();
        break;
      case 'cls':
        this.cmdCls();
        break;
      case 'echo':
        this.cmdEcho(args);
        break;
      case 'ls':
      case 'dir':
        this.cmdLs();
        break;
      case 'cat':
      case 'type':
        this.cmdCat(args);
        break;
      case 'mem':
        this.cmdMem();
        break;
      case 'run':
        this.cmdRun(args);
        break;
      case 'asm':
        this.cmdAsm(args);
        break;
      case 'exit':
        this.cmdExit();
        break;
      default:
        this.println(`Unknown command: ${command}`);
    }
  }

  /**
   * Help command
   */
  private cmdHelp(): void {
    this.println('Available commands:');
    this.println('  help  - Show this help');
    this.println('  ls    - List files');
    this.println('  cat   - Display file (cat FILE.EXT)');
    this.println('  echo  - Print text');
    this.println('  cls   - Clear screen');
    this.println('  mem   - Show memory info');
    this.println('  run   - Execute program (run FILE.BIN)');
    this.println('  asm   - Assemble file (asm FILE.ASM)');
    this.println('  exit  - Halt system');
  }

  /**
   * Clear screen command
   */
  private cmdCls(): void {
    for (let y = 0; y < TEXT_ROWS; y++) {
      for (let x = 0; x < TEXT_COLS; x++) {
        this.cpu.gpu.writeTextVram(x, y, 0x20, 0x07);
      }
    }
    this.cpu.gpu.setCursorPosition(0, 0);
  }

  /**
   * Echo command
   */
  private cmdEcho(args: string[]): void {
    this.println(args.join(' '));
  }

  /**
   * List files command
   */
  private cmdLs(): void {
    if (!this.fs) {
      this.println('No filesystem');
      return;
    }

    const files = this.fs.listFiles();
    if (files.length === 0) {
      this.println('No files');
      return;
    }

    for (const file of files) {
      const name = file.name.padEnd(8);
      const ext = file.extension.padEnd(3);
      const size = file.size.toString().padStart(6);
      this.println(`${name}.${ext}  ${size} bytes`);
    }
  }

  /**
   * Cat (display file) command
   */
  private cmdCat(args: string[]): void {
    if (!this.fs) {
      this.println('No filesystem');
      return;
    }

    if (args.length === 0) {
      this.println('Usage: cat FILE.EXT');
      return;
    }

    // Parse filename
    const filename = args[0].toUpperCase();
    const dotIndex = filename.lastIndexOf('.');
    const name = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
    const ext = dotIndex > 0 ? filename.slice(dotIndex + 1) : '';

    const data = this.fs.readFile(name, ext);
    if (!data) {
      this.println(`File not found: ${args[0]}`);
      return;
    }

    // Print file contents
    const text = new TextDecoder().decode(data);
    for (const line of text.split('\n')) {
      this.println(line);
    }
  }

  /**
   * Memory info command
   */
  private cmdMem(): void {
    const total = this.cpu.getMemorySize();
    this.println(`Memory: ${total} bytes (${Math.floor(total / 1024)}KB)`);

    if (this.fs) {
      const free = this.fs.getFreeSpace();
      this.println(`Disk free: ${free} bytes`);
    }
  }

  /**
   * Run (execute program) command
   */
  private cmdRun(args: string[]): void {
    if (!this.fs) {
      this.println('No filesystem');
      return;
    }

    if (args.length === 0) {
      this.println('Usage: run FILE.BIN');
      return;
    }

    // Parse filename
    const filename = args[0].toUpperCase();
    const dotIndex = filename.lastIndexOf('.');
    const name = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
    const ext = dotIndex > 0 ? filename.slice(dotIndex + 1) : 'BIN';

    const data = this.fs.readFile(name, ext);
    if (!data) {
      this.println(`File not found: ${args[0]}`);
      return;
    }

    // Check for executable magic
    if (data.length < HEADER_SIZE) {
      this.println('Invalid executable: too small');
      return;
    }

    const magic =
      data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24);
    if (magic !== EXECUTABLE_MAGIC) {
      this.println('Invalid executable: not a RISV file');
      return;
    }

    // Load and execute
    try {
      const loader = new ProgramLoader(this.cpu);
      const loadInfo = loader.load(data, BOOT_CONFIG.PROGRAM_BASE);

      // Set up CPU for execution
      this.cpu.pc = loadInfo.entryPoint;
      this.cpu.x[2] = loadInfo.stackTop; // sp

      this.println(`Loaded at 0x${loadInfo.codeBase.toString(16)}`);
      this.println(`Entry point: 0x${loadInfo.entryPoint.toString(16)}`);

      // Run program
      const cycles = this.cpu.run(100000);
      this.println(`Executed ${cycles} cycles`);

      if (this.cpu.halted) {
        this.println('Program halted');
        this.cpu.halted = false; // Allow continuing
      }
    } catch (err) {
      this.println(`Error: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  /**
   * Asm (assemble) command
   */
  private cmdAsm(args: string[]): void {
    if (!this.fs) {
      this.println('No filesystem');
      return;
    }

    if (args.length === 0) {
      this.println('Usage: asm FILE.ASM [OUTPUT.BIN]');
      return;
    }

    // Parse source filename
    const srcFilename = args[0].toUpperCase();
    const srcDotIndex = srcFilename.lastIndexOf('.');
    const srcName = srcDotIndex > 0 ? srcFilename.slice(0, srcDotIndex) : srcFilename;
    const srcExt = srcDotIndex > 0 ? srcFilename.slice(srcDotIndex + 1) : 'ASM';

    const srcData = this.fs.readFile(srcName, srcExt);
    if (!srcData) {
      this.println(`File not found: ${args[0]}`);
      return;
    }

    // Parse output filename
    let outName = srcName;
    let outExt = 'BIN';
    if (args.length > 1) {
      const outFilename = args[1].toUpperCase();
      const outDotIndex = outFilename.lastIndexOf('.');
      outName = outDotIndex > 0 ? outFilename.slice(0, outDotIndex) : outFilename;
      outExt = outDotIndex > 0 ? outFilename.slice(outDotIndex + 1) : 'BIN';
    }

    // Assemble
    try {
      const source = new TextDecoder().decode(srcData);
      const asm = new NativeAssembler();
      const code = asm.assemble(source);

      // Create executable
      const exe = new ExecutableBuilder()
        .setCode(code)
        .setStackSize(512)
        .build();

      // Write output file
      if (!this.fs.fileExists(outName, outExt)) {
        this.fs.createFile(outName, outExt);
      }
      this.fs.writeFile(outName, outExt, exe);

      this.println(`Assembled ${code.length} bytes of code`);
      this.println(`Written to ${outName}.${outExt} (${exe.length} bytes)`);
    } catch (err) {
      this.println(`Error: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  /**
   * Exit command
   */
  private cmdExit(): void {
    this.println('Halting...');
    this.cpu.halted = true;
    this.running = false;
  }

  /**
   * Print a line to console
   */
  private println(text: string): void {
    for (const char of text) {
      this.cpu.gpu.putcharWithCursor(char.charCodeAt(0));
    }
    this.cpu.gpu.putcharWithCursor(0x0A);
    this.cpu.consoleOutput += text + '\n';
  }

  /**
   * Run for specified number of cycles
   */
  tick(maxCycles: number): number {
    if (!this.running || this.cpu.halted) {
      return 0;
    }

    // For the interactive system, we don't actually run CPU cycles
    // The shell is handled via TypeScript for testability
    // Just return 0 to indicate no actual CPU cycles were run
    return 0;
  }
}
