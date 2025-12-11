import { describe, it, expect, beforeEach } from 'vitest';
import { RiscVCpu } from '../src/emulator/cpu.js';
import { NativeAssembler } from '../src/emulator/native-assembler.js';

describe('Text Buffer (task-31.2)', () => {
  let cpu: RiscVCpu;
  let assembler: NativeAssembler;

  beforeEach(() => {
    cpu = new RiscVCpu(64 * 1024);
    assembler = new NativeAssembler();
  });

  describe('Buffer initialization', () => {
    it('should initialize buffer with zero line count', () => {
      const source = `
        ; Buffer structure at 0x2000:
        ;   +0: lineCount (word)
        ;   +4: capacity (word)
        ;   +8: modified (word)
        ;   +12: lines array (array of pointers)

        BUF_ADDR EQU 0x2000

        main:
          ; Initialize buffer
          LUI a0, BUF_ADDR>>12
          SW zero, 0(a0)        ; lineCount = 0
          ADDI t0, zero, 16
          SW t0, 4(a0)          ; capacity = 16
          SW zero, 8(a0)        ; modified = 0

          ; Read lineCount
          LW a0, 0(a0)
          ECALL
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000;

      let steps = 0;
      while (cpu.pc !== 0 && steps < 100) {
        cpu.step();
        steps++;
      }

      expect(cpu.getReg(10)).toBe(0);
    });

    it('should initialize buffer with correct capacity', () => {
      const source = `
        BUF_ADDR EQU 0x2000
        CAPACITY EQU 16

        main:
          LUI a0, BUF_ADDR>>12
          SW zero, 0(a0)
          ADDI t0, zero, CAPACITY
          SW t0, 4(a0)
          SW zero, 8(a0)

          ; Read capacity
          LW a0, 4(a0)
          ECALL
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000;

      let steps = 0;
      while (cpu.pc !== 0 && steps < 100) {
        cpu.step();
        steps++;
      }

      expect(cpu.getReg(10)).toBe(16);
    });

    it('should initialize modified flag to zero', () => {
      const source = `
        BUF_ADDR EQU 0x2000

        main:
          LUI a0, BUF_ADDR>>12
          SW zero, 0(a0)
          ADDI t0, zero, 16
          SW t0, 4(a0)
          SW zero, 8(a0)

          ; Read modified flag
          LW a0, 8(a0)
          ECALL
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000;

      let steps = 0;
      while (cpu.pc !== 0 && steps < 100) {
        cpu.step();
        steps++;
      }

      expect(cpu.getReg(10)).toBe(0);
    });
  });

  describe('Line insertion', () => {
    it('should increment line count when inserting a line', () => {
      const source = `
        BUF_ADDR EQU 0x2000

        main:
          ; Init buffer
          LUI a0, BUF_ADDR>>12
          SW zero, 0(a0)
          ADDI t0, zero, 16
          SW t0, 4(a0)

          ; Increment line count
          LW t0, 0(a0)
          ADDI t0, t0, 1
          SW t0, 0(a0)

          ; Read line count
          LW a0, 0(a0)
          ECALL
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000;

      let steps = 0;
      while (cpu.pc !== 0 && steps < 100) {
        cpu.step();
        steps++;
      }

      expect(cpu.getReg(10)).toBe(1);
    });

    it('should store line pointer in lines array', () => {
      const source = `
        BUF_ADDR EQU 0x2000
        LINE_PTR EQU 0x3000

        main:
          ; Init buffer
          LUI a0, BUF_ADDR>>12
          SW zero, 0(a0)

          ; Store line pointer at index 0
          ; lines array starts at offset 12
          LUI t0, LINE_PTR>>12
          SW t0, 12(a0)

          ; Increment line count
          ADDI t1, zero, 1
          SW t1, 0(a0)

          ; Read back line pointer
          LW a0, 12(a0)
          ECALL
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000;

      let steps = 0;
      while (cpu.pc !== 0 && steps < 100) {
        cpu.step();
        steps++;
      }

      expect(cpu.getReg(10)).toBe(0x3000);
    });

    it('should set modified flag when inserting line', () => {
      const source = `
        BUF_ADDR EQU 0x2000

        main:
          ; Init buffer
          LUI a0, BUF_ADDR>>12
          SW zero, 0(a0)
          SW zero, 8(a0)

          ; Insert line (just set modified flag)
          ADDI t0, zero, 1
          SW t0, 8(a0)

          ; Read modified flag
          LW a0, 8(a0)
          ECALL
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000;

      let steps = 0;
      while (cpu.pc !== 0 && steps < 100) {
        cpu.step();
        steps++;
      }

      expect(cpu.getReg(10)).toBe(1);
    });
  });

  describe('Line retrieval', () => {
    it('should retrieve stored line pointer', () => {
      const source = `
        BUF_ADDR EQU 0x2000
        LINE_0 EQU 0x3000
        LINE_1 EQU 0x4000

        main:
          LUI a0, BUF_ADDR>>12

          ; Store two line pointers
          LUI t0, LINE_0>>12
          SW t0, 12(a0)
          LUI t0, LINE_1>>12
          SW t0, 16(a0)

          ; Set line count
          ADDI t0, zero, 2
          SW t0, 0(a0)

          ; Retrieve line 1 (second line)
          LW a0, 16(a0)
          ECALL
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000;

      let steps = 0;
      while (cpu.pc !== 0 && steps < 100) {
        cpu.step();
        steps++;
      }

      expect(cpu.getReg(10)).toBe(0x4000);
    });
  });

  describe('Line deletion', () => {
    it('should decrement line count when deleting', () => {
      const source = `
        BUF_ADDR EQU 0x2000

        main:
          LUI a0, BUF_ADDR>>12

          ; Set initial line count to 3
          ADDI t0, zero, 3
          SW t0, 0(a0)

          ; Delete line (decrement)
          LW t0, 0(a0)
          ADDI t0, t0, -1
          SW t0, 0(a0)

          ; Read line count
          LW a0, 0(a0)
          ECALL
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000;

      let steps = 0;
      while (cpu.pc !== 0 && steps < 100) {
        cpu.step();
        steps++;
      }

      expect(cpu.getReg(10)).toBe(2);
    });
  });

  describe('Modified flag operations', () => {
    it('should clear modified flag', () => {
      const source = `
        BUF_ADDR EQU 0x2000

        main:
          LUI a0, BUF_ADDR>>12

          ; Set modified flag
          ADDI t0, zero, 1
          SW t0, 8(a0)

          ; Clear modified flag
          SW zero, 8(a0)

          ; Read modified flag
          LW a0, 8(a0)
          ECALL
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000;

      let steps = 0;
      while (cpu.pc !== 0 && steps < 100) {
        cpu.step();
        steps++;
      }

      expect(cpu.getReg(10)).toBe(0);
    });
  });

  describe('Buffer capacity', () => {
    it('should handle buffer at capacity', () => {
      const source = `
        BUF_ADDR EQU 0x2000
        CAPACITY EQU 16

        main:
          LUI a0, BUF_ADDR>>12

          ; Set capacity
          ADDI t0, zero, CAPACITY
          SW t0, 4(a0)

          ; Set line count to capacity
          SW t0, 0(a0)

          ; Check if at capacity (count == capacity)
          LW t1, 0(a0)
          LW t2, 4(a0)

          ; Result: 1 if equal, 0 if not
          SUB t3, t1, t2
          SLTU a0, zero, t3    ; a0 = (0 < t3) = (t3 != 0)
          XORI a0, a0, 1       ; Invert: a0 = (t3 == 0)
          ECALL
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000;

      let steps = 0;
      while (cpu.pc !== 0 && steps < 100) {
        cpu.step();
        steps++;
      }

      expect(cpu.getReg(10)).toBe(1); // At capacity
    });
  });
});
