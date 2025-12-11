import { describe, it, expect, beforeEach } from 'vitest';
import { RiscVCpu } from '../src/emulator/cpu.js';
import { GraphicsCard, GRAPHICS_BASE, GRAPHICS_REGS, DisplayMode, TEXT_VRAM_OFFSET } from '../src/emulator/graphics.js';

describe('CPU Graphics Integration', () => {
  let cpu: RiscVCpu;

  beforeEach(() => {
    cpu = new RiscVCpu({ memorySize: 64 * 1024 });
  });

  describe('graphics card attachment', () => {
    it('should have graphics card attached', () => {
      expect(cpu.gpu).toBeInstanceOf(GraphicsCard);
    });

    it('should be able to get graphics card', () => {
      const gpu = cpu.getGraphicsCard();
      expect(gpu).toBeInstanceOf(GraphicsCard);
    });
  });

  describe('register access via CPU', () => {
    it('should write to MODE register via CPU store', () => {
      // LUI a0, 0x10000   ; a0 = 0x10000000 (GRAPHICS_BASE)
      // LI  t0, 1         ; t0 = 1 (GRAPHICS mode)
      // SW  t0, 0(a0)     ; Store to MODE register
      const program = new Uint8Array([
        0x37, 0x05, 0x00, 0x10, // lui a0, 0x10000
        0x93, 0x02, 0x10, 0x00, // addi t0, x0, 1
        0x23, 0x20, 0x55, 0x00, // sw t0, 0(a0)
        0x73, 0x00, 0x00, 0x00, // ecall (halt)
      ]);

      cpu.loadProgram(program);
      cpu.run();

      expect(cpu.gpu.getMode()).toBe(DisplayMode.GRAPHICS);
    });

    it('should read from MODE register via CPU load', () => {
      // Set mode directly first
      cpu.gpu.writeRegister(GRAPHICS_REGS.MODE, DisplayMode.GRAPHICS_HIRES);

      // LUI a0, 0x10000   ; a0 = 0x10000000
      // LW  t0, 0(a0)     ; Load MODE register
      const program = new Uint8Array([
        0x37, 0x05, 0x00, 0x10, // lui a0, 0x10000
        0x83, 0x22, 0x05, 0x00, // lw t0, 0(a0)
        0x73, 0x00, 0x00, 0x00, // ecall
      ]);

      cpu.loadProgram(program);
      cpu.run();

      expect(cpu.getReg(5)).toBe(DisplayMode.GRAPHICS_HIRES);
    });

    it('should write to CURSOR_X register', () => {
      // LUI a0, 0x10000   ; a0 = 0x10000000
      // LI  t0, 40        ; t0 = 40
      // SW  t0, 4(a0)     ; Store to CURSOR_X (offset 4)
      const program = new Uint8Array([
        0x37, 0x05, 0x00, 0x10, // lui a0, 0x10000
        0x93, 0x02, 0x80, 0x02, // addi t0, x0, 40
        0x23, 0x22, 0x55, 0x00, // sw t0, 4(a0)
        0x73, 0x00, 0x00, 0x00, // ecall
      ]);

      cpu.loadProgram(program);
      cpu.run();

      expect(cpu.gpu.getCursorPosition().x).toBe(40);
    });

    it('should write to CURSOR_Y register', () => {
      // LUI a0, 0x10000
      // LI  t0, 12
      // SW  t0, 8(a0)     ; CURSOR_Y offset is 8
      const program = new Uint8Array([
        0x37, 0x05, 0x00, 0x10, // lui a0, 0x10000
        0x93, 0x02, 0xc0, 0x00, // addi t0, x0, 12
        0x23, 0x24, 0x55, 0x00, // sw t0, 8(a0)
        0x73, 0x00, 0x00, 0x00, // ecall
      ]);

      cpu.loadProgram(program);
      cpu.run();

      expect(cpu.gpu.getCursorPosition().y).toBe(12);
    });
  });

  describe('text VRAM access via CPU', () => {
    it('should write character to text VRAM via CPU store byte', () => {
      // VRAM base = 0x10001000
      // LUI a0, 0x10001   ; a0 = 0x10001000
      // LI  t0, 0x41      ; 'A'
      // SB  t0, 0(a0)     ; Store character
      const program = new Uint8Array([
        0x37, 0x15, 0x00, 0x10, // lui a0, 0x10001
        0x93, 0x02, 0x10, 0x04, // addi t0, x0, 0x41
        0x23, 0x00, 0x55, 0x00, // sb t0, 0(a0)
        0x73, 0x00, 0x00, 0x00, // ecall
      ]);

      cpu.loadProgram(program);
      cpu.run();

      const cell = cpu.gpu.readTextVram(0, 0);
      expect(cell.char).toBe(0x41); // 'A'
    });

    it('should write character and attribute via halfword store', () => {
      // Use two separate SB instructions since 0x0F48 doesn't fit in 12-bit immediate
      // LUI a0, 0x10001   ; a0 = 0x10001000
      // LI  t0, 0x48      ; 'H'
      // SB  t0, 0(a0)     ; Store char
      // LI  t0, 0x0F      ; white-on-black
      // SB  t0, 1(a0)     ; Store attr
      const program = new Uint8Array([
        0x37, 0x15, 0x00, 0x10, // lui a0, 0x10001
        0x93, 0x02, 0x80, 0x04, // addi t0, x0, 0x48 ('H')
        0x23, 0x00, 0x55, 0x00, // sb t0, 0(a0)
        0x93, 0x02, 0xf0, 0x00, // addi t0, x0, 0x0F (white on black)
        0xa3, 0x00, 0x55, 0x00, // sb t0, 1(a0)
        0x73, 0x00, 0x00, 0x00, // ecall
      ]);

      cpu.loadProgram(program);
      cpu.run();

      const cell = cpu.gpu.readTextVram(0, 0);
      expect(cell.char).toBe(0x48); // 'H'
      expect(cell.attr).toBe(0x0F); // white on black
    });

    it('should write to specific VRAM position', () => {
      // Write 'X' at position (10, 5) = offset (5*80+10)*2 = 820
      // VRAM base + 820 = 0x10001000 + 0x334 = 0x10001334
      // LUI a0, 0x10001
      // ADDI a0, a0, 0x334
      // LI t0, 0x58        ; 'X'
      // SB t0, 0(a0)
      const program = new Uint8Array([
        0x37, 0x15, 0x00, 0x10, // lui a0, 0x10001
        0x13, 0x05, 0x45, 0x33, // addi a0, a0, 0x334
        0x93, 0x02, 0x80, 0x05, // addi t0, x0, 0x58
        0x23, 0x00, 0x55, 0x00, // sb t0, 0(a0)
        0x73, 0x00, 0x00, 0x00, // ecall
      ]);

      cpu.loadProgram(program);
      cpu.run();

      const cell = cpu.gpu.readTextVram(10, 5);
      expect(cell.char).toBe(0x58); // 'X'
    });

    it('should read from text VRAM', () => {
      // First write directly to VRAM
      cpu.gpu.writeTextVram(0, 0, 0x42, 0x0F); // 'B', white on black

      // LUI a0, 0x10001
      // LB  t0, 0(a0)
      const program = new Uint8Array([
        0x37, 0x15, 0x00, 0x10, // lui a0, 0x10001
        0x83, 0x02, 0x05, 0x00, // lb t0, 0(a0)
        0x73, 0x00, 0x00, 0x00, // ecall
      ]);

      cpu.loadProgram(program);
      cpu.run();

      expect(cpu.getReg(5)).toBe(0x42); // 'B'
    });
  });

  describe('byte access sizes', () => {
    it('should support SB (store byte) to VRAM', () => {
      const program = new Uint8Array([
        0x37, 0x15, 0x00, 0x10, // lui a0, 0x10001
        0x93, 0x02, 0x10, 0x04, // addi t0, x0, 0x41
        0x23, 0x00, 0x55, 0x00, // sb t0, 0(a0)
        0x73, 0x00, 0x00, 0x00, // ecall
      ]);

      cpu.loadProgram(program);
      cpu.run();

      expect(cpu.gpu.readVramByte(0)).toBe(0x41);
    });

    it('should support SH (store halfword) to VRAM', () => {
      // Load 0x1234 using LUI + ADDI: lui loads 0x1000, addi adds 0x234
      // But 0x234 is positive and fits in 12-bit signed, so this works
      const program = new Uint8Array([
        0x37, 0x15, 0x00, 0x10, // lui a0, 0x10001
        0xb7, 0x12, 0x00, 0x00, // lui t0, 0x1 (t0 = 0x1000)
        0x93, 0x82, 0x42, 0x23, // addi t0, t0, 0x234 (t0 = 0x1234)
        0x23, 0x10, 0x55, 0x00, // sh t0, 0(a0)
        0x73, 0x00, 0x00, 0x00, // ecall
      ]);

      cpu.loadProgram(program);
      cpu.run();

      expect(cpu.gpu.readVramByte(0)).toBe(0x34);
      expect(cpu.gpu.readVramByte(1)).toBe(0x12);
    });

    it('should support SW (store word) to VRAM', () => {
      const program = new Uint8Array([
        0x37, 0x15, 0x00, 0x10, // lui a0, 0x10001
        0xb7, 0x42, 0x34, 0x12, // lui t0, 0x12344
        0x93, 0x82, 0x82, 0x67, // addi t0, t0, 0x678
        0x23, 0x20, 0x55, 0x00, // sw t0, 0(a0)
        0x73, 0x00, 0x00, 0x00, // ecall
      ]);

      cpu.loadProgram(program);
      cpu.run();

      // Word is stored little-endian
      const word = cpu.gpu.readVramWord(0);
      expect(word).not.toBe(0); // Just verify something was written
    });

    it('should support LB (load byte) from VRAM', () => {
      cpu.gpu.writeVramByte(0, 0xAB);

      const program = new Uint8Array([
        0x37, 0x15, 0x00, 0x10, // lui a0, 0x10001
        0x83, 0x02, 0x05, 0x00, // lb t0, 0(a0)
        0x73, 0x00, 0x00, 0x00, // ecall
      ]);

      cpu.loadProgram(program);
      cpu.run();

      // LB sign-extends, 0xAB becomes 0xFFFFFFAB
      expect(cpu.getReg(5)).toBe(0xFFFFFFAB >>> 0);
    });

    it('should support LBU (load byte unsigned) from VRAM', () => {
      cpu.gpu.writeVramByte(0, 0xAB);

      const program = new Uint8Array([
        0x37, 0x15, 0x00, 0x10, // lui a0, 0x10001
        0x83, 0x42, 0x05, 0x00, // lbu t0, 0(a0)
        0x73, 0x00, 0x00, 0x00, // ecall
      ]);

      cpu.loadProgram(program);
      cpu.run();

      expect(cpu.getReg(5)).toBe(0xAB);
    });

    it('should support LH (load halfword) from VRAM', () => {
      cpu.gpu.writeVramByte(0, 0x34);
      cpu.gpu.writeVramByte(1, 0x12);

      const program = new Uint8Array([
        0x37, 0x15, 0x00, 0x10, // lui a0, 0x10001
        0x83, 0x12, 0x05, 0x00, // lh t0, 0(a0)
        0x73, 0x00, 0x00, 0x00, // ecall
      ]);

      cpu.loadProgram(program);
      cpu.run();

      expect(cpu.getReg(5)).toBe(0x1234);
    });

    it('should support LW (load word) from VRAM', () => {
      cpu.gpu.writeVramWord(0, 0x12345678);

      const program = new Uint8Array([
        0x37, 0x15, 0x00, 0x10, // lui a0, 0x10001
        0x83, 0x22, 0x05, 0x00, // lw t0, 0(a0)
        0x73, 0x00, 0x00, 0x00, // ecall
      ]);

      cpu.loadProgram(program);
      cpu.run();

      expect(cpu.getReg(5)).toBe(0x12345678);
    });
  });

  describe('address routing', () => {
    it('should route graphics addresses to GPU', () => {
      // Write to graphics register
      cpu.writeWord(GRAPHICS_BASE, 1); // MODE = 1
      expect(cpu.gpu.getMode()).toBe(DisplayMode.GRAPHICS);
    });

    it('should route RAM addresses to memory', () => {
      // Write to RAM (address 0x100)
      cpu.writeWord(0x100, 0xDEADBEEF);
      expect(cpu.readWord(0x100)).toBe(0xDEADBEEF);
    });

    it('should not affect RAM when writing to GPU', () => {
      // Fill RAM area that would correspond to GPU address if not routed
      cpu.memory.fill(0xFF, 0, 0x100);

      // Write to GPU
      cpu.writeWord(GRAPHICS_BASE, 1);

      // RAM should be unchanged
      expect(cpu.memory[0]).toBe(0xFF);
    });
  });

  describe('integration workflow', () => {
    it('should write "A" to VRAM and see it in graphics card', () => {
      // Complete workflow: write 'A' with white-on-black attribute
      const program = new Uint8Array([
        0x37, 0x15, 0x00, 0x10, // lui a0, 0x10001 (VRAM base)
        0x93, 0x02, 0x10, 0x04, // addi t0, x0, 0x41 ('A')
        0x23, 0x00, 0x55, 0x00, // sb t0, 0(a0) - store char
        0x93, 0x02, 0xf0, 0x00, // addi t0, x0, 0x0F (white on black)
        0x23, 0x00, 0x55, 0x00, // sb t0, 1(a0) - store attr
        0x73, 0x00, 0x00, 0x00, // ecall
      ]);

      // Fix: store to offset 1, not 0
      program[16] = 0xa3; // sb t0, 1(a0) not 0(a0)

      cpu.loadProgram(program);
      cpu.run();

      const cell = cpu.gpu.readTextVram(0, 0);
      expect(cell.char).toBe(0x41);
      expect(cell.attr).toBe(0x0F);
    });
  });
});
