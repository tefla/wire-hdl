import { describe, it, expect, beforeEach } from 'vitest';
import { RiscVCpu } from '../src/emulator/cpu.js';
import { NativeAssembler } from '../src/emulator/native-assembler.js';

describe('EDIT - Text Editor', () => {
  describe('Text Buffer Data Structure (task-31.2)', () => {
    let cpu: RiscVCpu;
    let assembler: NativeAssembler;

    beforeEach(() => {
      cpu = new RiscVCpu(64 * 1024); // 64KB RAM
      assembler = new NativeAssembler();
    });

    it('should evaluate BUFFER_ADDR>>12 correctly', () => {
      const source = `
        BUFFER_ADDR EQU 0x2000
        LUI a0, BUFFER_ADDR>>12
        ECALL
      `;
      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000;

      while (cpu.pc !== 0 && cpu.pc < 0x2000) {
        cpu.step();
      }

      // BUFFER_ADDR>>12 = 0x2000>>12 = 2
      // LUI a0, 2 should load 0x2000 into a0
      expect(cpu.getReg(10)).toBe(0x2000);
    });

    it('should initialize empty text buffer', () => {
      const source = `
        ; Constants using EQU directive
        BUF_LINE_COUNT    EQU 0
        BUF_LINE_CAPACITY EQU 4
        BUF_MODIFIED      EQU 8
        BUF_LINES         EQU 12
        INITIAL_CAPACITY  EQU 16
        BUFFER_ADDR       EQU 0x2000

        .text
        main:
          LUI a0, BUFFER_ADDR>>12
          JAL ra, initBuffer

          ; Check line count is 0
          LW a0, BUF_LINE_COUNT(a0)
          ECALL

        initBuffer:
          ; Initialize buffer structure
          ; a0 = buffer address
          SW zero, BUF_LINE_COUNT(a0)
          ADDI t0, zero, INITIAL_CAPACITY
          SW t0, BUF_LINE_CAPACITY(a0)
          SW zero, BUF_MODIFIED(a0)
          JALR zero, ra, 0
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000;

      // Run until ECALL
      let steps = 0;
      while (cpu.pc !== 0 && steps < 1000) {
        cpu.step();
        steps++;
      }

      // Check that line count is 0
      expect(cpu.getReg(10)).toBe(0);
    });

    it('should insert a line at position 0', () => {
      const source = `
        BUF_LINE_COUNT    EQU 0
        BUF_LINE_CAPACITY EQU 4
        BUF_MODIFIED      EQU 8
        BUF_LINES         EQU 12
        INITIAL_CAPACITY  EQU 16
        BUFFER_ADDR       EQU 0x2000
        STACK_FRAME       EQU 16

        .macro PUSH_FRAME
          ADDI sp, sp, -STACK_FRAME
          SW ra, 0(sp)
          SW s0, 4(sp)
          SW s1, 8(sp)
          SW s2, 12(sp)
        .endmacro

        .macro POP_FRAME
          LW ra, 0(sp)
          LW s0, 4(sp)
          LW s1, 8(sp)
          LW s2, 12(sp)
          ADDI sp, sp, STACK_FRAME
        .endmacro

        .data

        testLine: .string "Hello, World!"

        main:
          LUI sp, 0x3000      ; Set up stack
          LUI a0, BUFFER_ADDR>>12
          JAL ra, initBuffer

          ; Insert line at position 0
          ADDI a1, zero, 0
          LUI a2, 0x1000       ; Base address where program loaded
          ADDI a2, a2, 0       ; testLine is at offset 0 in data section
        .text
          JAL ra, insertLine

          ; Check line count is now 1
          LUI a0, BUFFER_ADDR>>12
          LW a0, BUF_LINE_COUNT(a0)
          ECALL

        initBuffer:
          SW zero, BUF_LINE_COUNT(a0)
          ADDI t0, zero, INITIAL_CAPACITY
          SW t0, BUF_LINE_CAPACITY(a0)
          SW zero, BUF_MODIFIED(a0)
          JALR zero, ra, 0

        insertLine:
          PUSH_FRAME

          ; s0 = buffer, s1 = line num, s2 = text
          ADDI s0, a0, 0
          ADDI s1, a1, 0
          ADDI s2, a2, 0

          ; Store text pointer: lines[line_num] = text
          ADDI t0, zero, BUF_LINES
          SLLI t1, s1, 2        ; line num * 4
          ADD t0, t0, t1        ; offset = BUF_LINES + (line_num * 4)
          ADD t0, s0, t0        ; address = buffer + offset
          SW s2, 0(t0)          ; store text pointer

          ; Increment line count
          LW t0, BUF_LINE_COUNT(s0)
          ADDI t0, t0, 1
          SW t0, BUF_LINE_COUNT(s0)

          ; Set modified flag
          ADDI t0, zero, 1
          SW t0, BUF_MODIFIED(s0)

          POP_FRAME
          JALR zero, ra, 0
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);

      // Data section: "Hello, World!\0" = 14 bytes
      // Text section starts at 0x1000 + 14 = 0x100E
      cpu.pc = 0x1000 + 14;

      // Run until ECALL
      let steps = 0;
      while (cpu.pc !== 0 && steps < 10000) {
        cpu.step();
        steps++;
      }

      // Check that line count is 1
      expect(cpu.getReg(10)).toBe(1);
    });

    it('should get line content from buffer', () => {
      const source = `
        BUF_LINE_COUNT    EQU 0
        BUF_LINES         EQU 12
        INITIAL_CAPACITY  EQU 16
        BUFFER_ADDR       EQU 0x2000
        STACK_FRAME       EQU 16

        .macro PUSH_FRAME
          ADDI sp, sp, -STACK_FRAME
          SW ra, 0(sp)
          SW s0, 4(sp)
          SW s1, 8(sp)
          SW s2, 12(sp)
        .endmacro

        .macro POP_FRAME
          LW ra, 0(sp)
          LW s0, 4(sp)
          LW s1, 8(sp)
          LW s2, 12(sp)
          ADDI sp, sp, STACK_FRAME
        .endmacro

        .data
          ; a0 = buffer, a1 = line number, a2 = text pointer
        testLine: .string "Test Line"

        main:
          LUI sp, 0x3000
          LUI a0, BUFFER_ADDR>>12
          JAL ra, initBuffer

          ; Insert line
          ADDI a1, zero, 0
          LUI a2, 0x1000
          ADDI a2, a2, 0        ; testLine at data offset 0
        .text
          JAL ra, insertLine

          ; Get line 0
          LUI a0, BUFFER_ADDR>>12
          ADDI a1, zero, 0
          JAL ra, getLine

          ; Load first character
          LBU a0, 0(a0)
          ECALL

        initBuffer:
          SW zero, 0(a0)
          ADDI t0, zero, INITIAL_CAPACITY
          SW t0, 4(a0)
          SW zero, 8(a0)
          JALR zero, ra, 0

        insertLine:
          PUSH_FRAME
          ADDI s0, a0, 0
          ADDI s1, a1, 0
          ADDI s2, a2, 0
          ADDI t0, zero, BUF_LINES
          SLLI t1, s1, 2
          ADD t0, t0, t1
          ADD t0, s0, t0
          SW s2, 0(t0)
          LW t0, 0(s0)
          ADDI t0, t0, 1
          SW t0, 0(s0)
          ADDI t0, zero, 1
          SW t0, 8(s0)
          POP_FRAME
          JALR zero, ra, 0

        getLine:
          ; a0 = buffer, a1 = line number
          ; Returns pointer in a0
          ADDI t0, zero, BUF_LINES
          SLLI t1, a1, 2        ; line num * 4
          ADD t0, t0, t1
          ADD t0, a0, t0
          LW a0, 0(t0)          ; Load line pointer
          JALR zero, ra, 0
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);

      // Data section: "Test Line\0" = 10 bytes
      // Text section starts at 0x1000 + 10 = 0x100A
      cpu.pc = 0x1000 + 10;

      // Run until ECALL
      let steps = 0;
      while (cpu.pc !== 0 && steps < 10000) {
        cpu.step();
        steps++;
      }

      // Check that first character is 'T' (0x54)
      expect(cpu.getReg(10)).toBe(0x54);
    });

    it('should track modified flag', () => {
      const source = `
        BUF_MODIFIED      EQU 8
        BUF_LINES         EQU 12
        INITIAL_CAPACITY  EQU 16
        BUFFER_ADDR       EQU 0x2000
        STACK_FRAME       EQU 16

        .macro PUSH_FRAME
          ADDI sp, sp, -STACK_FRAME
          SW ra, 0(sp)
          SW s0, 4(sp)
          SW s1, 8(sp)
          SW s2, 12(sp)
        .endmacro

        .macro POP_FRAME
          LW ra, 0(sp)
          LW s0, 4(sp)
          LW s1, 8(sp)
          LW s2, 12(sp)
          ADDI sp, sp, STACK_FRAME
        .endmacro

        .data
          ; a0 now contains pointer to line text
        testLine: .string "Modified"

        main:
          LUI sp, 0x3000
          LUI a0, BUFFER_ADDR>>12
          JAL ra, initBuffer

          ; Insert line (should set modified)
          ADDI a1, zero, 0
          LUI a2, 0x1000
          ADDI a2, a2, 0        ; testLine at data offset 0
        .text
          JAL ra, insertLine

          ; Check modified flag is 1
          LUI a0, BUFFER_ADDR>>12
          LW a0, BUF_MODIFIED(a0)
          ECALL

        initBuffer:
          SW zero, 0(a0)
          ADDI t0, zero, INITIAL_CAPACITY
          SW t0, 4(a0)
          SW zero, 8(a0)
          JALR zero, ra, 0

        insertLine:
          PUSH_FRAME
          ADDI s0, a0, 0
          ADDI s1, a1, 0
          ADDI s2, a2, 0
          ADDI t0, zero, BUF_LINES
          SLLI t1, s1, 2
          ADD t0, t0, t1
          ADD t0, s0, t0
          SW s2, 0(t0)
          LW t0, 0(s0)
          ADDI t0, t0, 1
          SW t0, 0(s0)
          ADDI t0, zero, 1
          SW t0, BUF_MODIFIED(s0)
          POP_FRAME
          JALR zero, ra, 0
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);

      // Data section: "Modified\0" = 9 bytes
      // Text section starts at 0x1000 + 9 = 0x1009
      cpu.pc = 0x1000 + 9;

      // Run until ECALL
      let steps = 0;
      while (cpu.pc !== 0 && steps < 10000) {
        cpu.step();
        steps++;
      }

      // Check that modified flag is 1
      expect(cpu.getReg(10)).toBe(1);
    });

    it('should handle multiple lines', () => {
      const source = `
        BUF_LINES         EQU 12
        INITIAL_CAPACITY  EQU 16
        BUFFER_ADDR       EQU 0x2000
        STACK_FRAME       EQU 16

        .macro PUSH_FRAME
          ADDI sp, sp, -STACK_FRAME
          SW ra, 0(sp)
          SW s0, 4(sp)
          SW s1, 8(sp)
          SW s2, 12(sp)
        .endmacro

        .macro POP_FRAME
          LW ra, 0(sp)
          LW s0, 4(sp)
          LW s1, 8(sp)
          LW s2, 12(sp)
          ADDI sp, sp, STACK_FRAME
        .endmacro

        .data
          ADDI a2, a2, 0        ; testLine at data offset 0
        line0: .string "First line"
        line1: .string "Second line"
        line2: .string "Third line"

        main:
          LUI sp, 0x3000
          LUI a0, BUFFER_ADDR>>12
          JAL ra, initBuffer

          ; Insert 3 lines at offsets 0, 11, 23
          ADDI a1, zero, 0
          LUI a2, 0x1000
          ADDI a2, a2, 0        ; line0 at offset 0
          JAL ra, insertLine

          LUI a0, BUFFER_ADDR>>12
          ADDI a1, zero, 1
          LUI a2, 0x1000
          ADDI a2, a2, 11       ; line1 at offset 11 (after "First line\\0")
          JAL ra, insertLine

          LUI a0, BUFFER_ADDR>>12
          ADDI a1, zero, 2
          LUI a2, 0x1000
          ADDI a2, a2, 24       ; line2 at offset 24 (after "Second line\\0")
          JAL ra, insertLine

          ; Check line count
          LUI a0, BUFFER_ADDR>>12
          LW a0, 0(a0)
          ECALL

        initBuffer:
          SW zero, 0(a0)
          ADDI t0, zero, INITIAL_CAPACITY
          SW t0, 4(a0)
          SW zero, 8(a0)
          JALR zero, ra, 0

        insertLine:
          PUSH_FRAME
          ADDI s0, a0, 0
          ADDI s1, a1, 0
          ADDI s2, a2, 0
          ADDI t0, zero, BUF_LINES
          SLLI t1, s1, 2
          ADD t0, t0, t1
          ADD t0, s0, t0
          SW s2, 0(t0)
          LW t0, 0(s0)
          ADDI t0, t0, 1
          SW t0, 0(s0)
          ADDI t0, zero, 1
          SW t0, 8(s0)
          POP_FRAME
          JALR zero, ra, 0
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);

      // Data section: "First line\0" (11) + "Second line\0" (12) + "Third line\0" (11) = 34 bytes
      // Text section starts at 0x1000 + 34 = 0x1022
      cpu.pc = 0x1000 + 34;

      // Run until ECALL
      let steps = 0;
      while (cpu.pc !== 0 && steps < 10000) {
        cpu.step();
        steps++;
      }

      // Check that line count is 3
      expect(cpu.getReg(10)).toBe(3);
    });
  });
});
