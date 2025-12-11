import { describe, it, expect, beforeEach } from 'vitest';
import { RiscVCpu, SYSCALL } from '../src/emulator/cpu.js';
import { NativeAssembler } from '../src/emulator/native-assembler.js';
import { WireFS } from '../src/emulator/filesystem.js';

describe('File Operations (task-31.3)', () => {
  let cpu: RiscVCpu;
  let assembler: NativeAssembler;
  let fs: WireFS;

  beforeEach(() => {
    cpu = new RiscVCpu(64 * 1024);
    assembler = new NativeAssembler();
    fs = new WireFS();
    fs.format(); // Format the filesystem
    cpu.filesystem = fs;

    // Create test files
    fs.createFile('test.txt');
    fs.writeFile('test.txt', new TextEncoder().encode('Hello\nWorld\n'));
  });

  describe('File open', () => {
    it('should open existing file for reading', () => {
      const source = `
        SYSCALL_FOPEN EQU ${SYSCALL.FOPEN}

        filename: .string "test.txt"

        main:
          LUI a0, 0x1           ; 0x1000 >> 12
          ADDI a0, a0, 0        ; filename at 0x1000
          ADDI a1, zero, 0      ; mode = read
          ADDI a7, zero, SYSCALL_FOPEN
          ECALL
          ; a0 contains file descriptor (>= 0 on success)
          ; Exit via syscall 0
          ADDI a7, zero, 0
          ECALL
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000 + 9; // Skip over "test.txt\0" string

      let steps = 0;
      while (cpu.pc !== 0 && steps < 100) {
        cpu.step();
        steps++;
      }

      // File descriptor should be >= 0 (success)
      expect(cpu.getReg(10)).toBeGreaterThanOrEqual(0);
    });

    it('should return error for non-existent file', () => {
      const source = `
        SYSCALL_FOPEN EQU ${SYSCALL.FOPEN}

        filename: .string "nonexistent.txt"

        main:
          LUI a0, 0x1
          ADDI a0, a0, 0
          ADDI a1, zero, 0      ; mode = read
          ADDI a7, zero, SYSCALL_FOPEN
          ECALL
          ; a0 contains -1 on error
          ADDI a7, zero, 0
          ECALL
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000 + 16; // Skip over "nonexistent.txt\0" (16 bytes)

      let steps = 0;
      while (cpu.pc !== 0 && steps < 100) {
        cpu.step();
        steps++;
      }

      // Should return -1 for error
      expect(cpu.getReg(10)).toBe(-1 >>> 0); // Convert to unsigned
    });

    it('should open file for writing', () => {
      const source = `
        SYSCALL_FOPEN EQU ${SYSCALL.FOPEN}

        filename: .string "new.txt"

        main:
          LUI a0, 0x1
          ADDI a0, a0, 0
          ADDI a1, zero, 1      ; mode = write
          ADDI a7, zero, SYSCALL_FOPEN
          ECALL
          ADDI a7, zero, 0
          ECALL
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000 + 8; // Skip over "new.txt\0"

      let steps = 0;
      while (cpu.pc !== 0 && steps < 100) {
        cpu.step();
        steps++;
      }

      // File descriptor should be >= 0
      expect(cpu.getReg(10)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('File read', () => {
    it('should read file content into buffer', () => {
      const source = `
        SYSCALL_FOPEN EQU ${SYSCALL.FOPEN}
        SYSCALL_FREAD EQU ${SYSCALL.FREAD}
        SYSCALL_FCLOSE EQU ${SYSCALL.FCLOSE}

        filename: .string "test.txt"

        main:
          ; Open file
          LUI a0, 0x1
          ADDI a0, a0, 0
          ADDI a1, zero, 0
          ADDI a7, zero, SYSCALL_FOPEN
          ECALL
          ADDI s0, a0, 0        ; Save fd in s0

          ; Read into buffer at 0x3000
          ADDI a0, s0, 0        ; fd
          LUI a1, 0x3        ; buffer
          ADDI a2, zero, 20     ; max bytes
          ADDI a7, zero, SYSCALL_FREAD
          ECALL
          ADDI s1, a0, 0        ; Save bytes read

          ; Close file
          ADDI a0, s0, 0
          ADDI a7, zero, SYSCALL_FCLOSE
          ECALL

          ; Return bytes read
          ADDI a0, s1, 0
          ADDI a7, zero, 0
          ECALL
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000 + 9;

      let steps = 0;
      while (cpu.pc !== 0 && steps < 200) {
        cpu.step();
        steps++;
      }

      // Should have read 12 bytes ("Hello\nWorld\n")
      expect(cpu.getReg(10)).toBe(12);

      // Verify buffer content
      const buffer = cpu.memory.slice(0x3000, 0x3000 + 12);
      const content = new TextDecoder().decode(buffer);
      expect(content).toBe('Hello\nWorld\n');
    });

    it('should handle empty file', () => {
      // Create empty file
      fs.createFile('empty.txt');
      fs.writeFile('empty.txt', new Uint8Array(0));

      const source = `
        SYSCALL_FOPEN EQU ${SYSCALL.FOPEN}
        SYSCALL_FREAD EQU ${SYSCALL.FREAD}
        SYSCALL_FCLOSE EQU ${SYSCALL.FCLOSE}

        filename: .string "empty.txt"

        main:
          LUI a0, 0x1
          ADDI a0, a0, 0
          ADDI a1, zero, 0
          ADDI a7, zero, SYSCALL_FOPEN
          ECALL
          ADDI s0, a0, 0

          ADDI a0, s0, 0
          LUI a1, 0x3
          ADDI a2, zero, 20
          ADDI a7, zero, SYSCALL_FREAD
          ECALL
          ADDI s1, a0, 0

          ADDI a0, s0, 0
          ADDI a7, zero, SYSCALL_FCLOSE
          ECALL

          ADDI a0, s1, 0
          ADDI a7, zero, 0
          ECALL
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000 + 10;

      let steps = 0;
      while (cpu.pc !== 0 && steps < 200) {
        cpu.step();
        steps++;
      }

      // Should read 0 bytes
      expect(cpu.getReg(10)).toBe(0);
    });
  });

  describe('File write', () => {
    it('should write buffer content to file', () => {
      const source = `
        SYSCALL_FOPEN EQU ${SYSCALL.FOPEN}
        SYSCALL_FWRITE EQU ${SYSCALL.FWRITE}
        SYSCALL_FCLOSE EQU ${SYSCALL.FCLOSE}

        filename: .string "output.txt"
        data: .string "Test data"

        main:
          ; Open for write
          LUI a0, 0x1
          ADDI a0, a0, 0
          ADDI a1, zero, 1
          ADDI a7, zero, SYSCALL_FOPEN
          ECALL
          ADDI s0, a0, 0

          ; Write data
          ADDI a0, s0, 0
          LUI a1, 0x1
          ADDI a1, a1, 11       ; data starts after "output.txt\0"
          ADDI a2, zero, 9      ; "Test data" length
          ADDI a7, zero, SYSCALL_FWRITE
          ECALL
          ADDI s1, a0, 0        ; bytes written

          ; Close
          ADDI a0, s0, 0
          ADDI a7, zero, SYSCALL_FCLOSE
          ECALL

          ADDI a0, s1, 0
          ADDI a7, zero, 0
          ECALL
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000 + 11 + 10; // Skip "output.txt\0" and "Test data\0"

      let steps = 0;
      while (cpu.pc !== 0 && steps < 200) {
        cpu.step();
        steps++;
      }

      // Should write 9 bytes
      expect(cpu.getReg(10)).toBe(9);

      // Verify file was created
      const content = fs.readFile('output.txt');
      expect(content).toBeDefined();
      expect(new TextDecoder().decode(content)).toBe('Test data');
    });
  });

  describe('File close', () => {
    it('should close open file descriptor', () => {
      const source = `
        SYSCALL_FOPEN EQU ${SYSCALL.FOPEN}
        SYSCALL_FCLOSE EQU ${SYSCALL.FCLOSE}

        filename: .string "test.txt"

        main:
          LUI a0, 0x1
          ADDI a0, a0, 0
          ADDI a1, zero, 0
          ADDI a7, zero, SYSCALL_FOPEN
          ECALL
          ADDI s0, a0, 0

          ; Close
          ADDI a0, s0, 0
          ADDI a7, zero, SYSCALL_FCLOSE
          ECALL
          ; Returns 0 on success
          ADDI a7, zero, 0
          ECALL
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000 + 9;

      let steps = 0;
      while (cpu.pc !== 0 && steps < 100) {
        cpu.step();
        steps++;
      }

      // Should return 0 on success
      expect(cpu.getReg(10)).toBe(0);
    });
  });

  describe('Load file into text buffer', () => {
    it('should parse lines from file content', () => {
      const source = `
        ; This test demonstrates loading a file and parsing lines
        SYSCALL_FOPEN EQU ${SYSCALL.FOPEN}
        SYSCALL_FREAD EQU ${SYSCALL.FREAD}
        SYSCALL_FCLOSE EQU ${SYSCALL.FCLOSE}

        filename: .string "test.txt"

        main:
          ; Open
          LUI a0, 0x1
          ADDI a0, a0, 0
          ADDI a1, zero, 0
          ADDI a7, zero, SYSCALL_FOPEN
          ECALL
          ADDI s0, a0, 0

          ; Read
          ADDI a0, s0, 0
          LUI a1, 0x3
          ADDI a2, zero, 100
          ADDI a7, zero, SYSCALL_FREAD
          ECALL
          ADDI s1, a0, 0        ; bytes read

          ; Close
          ADDI a0, s0, 0
          ADDI a7, zero, SYSCALL_FCLOSE
          ECALL

          ; Count newlines in buffer
          LUI t0, 0x3           ; buffer start (0x3000)
          ADDI t1, s1, 0        ; bytes read
          ADDI t2, zero, 0      ; line count

        count_loop:
          BEQ t1, zero, done
          LBU t3, 0(t0)
          ADDI t4, zero, 10     ; newline = 10
          BNE t3, t4, skip_inc
          ADDI t2, t2, 1

        skip_inc:
          ADDI t0, t0, 1
          ADDI t1, t1, -1
          JAL zero, count_loop

        done:
          ADDI a0, t2, 0
          ADDI a7, zero, 0
          ECALL
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000 + 9;

      let steps = 0;
      while (cpu.pc !== 0 && steps < 1000) {
        cpu.step();
        steps++;
      }

      // "Hello\nWorld\n" contains 2 newlines
      expect(cpu.getReg(10)).toBe(2);
    });
  });
});
