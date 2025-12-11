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

    // Add native command programs
    this.addNativeCommands();

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
   * Add native command programs to disk
   */
  private addNativeCommands(): void {
    const asm = new NativeAssembler();

    // ECHO command - prints "Hello from native echo!"
    // The message will be in the data section
    // Code is 9 instructions (36 bytes = 0x24), so data is at 0x1000 + 0x24 = 0x1024
    const echoCode = asm.assemble(`
; ECHO - native echo command
; Prints hardcoded message from data section

        LUI a0, 0x1         ; Base address 0x1000
        ADDI a0, a0, 0x24   ; Add offset to data (36 bytes of code)
        ADDI a7, zero, 3    ; PUTS syscall
        ECALL

        ADDI a0, zero, 10   ; Print newline
        ADDI a7, zero, 1    ; PUTCHAR syscall
        ECALL

        ADDI a7, zero, 0    ; EXIT syscall
        ECALL
`);

    const echoMsg = new TextEncoder().encode('Hello from native echo!\0');
    const echoExe = new ExecutableBuilder()
      .setCode(echoCode)
      .setData(echoMsg)
      .setStackSize(256)
      .build();
    this.fs.createFile('ECHO', 'BIN');
    this.fs.writeFile('ECHO', 'BIN', echoExe);

    // CAT command - displays README.TXT
    // Filename is embedded in data section
    // Code is 34 instructions (136 bytes = 0x88), so data is at 0x1000 + 0x88 = 0x1088
    const catCode = asm.assemble(`
; CAT - native cat command
; Cats hardcoded file (README.TXT)

        ; Open file
        LUI a0, 0x1         ; filename address (in data section)
        ADDI a0, a0, 0x88   ; offset after code (34 instructions = 136 bytes)
        ADDI a1, zero, 0    ; mode = read
        ADDI a7, zero, 7    ; FOPEN syscall
        ECALL

        ; Save handle
        ADDI s0, a0, 0      ; s0 = file handle

        ; Check if open failed
        ADDI t0, zero, -1
        BEQ s0, t0, error

; Read loop
loop:   ADDI a0, s0, 0      ; handle
        LUI a1, 0x2         ; buffer at 0x2000
        ADDI a2, zero, 100  ; read 100 bytes
        ADDI a7, zero, 8    ; FREAD syscall
        ECALL

        ; Check bytes read
        ADDI s1, a0, 0      ; s1 = bytes read
        BEQ s1, zero, done  ; if 0, EOF

        ; Print buffer
        ADDI s2, zero, 0    ; i = 0
print:  BEQ s2, s1, loop    ; if i == bytes_read, read more
        LUI t0, 0x2
        ADD t0, t0, s2      ; t0 = buffer + i
        LBU a0, 0(t0)       ; load byte
        ADDI a7, zero, 1    ; PUTCHAR
        ECALL
        ADDI s2, s2, 1      ; i++
        JAL zero, print

done:   ; Close file
        ADDI a0, s0, 0      ; handle
        ADDI a7, zero, 10   ; FCLOSE syscall
        ECALL
        JAL zero, exit

error:  ; Print error message
        LUI a0, 0x1
        ADDI a0, a0, 0x93   ; error msg offset (0x88 + 11 bytes for "README.TXT\0")
        ADDI a7, zero, 3    ; PUTS
        ECALL

exit:   ADDI a7, zero, 0    ; EXIT
        ECALL
`);

    const catData = new TextEncoder().encode('README.TXT\0File not found\0');
    const catExe = new ExecutableBuilder()
      .setCode(catCode)
      .setData(catData)
      .setStackSize(512)
      .build();
    this.fs.createFile('CAT', 'BIN');
    this.fs.writeFile('CAT', 'BIN', catExe);

    // LS command - list directory contents
    // Code is 54 instructions (216 bytes = 0xD8), so data is at 0x1000 + 0xD8 = 0x10D8
    const lsCode = asm.assemble(`
; LS - native ls command
; Lists all files in directory

loop:
        ; Call readdir syscall
        LUI a0, 0x2         ; name buffer at 0x2000
        LUI a1, 0x2         ; ext buffer at 0x2008
        ADDI a1, a1, 8
        LUI a2, 0x2         ; size buffer at 0x200B
        ADDI a2, a2, 11
        ADDI a7, zero, 11   ; READDIR syscall
        ECALL

        ; Check if done (returns 0 when no more entries)
        BEQ a0, zero, done

        ; Print name (8 bytes)
        LUI s0, 0x2         ; s0 = name buffer
        ADDI s1, zero, 8    ; counter
print_name:
        LBU a0, 0(s0)       ; load byte
        ADDI a7, zero, 1    ; PUTCHAR
        ECALL
        ADDI s0, s0, 1      ; next byte
        ADDI s1, s1, -1
        BNE s1, zero, print_name

        ; Print dot
        ADDI a0, zero, 46    ; ASCII '.'
        ADDI a7, zero, 1
        ECALL

        ; Print extension (3 bytes)
        LUI s0, 0x2
        ADDI s0, s0, 8      ; ext buffer
        ADDI s1, zero, 3
print_ext:
        LBU a0, 0(s0)
        ADDI a7, zero, 1
        ECALL
        ADDI s0, s0, 1
        ADDI s1, s1, -1
        BNE s1, zero, print_ext

        ; Print two spaces
        ADDI a0, zero, 32    ; ASCII ' '
        ADDI a7, zero, 1
        ECALL
        ECALL

        ; Load size (4 bytes little-endian)
        LUI s0, 0x2
        ADDI s0, s0, 11     ; size buffer
        LBU t0, 0(s0)       ; byte 0
        LBU t1, 1(s0)       ; byte 1
        LBU t2, 2(s0)       ; byte 2
        LBU t3, 3(s0)       ; byte 3
        SLLI t1, t1, 8
        SLLI t2, t2, 16
        SLLI t3, t3, 24
        OR t0, t0, t1
        OR t0, t0, t2
        OR t0, t0, t3       ; t0 = size

        ; Print size using PUTD syscall
        ADDI a0, t0, 0      ; size in a0
        ADDI a7, zero, 12   ; PUTD syscall
        ECALL

        ; Print bytes suffix
        LUI a0, 0x1         ; data section
        ADDI a0, a0, 0xD8   ; offset to bytes string (54 instructions = 216 bytes)
        ADDI a7, zero, 3    ; PUTS
        ECALL

        ; Loop for next entry
        JAL zero, loop

done:   ; Exit
        ADDI a7, zero, 0
        ECALL
`);

    const lsData = new TextEncoder().encode(' bytes\n\0');
    const lsExe = new ExecutableBuilder()
      .setCode(lsCode)
      .setData(lsData)
      .setStackSize(512)
      .build();
    this.fs.createFile('LS', 'BIN');
    this.fs.writeFile('LS', 'BIN', lsExe);

    // ASM command - assembles source files
    // Hardcoded to assemble HELLO.ASM to HELLO.BIN
    // Code is 89 instructions (356 bytes = 0x164), so data at 0x1000 + 0x164 = 0x1164
    const asmCode = asm.assemble(`
; ASM - native assembler command
; Assembles HELLO.ASM to HELLO.BIN

        ; Open source file (HELLO.ASM)
        LUI a0, 0x1
        ADDI a0, a0, 0x164  ; filename in data
        ADDI a1, zero, 0    ; mode = read
        ADDI a7, zero, 7    ; FOPEN
        ECALL
        ADDI s0, a0, 0      ; s0 = source file handle

        ; Check if open failed
        ADDI t0, zero, -1
        BEQ s0, t0, error_open

        ; Read entire source file into buffer at 0x3000
        ADDI a0, s0, 0      ; file handle
        LUI a1, 0x3         ; buffer at 0x3000
        LUI a2, 0x1         ; read up to 4KB
        ADDI a7, zero, 8    ; FREAD
        ECALL
        ADDI s1, a0, 0      ; s1 = bytes read

        ; Null-terminate the source buffer
        LUI t0, 0x3
        ADD t0, t0, s1
        ADDI t1, zero, 0
        SB t1, 0(t0)

        ; Close source file
        ADDI a0, s0, 0
        ADDI a7, zero, 10   ; FCLOSE
        ECALL

        ; Call ASSEMBLE syscall
        ; a0 = source buffer, a1 = output buffer, a2 = max size
        LUI a0, 0x3         ; source at 0x3000
        LUI a1, 0x4         ; output at 0x4000
        LUI a2, 0x1         ; max 4KB output
        ADDI a7, zero, 13   ; ASSEMBLE syscall
        ECALL
        ADDI s2, a0, 0      ; s2 = code size (or -1 if error)

        ; Check for assembly error
        ADDI t0, zero, -1
        BEQ s2, t0, error_asm

        ; Open output file (HELLO.BIN)
        LUI a0, 0x1
        ADDI a0, a0, 0x16F  ; output filename in data
        ADDI a1, zero, 1    ; mode = write
        ADDI a7, zero, 7    ; FOPEN
        ECALL
        ADDI s3, a0, 0      ; s3 = output file handle

        ; Check if open failed
        ADDI t0, zero, -1
        BEQ s3, t0, error_write

        ; Wrap assembled code in RISV executable format
        ; Write 24-byte header + assembled code

        ; Write RISV magic (0x56524952)
        LUI a1, 0x5        ; temp buffer at 0x5000
        LUI t0, 0x56524
        ADDI t0, t0, 0x952  ; 0x56524952
        SW t0, 0(a1)

        ; Write entry point (0x1000)
        LUI t0, 0x1
        SW t0, 4(a1)

        ; Write code size
        SW s2, 8(a1)

        ; Write data size (0)
        SW zero, 12(a1)

        ; Write BSS size (0)
        SW zero, 16(a1)

        ; Write stack size (512)
        ADDI t0, zero, 512
        SW t0, 20(a1)

        ; Write header to file
        ADDI a0, s3, 0      ; file handle
        LUI a1, 0x5         ; header buffer
        ADDI a2, zero, 24   ; header size
        ADDI a7, zero, 9    ; FWRITE
        ECALL

        ; Write assembled code to file
        ADDI a0, s3, 0      ; file handle
        LUI a1, 0x4         ; code buffer
        ADDI a2, s2, 0      ; code size
        ADDI a7, zero, 9    ; FWRITE
        ECALL

        ; Close output file
        ADDI a0, s3, 0
        ADDI a7, zero, 10   ; FCLOSE
        ECALL

        ; Print success message
        LUI a0, 0x1
        ADDI a0, a0, 0x17A  ; success msg
        ADDI a7, zero, 3    ; PUTS
        ECALL

        ; Print code size
        ADDI a0, s2, 0
        ADDI a7, zero, 12   ; PUTD
        ECALL

        LUI a0, 0x1
        ADDI a0, a0, 0x185  ; bytes suffix
        ADDI a7, zero, 3
        ECALL

        JAL zero, done

error_open:
        LUI a0, 0x1
        ADDI a0, a0, 0x18D  ; File not found message
        ADDI a7, zero, 3
        ECALL
        JAL zero, done

error_asm:
        LUI a0, 0x1
        ADDI a0, a0, 0x19D  ; Assembly error message
        ADDI a7, zero, 3
        ECALL
        JAL zero, done

error_write:
        LUI a0, 0x1
        ADDI a0, a0, 0x1AD  ; Write error message
        ADDI a7, zero, 3
        ECALL

done:   ADDI a7, zero, 0    ; EXIT
        ECALL
`);

    const asmData = new TextEncoder().encode(
      'HELLO.ASM\0' +           // offset 0x164 (11 bytes)
      'HELLO.BIN\0' +           // offset 0x16F (11 bytes)
      'Assembled \0' +          // offset 0x17A (11 bytes)
      ' bytes\n\0' +            // offset 0x185 (8 bytes)
      'File not found\n\0' +    // offset 0x18D (16 bytes)
      'Assembly error\n\0' +    // offset 0x19D (16 bytes)
      'Write error\n\0'         // offset 0x1AD (13 bytes)
    );

    const asmExe = new ExecutableBuilder()
      .setCode(asmCode)
      .setData(asmData)
      .setStackSize(1024)
      .build();
    this.fs.createFile('ASM', 'BIN');
    this.fs.writeFile('ASM', 'BIN', asmExe);
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
        ADDI a7, zero, 0    ; exit syscall
        ECALL
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

    // Attach filesystem to CPU for syscalls
    this.cpu.filesystem = this.fs;

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
