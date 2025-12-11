import { describe, it, expect, beforeEach } from 'vitest';
import { GraphicsCard, DisplayMode, GRAPHICS_REGS } from '../src/emulator/graphics.js';

describe('GraphicsCard', () => {
  let gpu: GraphicsCard;

  beforeEach(() => {
    gpu = new GraphicsCard();
  });

  describe('register read/write', () => {
    it('should read/write MODE register', () => {
      expect(gpu.readRegister(GRAPHICS_REGS.MODE)).toBe(DisplayMode.TEXT);
      gpu.writeRegister(GRAPHICS_REGS.MODE, DisplayMode.GRAPHICS);
      expect(gpu.readRegister(GRAPHICS_REGS.MODE)).toBe(DisplayMode.GRAPHICS);
    });

    it('should read/write CURSOR_X register', () => {
      expect(gpu.readRegister(GRAPHICS_REGS.CURSOR_X)).toBe(0);
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_X, 40);
      expect(gpu.readRegister(GRAPHICS_REGS.CURSOR_X)).toBe(40);
    });

    it('should clamp CURSOR_X to valid range (0-79)', () => {
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_X, 100);
      expect(gpu.readRegister(GRAPHICS_REGS.CURSOR_X)).toBe(79);
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_X, -5);
      expect(gpu.readRegister(GRAPHICS_REGS.CURSOR_X)).toBe(0);
    });

    it('should read/write CURSOR_Y register', () => {
      expect(gpu.readRegister(GRAPHICS_REGS.CURSOR_Y)).toBe(0);
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_Y, 12);
      expect(gpu.readRegister(GRAPHICS_REGS.CURSOR_Y)).toBe(12);
    });

    it('should clamp CURSOR_Y to valid range (0-24)', () => {
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_Y, 50);
      expect(gpu.readRegister(GRAPHICS_REGS.CURSOR_Y)).toBe(24);
    });

    it('should read/write CURSOR_CTRL register', () => {
      expect(gpu.readRegister(GRAPHICS_REGS.CURSOR_CTRL)).toBe(0x01); // Enabled by default
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_CTRL, 0x03); // Enable + blink
      expect(gpu.readRegister(GRAPHICS_REGS.CURSOR_CTRL)).toBe(0x03);
    });

    it('should read WIDTH register (read-only in text mode)', () => {
      expect(gpu.readRegister(GRAPHICS_REGS.WIDTH)).toBe(80); // Text mode: 80 columns
    });

    it('should read HEIGHT register (read-only in text mode)', () => {
      expect(gpu.readRegister(GRAPHICS_REGS.HEIGHT)).toBe(25); // Text mode: 25 rows
    });

    it('should return WIDTH/HEIGHT in pixels for graphics mode', () => {
      gpu.writeRegister(GRAPHICS_REGS.MODE, DisplayMode.GRAPHICS);
      expect(gpu.readRegister(GRAPHICS_REGS.WIDTH)).toBe(320);
      expect(gpu.readRegister(GRAPHICS_REGS.HEIGHT)).toBe(200);
    });

    it('should read STATUS register', () => {
      const status = gpu.readRegister(GRAPHICS_REGS.STATUS);
      expect(status).toBe(0); // Idle state
    });

    it('should return 0 for invalid register addresses', () => {
      expect(gpu.readRegister(0xFF)).toBe(0);
    });
  });

  describe('text VRAM operations', () => {
    it('should write and read character at position 0,0', () => {
      gpu.writeTextVram(0, 0, 'A'.charCodeAt(0), 0x07); // 'A' with white on black
      const { char, attr } = gpu.readTextVram(0, 0);
      expect(char).toBe(0x41); // 'A'
      expect(attr).toBe(0x07); // White on black
    });

    it('should write and read character at position 79,24', () => {
      gpu.writeTextVram(79, 24, 'Z'.charCodeAt(0), 0x4E); // 'Z' with yellow on red
      const { char, attr } = gpu.readTextVram(79, 24);
      expect(char).toBe(0x5A); // 'Z'
      expect(attr).toBe(0x4E);
    });

    it('should handle byte-level VRAM access', () => {
      // Character at (0,0) is at offset 0, attribute at offset 1
      gpu.writeVramByte(0, 0x48); // 'H'
      gpu.writeVramByte(1, 0x0F); // Attribute: white on black
      expect(gpu.readVramByte(0)).toBe(0x48);
      expect(gpu.readVramByte(1)).toBe(0x0F);
    });

    it('should handle word-level VRAM access', () => {
      gpu.writeVramWord(0, 0x07410742); // Two characters: 'A' and 'B' with attributes
      expect(gpu.readVramWord(0)).toBe(0x07410742);
    });

    it('should calculate correct VRAM offset for position', () => {
      // Position (x, y) should map to offset (y * 80 + x) * 2
      gpu.writeTextVram(5, 3, 'X'.charCodeAt(0), 0x07);
      const offset = (3 * 80 + 5) * 2;
      expect(gpu.readVramByte(offset)).toBe(0x58); // 'X'
    });

    it('should clamp out-of-bounds VRAM writes', () => {
      // Should not crash on out-of-bounds access
      gpu.writeTextVram(100, 100, 0x00, 0x00);
      const { char, attr } = gpu.readTextVram(100, 100);
      expect(char).toBe(0);
      expect(attr).toBe(0);
    });

    it('should fill screen with character', () => {
      gpu.fillTextVram(' '.charCodeAt(0), 0x07);
      for (let y = 0; y < 25; y++) {
        for (let x = 0; x < 80; x++) {
          const { char, attr } = gpu.readTextVram(x, y);
          expect(char).toBe(0x20); // Space
          expect(attr).toBe(0x07);
        }
      }
    });
  });

  describe('framebuffer operations', () => {
    beforeEach(() => {
      gpu.writeRegister(GRAPHICS_REGS.MODE, DisplayMode.GRAPHICS);
    });

    it('should set and get pixel at (0,0)', () => {
      gpu.setPixel(0, 0, 15);
      expect(gpu.getPixel(0, 0)).toBe(15);
    });

    it('should set and get pixel at (319,199) in 320x200 mode', () => {
      gpu.setPixel(319, 199, 255);
      expect(gpu.getPixel(319, 199)).toBe(255);
    });

    it('should calculate correct framebuffer offset', () => {
      // Pixel (x, y) maps to offset y * width + x
      gpu.setPixel(10, 5, 42);
      const offset = 5 * 320 + 10;
      expect(gpu.readFramebufferByte(offset)).toBe(42);
    });

    it('should return 0 for out-of-bounds pixel read', () => {
      expect(gpu.getPixel(400, 300)).toBe(0);
    });

    it('should ignore out-of-bounds pixel write', () => {
      gpu.setPixel(400, 300, 255); // Should not crash
    });

    it('should fill framebuffer with color', () => {
      gpu.fillFramebuffer(100);
      expect(gpu.getPixel(0, 0)).toBe(100);
      expect(gpu.getPixel(319, 199)).toBe(100);
      expect(gpu.getPixel(160, 100)).toBe(100);
    });

    it('should support byte-level framebuffer access', () => {
      gpu.writeFramebufferByte(1000, 77);
      expect(gpu.readFramebufferByte(1000)).toBe(77);
    });
  });

  describe('palette operations', () => {
    it('should read default VGA palette', () => {
      const black = gpu.getPaletteEntry(0);
      expect(black).toEqual({ r: 0, g: 0, b: 0 });

      const white = gpu.getPaletteEntry(15);
      expect(white).toEqual({ r: 255, g: 255, b: 255 });
    });

    it('should set and get palette entry', () => {
      gpu.setPaletteEntry(100, 128, 64, 32);
      const color = gpu.getPaletteEntry(100);
      expect(color).toEqual({ r: 128, g: 64, b: 32 });
    });

    it('should clamp palette values to 0-255', () => {
      gpu.setPaletteEntry(0, 300, -50, 128);
      const color = gpu.getPaletteEntry(0);
      expect(color.r).toBe(255);
      expect(color.g).toBe(0);
      expect(color.b).toBe(128);
    });

    it('should support all 256 palette entries', () => {
      for (let i = 0; i < 256; i++) {
        gpu.setPaletteEntry(i, i, 255 - i, i / 2);
      }
      for (let i = 0; i < 256; i++) {
        const color = gpu.getPaletteEntry(i);
        expect(color.r).toBe(i);
        expect(color.g).toBe(255 - i);
        expect(color.b).toBe(Math.floor(i / 2));
      }
    });

    it('should read/write palette via memory-mapped registers', () => {
      // Palette at offset 0x2000
      gpu.writePaletteByte(0, 128); // R of entry 0
      gpu.writePaletteByte(1, 64);  // G of entry 0
      gpu.writePaletteByte(2, 32);  // B of entry 0

      const color = gpu.getPaletteEntry(0);
      expect(color).toEqual({ r: 128, g: 64, b: 32 });
    });
  });

  describe('CGA text mode colors', () => {
    it('should have correct CGA palette', () => {
      // Test the 16 CGA colors
      const cgaColors = [
        { r: 0, g: 0, b: 0 },       // 0: Black
        { r: 0, g: 0, b: 170 },     // 1: Blue
        { r: 0, g: 170, b: 0 },     // 2: Green
        { r: 0, g: 170, b: 170 },   // 3: Cyan
        { r: 170, g: 0, b: 0 },     // 4: Red
        { r: 170, g: 0, b: 170 },   // 5: Magenta
        { r: 170, g: 85, b: 0 },    // 6: Brown
        { r: 170, g: 170, b: 170 }, // 7: Light Gray
        { r: 85, g: 85, b: 85 },    // 8: Dark Gray
        { r: 85, g: 85, b: 255 },   // 9: Light Blue
        { r: 85, g: 255, b: 85 },   // 10: Light Green
        { r: 85, g: 255, b: 255 },  // 11: Light Cyan
        { r: 255, g: 85, b: 85 },   // 12: Light Red
        { r: 255, g: 85, b: 255 },  // 13: Light Magenta
        { r: 255, g: 255, b: 85 },  // 14: Yellow
        { r: 255, g: 255, b: 255 }, // 15: White
      ];

      for (let i = 0; i < 16; i++) {
        const color = gpu.getPaletteEntry(i);
        expect(color).toEqual(cgaColors[i]);
      }
    });
  });

  describe('resolution switching', () => {
    it('should support 320x200 graphics mode', () => {
      gpu.writeRegister(GRAPHICS_REGS.MODE, DisplayMode.GRAPHICS);
      expect(gpu.readRegister(GRAPHICS_REGS.WIDTH)).toBe(320);
      expect(gpu.readRegister(GRAPHICS_REGS.HEIGHT)).toBe(200);
    });

    it('should switch to 640x480 graphics mode', () => {
      gpu.writeRegister(GRAPHICS_REGS.MODE, DisplayMode.GRAPHICS_HIRES);
      expect(gpu.readRegister(GRAPHICS_REGS.WIDTH)).toBe(640);
      expect(gpu.readRegister(GRAPHICS_REGS.HEIGHT)).toBe(480);
    });

    it('should switch back to text mode', () => {
      gpu.writeRegister(GRAPHICS_REGS.MODE, DisplayMode.GRAPHICS);
      gpu.writeRegister(GRAPHICS_REGS.MODE, DisplayMode.TEXT);
      expect(gpu.readRegister(GRAPHICS_REGS.WIDTH)).toBe(80);
      expect(gpu.readRegister(GRAPHICS_REGS.HEIGHT)).toBe(25);
    });
  });

  describe('memory-mapped I/O integration', () => {
    it('should handle read at base address', () => {
      const value = gpu.mmioRead(0x10000000);
      expect(value).toBe(DisplayMode.TEXT);
    });

    it('should handle write at base address', () => {
      gpu.mmioWrite(0x10000000, DisplayMode.GRAPHICS);
      expect(gpu.readRegister(GRAPHICS_REGS.MODE)).toBe(DisplayMode.GRAPHICS);
    });

    it('should route VRAM reads correctly', () => {
      gpu.writeTextVram(0, 0, 0x41, 0x07);
      gpu.writeTextVram(1, 0, 0x42, 0x0F); // Write second char to get predictable bytes
      // VRAM starts at 0x10001000
      // Byte order: char0=0x41, attr0=0x07, char1=0x42, attr1=0x0F
      expect(gpu.mmioRead(0x10001000)).toBe(0x0F420741); // Word read (little-endian)
    });

    it('should route VRAM writes correctly', () => {
      // Write 'H' at position 0
      gpu.mmioWriteByte(0x10001000, 0x48);
      gpu.mmioWriteByte(0x10001001, 0x07);
      const { char, attr } = gpu.readTextVram(0, 0);
      expect(char).toBe(0x48);
      expect(attr).toBe(0x07);
    });

    it('should route framebuffer reads correctly', () => {
      gpu.writeRegister(GRAPHICS_REGS.MODE, DisplayMode.GRAPHICS);
      gpu.setPixel(0, 0, 42);
      // Framebuffer starts at 0x10010000
      expect(gpu.mmioReadByte(0x10010000)).toBe(42);
    });

    it('should route framebuffer writes correctly', () => {
      gpu.writeRegister(GRAPHICS_REGS.MODE, DisplayMode.GRAPHICS);
      gpu.mmioWriteByte(0x10010000, 77);
      expect(gpu.getPixel(0, 0)).toBe(77);
    });

    it('should return 0 for reads outside mapped region', () => {
      expect(gpu.mmioRead(0x20000000)).toBe(0);
    });

    it('should check if address is in graphics range', () => {
      expect(gpu.isInRange(0x10000000)).toBe(true);
      expect(gpu.isInRange(0x10001000)).toBe(true);
      expect(gpu.isInRange(0x10010000)).toBe(true);
      expect(gpu.isInRange(0x00000000)).toBe(false);
      expect(gpu.isInRange(0x20000000)).toBe(false);
    });
  });

  describe('byte/halfword/word access', () => {
    it('should support byte reads from registers', () => {
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_X, 0x12);
      expect(gpu.mmioReadByte(0x10000004)).toBe(0x12);
    });

    it('should support byte writes to registers', () => {
      gpu.mmioWriteByte(0x10000004, 0x20);
      expect(gpu.readRegister(GRAPHICS_REGS.CURSOR_X)).toBe(0x20);
    });

    it('should support halfword reads from registers', () => {
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_X, 50);
      expect(gpu.mmioReadHalfword(0x10000004)).toBe(50);
    });

    it('should support halfword writes to registers', () => {
      gpu.mmioWriteHalfword(0x10000004, 0x30);
      expect(gpu.readRegister(GRAPHICS_REGS.CURSOR_X)).toBe(0x30);
    });
  });

  describe('dirty tracking', () => {
    it('should mark region dirty on text VRAM write', () => {
      expect(gpu.isDirty()).toBe(false);
      gpu.writeTextVram(0, 0, 'A'.charCodeAt(0), 0x07);
      expect(gpu.isDirty()).toBe(true);
    });

    it('should mark region dirty on framebuffer write', () => {
      gpu.writeRegister(GRAPHICS_REGS.MODE, DisplayMode.GRAPHICS);
      gpu.clearDirty();
      expect(gpu.isDirty()).toBe(false);
      gpu.setPixel(10, 10, 5);
      expect(gpu.isDirty()).toBe(true);
    });

    it('should clear dirty flag', () => {
      gpu.writeTextVram(0, 0, 'A'.charCodeAt(0), 0x07);
      gpu.clearDirty();
      expect(gpu.isDirty()).toBe(false);
    });
  });
});
