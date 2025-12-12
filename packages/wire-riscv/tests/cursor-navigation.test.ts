import { describe, it, expect, beforeEach } from 'vitest';
import { RiscVCpu } from '../src/emulator/cpu.js';
import { NativeAssembler } from '../src/emulator/native-assembler.js';

describe('Cursor Navigation and Display (task-31.4)', () => {
  let cpu: RiscVCpu;
  let assembler: NativeAssembler;

  beforeEach(() => {
    cpu = new RiscVCpu(64 * 1024);
    assembler = new NativeAssembler();
  });

  const CURSOR_ADDR = 0x2100;
  const BUFFER_ADDR = 0x2000;
  const CURSOR_ROW = 0;
  const CURSOR_COL = 4;
  const CURSOR_TOP_LINE = 8;
  const CURSOR_SCREEN_ROWS = 12;

  const runUntilHalt = (maxSteps = 10000): number => {
    let steps = 0;
    while (cpu.pc !== 0 && steps < maxSteps) {
      cpu.step();
      steps++;
    }
    return steps;
  };

  describe('Cursor initialization', () => {
    it('should initialize cursor with row=0, col=0, topLine=0', () => {
      const source = `
        CURSOR_ADDR       EQU 0x2100
        CURSOR_ROW        EQU 0
        CURSOR_COL        EQU 4
        CURSOR_TOP_LINE   EQU 8
        CURSOR_SCREEN_ROWS EQU 12
        SCREEN_ROWS       EQU 24

        main:
          LUI a0, CURSOR_ADDR>>12
          ADDI t0, t0, 0x100
          ADDI a0, a0, 0x100
          JAL ra, initCursor

          ; Check row is 0
          LUI a0, CURSOR_ADDR>>12
          ADDI t0, t0, 0x100
          ADDI a0, a0, 0x100
          LW a0, CURSOR_ROW(a0)
          ECALL

        initCursor:
          SW zero, CURSOR_ROW(a0)
          SW zero, CURSOR_COL(a0)
          SW zero, CURSOR_TOP_LINE(a0)
          ADDI t0, zero, SCREEN_ROWS
          SW t0, CURSOR_SCREEN_ROWS(a0)
          JALR zero, ra, 0
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000;
      runUntilHalt();

      expect(cpu.getReg(10)).toBe(0);
    });

    it('should initialize screenRows to 24', () => {
      const source = `
        CURSOR_ADDR       EQU 0x2100
        CURSOR_SCREEN_ROWS EQU 12
        SCREEN_ROWS       EQU 24

        main:
          LUI a0, CURSOR_ADDR>>12
          ADDI t0, t0, 0x100
          ADDI a0, a0, 0x100
          JAL ra, initCursor

          ; Check screenRows is 24
          LUI a0, CURSOR_ADDR>>12
          ADDI t0, t0, 0x100
          ADDI a0, a0, 0x100
          LW a0, CURSOR_SCREEN_ROWS(a0)
          ECALL

        initCursor:
          SW zero, 0(a0)
          SW zero, 4(a0)
          SW zero, 8(a0)
          ADDI t0, zero, SCREEN_ROWS
          SW t0, CURSOR_SCREEN_ROWS(a0)
          JALR zero, ra, 0
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000;
      runUntilHalt();

      expect(cpu.getReg(10)).toBe(24);
    });
  });

  describe('Move cursor up', () => {
    it('should decrement row when row > 0', () => {
      const source = `
        CURSOR_ADDR       EQU 0x2100
        CURSOR_ROW        EQU 0
        CURSOR_TOP_LINE   EQU 8
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

        main:
          LUI sp, 0x3000

          ; Set row to 5
          LUI t0, CURSOR_ADDR>>12
          ADDI t0, t0, 0x100
          ADDI t0, t0, 0x100
          ADDI t1, zero, 5
          SW t1, CURSOR_ROW(t0)
          SW zero, CURSOR_TOP_LINE(t0)

          ; Move up
          LUI a0, CURSOR_ADDR>>12
          ADDI t0, t0, 0x100
          ADDI a0, a0, 0x100
          ADDI a1, zero, 0
          JAL ra, moveUp

          ; Check row is now 4
          LUI a0, CURSOR_ADDR>>12
          ADDI t0, t0, 0x100
          ADDI a0, a0, 0x100
          LW a0, CURSOR_ROW(a0)
          ECALL

        moveUp:
          PUSH_FRAME
          ADDI s0, a0, 0
          LW t0, CURSOR_ROW(s0)
          BEQ t0, zero, moveUp_done
          ADDI t0, t0, -1
          SW t0, CURSOR_ROW(s0)
          LW t1, CURSOR_TOP_LINE(s0)
          BLT t0, t1, moveUp_scroll
        moveUp_done:
          POP_FRAME
          JALR zero, ra, 0
        moveUp_scroll:
          BEQ t1, zero, moveUp_done
          ADDI t1, t1, -1
          SW t1, CURSOR_TOP_LINE(s0)
          JAL zero, moveUp_done
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000;
      runUntilHalt();

      expect(cpu.getReg(10)).toBe(4);
    });

    it('should not move when row = 0', () => {
      const source = `
        CURSOR_ADDR       EQU 0x2100
        CURSOR_ROW        EQU 0
        CURSOR_TOP_LINE   EQU 8
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

        main:
          LUI sp, 0x3000

          ; Set row to 0
          LUI t0, CURSOR_ADDR>>12
          ADDI t0, t0, 0x100
          SW zero, CURSOR_ROW(t0)
          SW zero, CURSOR_TOP_LINE(t0)

          ; Move up (should stay at 0)
          LUI a0, CURSOR_ADDR>>12
          ADDI t0, t0, 0x100
          ADDI a1, zero, 0
          JAL ra, moveUp

          ; Check row is still 0
          LUI a0, CURSOR_ADDR>>12
          ADDI t0, t0, 0x100
          LW a0, CURSOR_ROW(a0)
          ECALL

        moveUp:
          PUSH_FRAME
          ADDI s0, a0, 0
          LW t0, CURSOR_ROW(s0)
          BEQ t0, zero, moveUp_done
          ADDI t0, t0, -1
          SW t0, CURSOR_ROW(s0)
          LW t1, CURSOR_TOP_LINE(s0)
          BLT t0, t1, moveUp_scroll
        moveUp_done:
          POP_FRAME
          JALR zero, ra, 0
        moveUp_scroll:
          BEQ t1, zero, moveUp_done
          ADDI t1, t1, -1
          SW t1, CURSOR_TOP_LINE(s0)
          JAL zero, moveUp_done
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000;
      runUntilHalt();

      expect(cpu.getReg(10)).toBe(0);
    });

    it('should scroll up when cursor moves above topLine', () => {
      const source = `
        CURSOR_ADDR       EQU 0x2100
        CURSOR_ROW        EQU 0
        CURSOR_TOP_LINE   EQU 8
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

        main:
          LUI sp, 0x3000

          ; Set row to 10, topLine to 10
          LUI t0, CURSOR_ADDR>>12
          ADDI t0, t0, 0x100
          ADDI t1, zero, 10
          SW t1, CURSOR_ROW(t0)
          SW t1, CURSOR_TOP_LINE(t0)

          ; Move up (should scroll)
          LUI a0, CURSOR_ADDR>>12
          ADDI t0, t0, 0x100
          ADDI a1, zero, 0
          JAL ra, moveUp

          ; Check topLine is now 9
          LUI a0, CURSOR_ADDR>>12
          ADDI t0, t0, 0x100
          LW a0, CURSOR_TOP_LINE(a0)
          ECALL

        moveUp:
          PUSH_FRAME
          ADDI s0, a0, 0
          LW t0, CURSOR_ROW(s0)
          BEQ t0, zero, moveUp_done
          ADDI t0, t0, -1
          SW t0, CURSOR_ROW(s0)
          LW t1, CURSOR_TOP_LINE(s0)
          BLT t0, t1, moveUp_scroll
        moveUp_done:
          POP_FRAME
          JALR zero, ra, 0
        moveUp_scroll:
          BEQ t1, zero, moveUp_done
          ADDI t1, t1, -1
          SW t1, CURSOR_TOP_LINE(s0)
          JAL zero, moveUp_done
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000;
      runUntilHalt();

      expect(cpu.getReg(10)).toBe(9);
    });
  });

  describe('Move cursor down', () => {
    it('should increment row when row < lineCount - 1', () => {
      const source = `
        CURSOR_ADDR       EQU 0x2100
        BUFFER_ADDR       EQU 0x2000
        CURSOR_ROW        EQU 0
        CURSOR_TOP_LINE   EQU 8
        CURSOR_SCREEN_ROWS EQU 12
        BUF_LINE_COUNT    EQU 0
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

        main:
          LUI sp, 0x3000

          ; Set buffer lineCount to 10
          LUI t0, BUFFER_ADDR>>12
          ADDI t1, zero, 10
          SW t1, BUF_LINE_COUNT(t0)

          ; Set cursor row to 5, topLine to 0, screenRows to 24
          LUI t0, CURSOR_ADDR>>12
          ADDI t0, t0, 0x100
          ADDI t1, zero, 5
          SW t1, CURSOR_ROW(t0)
          SW zero, CURSOR_TOP_LINE(t0)
          ADDI t1, zero, 24
          SW t1, CURSOR_SCREEN_ROWS(t0)

          ; Move down
          LUI a0, CURSOR_ADDR>>12
          ADDI t0, t0, 0x100
          LUI a1, BUFFER_ADDR>>12
          JAL ra, moveDown

          ; Check row is now 6
          LUI a0, CURSOR_ADDR>>12
          ADDI t0, t0, 0x100
          LW a0, CURSOR_ROW(a0)
          ECALL

        moveDown:
          PUSH_FRAME
          ADDI s0, a0, 0
          ADDI s1, a1, 0
          LW t0, CURSOR_ROW(s0)
          LW t1, BUF_LINE_COUNT(s1)
          ADDI t1, t1, -1
          BGEU t0, t1, moveDown_done
          ADDI t0, t0, 1
          SW t0, CURSOR_ROW(s0)
          LW t1, CURSOR_TOP_LINE(s0)
          LW t2, CURSOR_SCREEN_ROWS(s0)
          ADD t2, t1, t2
          ADDI t2, t2, -1
          BLT t2, t0, moveDown_scroll
          JAL zero, moveDown_done
        moveDown_scroll:
          LW t1, CURSOR_TOP_LINE(s0)
          ADDI t1, t1, 1
          SW t1, CURSOR_TOP_LINE(s0)
        moveDown_done:
          POP_FRAME
          JALR zero, ra, 0
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000;
      runUntilHalt();

      expect(cpu.getReg(10)).toBe(6);
    });

    it('should not move when at last line', () => {
      const source = `
        CURSOR_ADDR       EQU 0x2100
        BUFFER_ADDR       EQU 0x2000
        CURSOR_ROW        EQU 0
        BUF_LINE_COUNT    EQU 0
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

        main:
          LUI sp, 0x3000

          ; Set buffer lineCount to 10
          LUI t0, BUFFER_ADDR>>12
          ADDI t1, zero, 10
          SW t1, BUF_LINE_COUNT(t0)

          ; Set cursor row to 9 (last line)
          LUI t0, CURSOR_ADDR>>12
          ADDI t0, t0, 0x100
          ADDI t1, zero, 9
          SW t1, CURSOR_ROW(t0)

          ; Move down (should stay at 9)
          LUI a0, CURSOR_ADDR>>12
          ADDI t0, t0, 0x100
          LUI a1, BUFFER_ADDR>>12
          JAL ra, moveDown

          ; Check row is still 9
          LUI a0, CURSOR_ADDR>>12
          ADDI t0, t0, 0x100
          LW a0, CURSOR_ROW(a0)
          ECALL

        moveDown:
          PUSH_FRAME
          ADDI s0, a0, 0
          ADDI s1, a1, 0
          LW t0, CURSOR_ROW(s0)
          LW t1, BUF_LINE_COUNT(s1)
          ADDI t1, t1, -1
          BGEU t0, t1, moveDown_done
          ADDI t0, t0, 1
          SW t0, CURSOR_ROW(s0)
          LW t1, 8(s0)
          LW t2, 12(s0)
          ADD t2, t1, t2
          ADDI t2, t2, -1
          BLT t2, t0, moveDown_scroll
          JAL zero, moveDown_done
        moveDown_scroll:
          LW t1, 8(s0)
          ADDI t1, t1, 1
          SW t1, 8(s0)
        moveDown_done:
          POP_FRAME
          JALR zero, ra, 0
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000;
      runUntilHalt();

      expect(cpu.getReg(10)).toBe(9);
    });
  });

  describe('Move cursor left', () => {
    it('should decrement column when col > 0', () => {
      const source = `
        CURSOR_ADDR   EQU 0x2100
        CURSOR_COL    EQU 4

        main:
          ; Set col to 10
          LUI t0, CURSOR_ADDR>>12
          ADDI t0, t0, 0x100
          ADDI t1, zero, 10
          SW t1, CURSOR_COL(t0)

          ; Move left
          LUI a0, CURSOR_ADDR>>12
          ADDI t0, t0, 0x100
          JAL ra, moveLeft

          ; Check col is now 9
          LW a0, CURSOR_COL(a0)
          ECALL

        moveLeft:
          LW t0, CURSOR_COL(a0)
          BEQ t0, zero, moveLeft_done
          ADDI t0, t0, -1
          SW t0, CURSOR_COL(a0)
        moveLeft_done:
          JALR zero, ra, 0
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000;
      runUntilHalt();

      expect(cpu.getReg(10)).toBe(9);
    });

    it('should not move when col = 0', () => {
      const source = `
        CURSOR_ADDR   EQU 0x2100
        CURSOR_COL    EQU 4

        main:
          ; Set col to 0
          LUI t0, CURSOR_ADDR>>12
          ADDI t0, t0, 0x100
          SW zero, CURSOR_COL(t0)

          ; Move left (should stay at 0)
          LUI a0, CURSOR_ADDR>>12
          ADDI t0, t0, 0x100
          JAL ra, moveLeft

          ; Check col is still 0
          LW a0, CURSOR_COL(a0)
          ECALL

        moveLeft:
          LW t0, CURSOR_COL(a0)
          BEQ t0, zero, moveLeft_done
          ADDI t0, t0, -1
          SW t0, CURSOR_COL(a0)
        moveLeft_done:
          JALR zero, ra, 0
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000;
      runUntilHalt();

      expect(cpu.getReg(10)).toBe(0);
    });
  });

  describe('Move cursor to Home', () => {
    it('should set column to 0', () => {
      const source = `
        CURSOR_ADDR   EQU 0x2100
        CURSOR_COL    EQU 4

        main:
          ; Set col to 42
          LUI t0, CURSOR_ADDR>>12
          ADDI t0, t0, 0x100
          ADDI t1, zero, 42
          SW t1, CURSOR_COL(t0)

          ; Move to home
          LUI a0, CURSOR_ADDR>>12
          ADDI t0, t0, 0x100
          JAL ra, moveHome

          ; Check col is now 0
          LW a0, CURSOR_COL(a0)
          ECALL

        moveHome:
          SW zero, CURSOR_COL(a0)
          JALR zero, ra, 0
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000;
      runUntilHalt();

      expect(cpu.getReg(10)).toBe(0);
    });
  });

  describe('Page Up/Down navigation', () => {
    it('should move up multiple lines on page up', () => {
      const source = `
        CURSOR_ADDR       EQU 0x2100
        CURSOR_ROW        EQU 0
        CURSOR_TOP_LINE   EQU 8
        CURSOR_SCREEN_ROWS EQU 12
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

        main:
          LUI sp, 0x3000

          ; Set row to 30, screenRows to 5, topLine to 26
          LUI t0, CURSOR_ADDR>>12
          ADDI t0, t0, 0x100
          ADDI t1, zero, 30
          SW t1, CURSOR_ROW(t0)
          ADDI t1, zero, 5
          SW t1, CURSOR_SCREEN_ROWS(t0)
          ADDI t1, zero, 26
          SW t1, CURSOR_TOP_LINE(t0)

          ; Page up (should move up 5 times)
          LUI a0, CURSOR_ADDR>>12
          ADDI t0, t0, 0x100
          ADDI a1, zero, 0
          JAL ra, pageUp

          ; Check row (should be 25)
          LUI a0, CURSOR_ADDR>>12
          ADDI t0, t0, 0x100
          LW a0, CURSOR_ROW(a0)
          ECALL

        pageUp:
          PUSH_FRAME
          ADDI s0, a0, 0
          LW t0, CURSOR_SCREEN_ROWS(s0)
          ADDI s1, t0, 0
        pageUp_loop:
          BEQ s1, zero, pageUp_done
          ADDI a0, s0, 0
          ADDI a1, a1, 0
          JAL ra, moveUp
          ADDI s1, s1, -1
          JAL zero, pageUp_loop
        pageUp_done:
          POP_FRAME
          JALR zero, ra, 0

        moveUp:
          PUSH_FRAME
          ADDI s0, a0, 0
          LW t0, CURSOR_ROW(s0)
          BEQ t0, zero, moveUp_done
          ADDI t0, t0, -1
          SW t0, CURSOR_ROW(s0)
          LW t1, CURSOR_TOP_LINE(s0)
          BLT t0, t1, moveUp_scroll
          JAL zero, moveUp_done
        moveUp_scroll:
          BEQ t1, zero, moveUp_done
          ADDI t1, t1, -1
          SW t1, CURSOR_TOP_LINE(s0)
        moveUp_done:
          POP_FRAME
          JALR zero, ra, 0
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000;
      runUntilHalt();

      expect(cpu.getReg(10)).toBe(25);
    });
  });

  describe('Display functionality', () => {
    it('should calculate string length correctly', () => {
      const source = `
        .data
        testStr: .string "Hello"

        main:
          LUI a0, 0x1000
          JAL ra, strlen
          ECALL

        strlen:
          ADDI t0, zero, 0
          ADDI t1, a0, 0
        strlen_loop:
          LBU t2, 0(t1)
          BEQ t2, zero, strlen_done
          ADDI t0, t0, 1
          ADDI t1, t1, 1
          JAL zero, strlen_loop
        strlen_done:
          ADDI a0, t0, 0
          JALR zero, ra, 0
      `;

      const binary = assembler.assemble(source);
      cpu.loadProgram(binary, 0x1000);
      cpu.pc = 0x1000 + 6; // Skip data section (6 bytes: "Hello\0")
      runUntilHalt();

      expect(cpu.getReg(10)).toBe(5);
    });
  });
});
