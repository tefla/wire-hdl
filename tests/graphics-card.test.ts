import { describe, it, expect, beforeEach } from 'vitest';
import { GraphicsCard, VIDEO_IO, VIDEO_CTRL_BITS, VRAM, DISPLAY } from '../src/web/graphics-card.js';

describe('GraphicsCard', () => {
  let gpu: GraphicsCard;

  beforeEach(() => {
    gpu = new GraphicsCard();
  });

  describe('initialization', () => {
    it('should initialize with display enabled and cursor visible', () => {
      const ctrl = gpu.read(VIDEO_IO.VIDEO_CTRL);
      expect(ctrl & VIDEO_CTRL_BITS.DISPLAY_ENABLE).toBe(VIDEO_CTRL_BITS.DISPLAY_ENABLE);
      expect(ctrl & VIDEO_CTRL_BITS.CURSOR_VISIBLE).toBe(VIDEO_CTRL_BITS.CURSOR_VISIBLE);
    });

    it('should initialize cursor at position 0,0', () => {
      expect(gpu.read(VIDEO_IO.CURSOR_X)).toBe(0);
      expect(gpu.read(VIDEO_IO.CURSOR_Y)).toBe(0);
    });

    it('should initialize text buffer with spaces', () => {
      const firstChar = gpu.read(VRAM.TEXT_CHARS);
      expect(firstChar).toBe(0x20); // Space character
    });

    it('should initialize with default attribute (light gray on black)', () => {
      // Attributes are stored at offset TEXT_CHARS_SIZE (2000) in VRAM
      // So the actual address is TEXT_CHARS + 2000 = 0x8100 + 0x7D0 = 0x88D0
      const attrAddr = VRAM.TEXT_CHARS + DISPLAY.TEXT_CHARS_SIZE;
      const firstAttr = gpu.read(attrAddr);
      expect(firstAttr).toBe(0x07); // Light gray (7) on black (0)
    });
  });

  describe('cursor control', () => {
    it('should set cursor X position', () => {
      gpu.write(VIDEO_IO.CURSOR_X, 40);
      expect(gpu.read(VIDEO_IO.CURSOR_X)).toBe(40);
    });

    it('should set cursor Y position', () => {
      gpu.write(VIDEO_IO.CURSOR_Y, 12);
      expect(gpu.read(VIDEO_IO.CURSOR_Y)).toBe(12);
    });

    it('should wrap cursor X position at 80 columns', () => {
      gpu.write(VIDEO_IO.CURSOR_X, 85);
      expect(gpu.read(VIDEO_IO.CURSOR_X)).toBe(5); // 85 % 80
    });

    it('should wrap cursor Y position at 25 rows', () => {
      gpu.write(VIDEO_IO.CURSOR_Y, 27);
      expect(gpu.read(VIDEO_IO.CURSOR_Y)).toBe(2); // 27 % 25
    });

    it('should toggle cursor visibility', () => {
      // Disable cursor
      gpu.write(VIDEO_IO.VIDEO_CTRL, VIDEO_CTRL_BITS.DISPLAY_ENABLE);
      const ctrl1 = gpu.read(VIDEO_IO.VIDEO_CTRL);
      expect(ctrl1 & VIDEO_CTRL_BITS.CURSOR_VISIBLE).toBe(0);

      // Enable cursor
      gpu.write(VIDEO_IO.VIDEO_CTRL, VIDEO_CTRL_BITS.DISPLAY_ENABLE | VIDEO_CTRL_BITS.CURSOR_VISIBLE);
      const ctrl2 = gpu.read(VIDEO_IO.VIDEO_CTRL);
      expect(ctrl2 & VIDEO_CTRL_BITS.CURSOR_VISIBLE).toBe(VIDEO_CTRL_BITS.CURSOR_VISIBLE);
    });
  });

  describe('text mode VRAM', () => {
    it('should write and read character to VRAM', () => {
      const addr = VRAM.TEXT_CHARS + 100; // Position 100
      gpu.write(addr, 0x41); // 'A'
      expect(gpu.read(addr)).toBe(0x41);
    });

    it('should write and read attribute to VRAM', () => {
      // Attributes are at TEXT_CHARS + TEXT_CHARS_SIZE + offset
      const attrBase = VRAM.TEXT_CHARS + DISPLAY.TEXT_CHARS_SIZE;
      const addr = attrBase + 100; // Attribute at position 100
      gpu.write(addr, 0x1F); // White on blue
      expect(gpu.read(addr)).toBe(0x1F);
    });

    it('should fill first row with characters', () => {
      for (let i = 0; i < DISPLAY.TEXT_COLS; i++) {
        gpu.write(VRAM.TEXT_CHARS + i, 0x30 + (i % 10)); // '0'-'9'
      }

      for (let i = 0; i < 10; i++) {
        expect(gpu.read(VRAM.TEXT_CHARS + i)).toBe(0x30 + i);
      }
    });

    it('should handle character at last position', () => {
      const lastPos = DISPLAY.TEXT_COLS * DISPLAY.TEXT_ROWS - 1;
      const addr = VRAM.TEXT_CHARS + lastPos;
      gpu.write(addr, 0x58); // 'X'
      expect(gpu.read(addr)).toBe(0x58);
    });
  });

  describe('video control', () => {
    it('should switch between 80 and 40 column modes', () => {
      // Default is 80 columns (bit 2 = 0)
      expect(gpu.read(VIDEO_IO.VIDEO_CTRL) & VIDEO_CTRL_BITS.COLUMNS_40).toBe(0);

      // Switch to 40 columns
      gpu.write(VIDEO_IO.VIDEO_CTRL, VIDEO_CTRL_BITS.DISPLAY_ENABLE | VIDEO_CTRL_BITS.COLUMNS_40);
      expect(gpu.read(VIDEO_IO.VIDEO_CTRL) & VIDEO_CTRL_BITS.COLUMNS_40).toBe(VIDEO_CTRL_BITS.COLUMNS_40);
    });

    it('should switch between text and graphics modes', () => {
      // Default is text mode (bit 1 = 0)
      expect(gpu.read(VIDEO_IO.VIDEO_CTRL) & VIDEO_CTRL_BITS.GRAPHICS_MODE).toBe(0);

      // Switch to graphics mode
      gpu.write(VIDEO_IO.VIDEO_CTRL, VIDEO_CTRL_BITS.DISPLAY_ENABLE | VIDEO_CTRL_BITS.GRAPHICS_MODE);
      expect(gpu.read(VIDEO_IO.VIDEO_CTRL) & VIDEO_CTRL_BITS.GRAPHICS_MODE).toBe(VIDEO_CTRL_BITS.GRAPHICS_MODE);
    });

    it('should preserve VBLANK bit on write (read-only)', () => {
      // VBLANK is read-only - writes should not affect it
      const originalCtrl = gpu.read(VIDEO_IO.VIDEO_CTRL);
      const vblankState = originalCtrl & VIDEO_CTRL_BITS.VBLANK;

      gpu.write(VIDEO_IO.VIDEO_CTRL, 0xFF); // Try to set all bits
      const newCtrl = gpu.read(VIDEO_IO.VIDEO_CTRL);

      // VBLANK should remain unchanged
      expect(newCtrl & VIDEO_CTRL_BITS.VBLANK).toBe(vblankState);
    });
  });

  describe('scroll control', () => {
    it('should set smooth scroll Y offset', () => {
      gpu.write(VIDEO_IO.SCROLL_Y, 5);
      expect(gpu.read(VIDEO_IO.SCROLL_Y)).toBe(5);
    });

    it('should mask scroll Y to 3 bits (0-7)', () => {
      gpu.write(VIDEO_IO.SCROLL_Y, 0xFF);
      expect(gpu.read(VIDEO_IO.SCROLL_Y)).toBe(7); // 0xFF & 0x07
    });
  });

  describe('border color', () => {
    it('should set border color', () => {
      gpu.write(VIDEO_IO.BORDER_COLOR, 4); // Red
      expect(gpu.read(VIDEO_IO.BORDER_COLOR)).toBe(4);
    });

    it('should mask border color to 4 bits (0-15)', () => {
      gpu.write(VIDEO_IO.BORDER_COLOR, 0x1F);
      expect(gpu.read(VIDEO_IO.BORDER_COLOR)).toBe(0x0F);
    });
  });

  describe('palette control', () => {
    it('should select palette index', () => {
      gpu.write(VIDEO_IO.PALETTE_IDX, 7);
      expect(gpu.read(VIDEO_IO.PALETTE_IDX)).toBe(7);
    });

    it('should mask palette index to 4 bits (0-15)', () => {
      gpu.write(VIDEO_IO.PALETTE_IDX, 0x2F);
      expect(gpu.read(VIDEO_IO.PALETTE_IDX)).toBe(0x0F);
    });

    it('should read default palette colors', () => {
      // Select color 1 (Blue)
      gpu.write(VIDEO_IO.PALETTE_IDX, 1);
      expect(gpu.read(VIDEO_IO.PALETTE_R)).toBe(0x00);
      expect(gpu.read(VIDEO_IO.PALETTE_G)).toBe(0x00);
      expect(gpu.read(VIDEO_IO.PALETTE_B)).toBe(0xAA);
    });

    it('should modify palette color', () => {
      // Select color 0 and set to pink
      gpu.write(VIDEO_IO.PALETTE_IDX, 0);
      gpu.write(VIDEO_IO.PALETTE_R, 255);
      gpu.write(VIDEO_IO.PALETTE_G, 128);
      gpu.write(VIDEO_IO.PALETTE_B, 192);

      expect(gpu.read(VIDEO_IO.PALETTE_R)).toBe(255);
      expect(gpu.read(VIDEO_IO.PALETTE_G)).toBe(128);
      expect(gpu.read(VIDEO_IO.PALETTE_B)).toBe(192);
    });

    it('should modify different palette entries independently', () => {
      // Set color 0 to red
      gpu.write(VIDEO_IO.PALETTE_IDX, 0);
      gpu.write(VIDEO_IO.PALETTE_R, 255);
      gpu.write(VIDEO_IO.PALETTE_G, 0);
      gpu.write(VIDEO_IO.PALETTE_B, 0);

      // Set color 1 to green
      gpu.write(VIDEO_IO.PALETTE_IDX, 1);
      gpu.write(VIDEO_IO.PALETTE_R, 0);
      gpu.write(VIDEO_IO.PALETTE_G, 255);
      gpu.write(VIDEO_IO.PALETTE_B, 0);

      // Verify both colors
      gpu.write(VIDEO_IO.PALETTE_IDX, 0);
      expect(gpu.read(VIDEO_IO.PALETTE_R)).toBe(255);
      expect(gpu.read(VIDEO_IO.PALETTE_G)).toBe(0);
      expect(gpu.read(VIDEO_IO.PALETTE_B)).toBe(0);

      gpu.write(VIDEO_IO.PALETTE_IDX, 1);
      expect(gpu.read(VIDEO_IO.PALETTE_R)).toBe(0);
      expect(gpu.read(VIDEO_IO.PALETTE_G)).toBe(255);
      expect(gpu.read(VIDEO_IO.PALETTE_B)).toBe(0);
    });
  });

  describe('font address control', () => {
    it('should set custom font address', () => {
      gpu.write(VIDEO_IO.FONT_ADDR_LO, 0x00);
      gpu.write(VIDEO_IO.FONT_ADDR_HI, 0xE0); // $E000

      expect(gpu.read(VIDEO_IO.FONT_ADDR_LO)).toBe(0x00);
      expect(gpu.read(VIDEO_IO.FONT_ADDR_HI)).toBe(0xE0);
    });
  });

  describe('I/O address range', () => {
    it('should return 0 for unimplemented I/O addresses', () => {
      expect(gpu.read(0x8059)).toBe(0);
      expect(gpu.read(0x805A)).toBe(0);
      expect(gpu.read(0x806F)).toBe(0);
    });

    it('should not affect unknown I/O addresses on write', () => {
      gpu.write(0x8059, 0xFF);
      expect(gpu.read(0x8059)).toBe(0);
    });
  });

  describe('VRAM bounds', () => {
    it('should return 0 for addresses outside VRAM', () => {
      expect(gpu.read(0x7FFF)).toBe(0);
      expect(gpu.read(0xC000)).toBe(0);
    });

    it('should ignore writes outside VRAM', () => {
      gpu.write(0x7FFF, 0xFF);
      expect(gpu.read(0x7FFF)).toBe(0);
    });
  });

  describe('graphics mode VRAM', () => {
    it('should write pixels in graphics mode', () => {
      // Enable graphics mode
      gpu.write(VIDEO_IO.VIDEO_CTRL, VIDEO_CTRL_BITS.DISPLAY_ENABLE | VIDEO_CTRL_BITS.GRAPHICS_MODE);

      // Write to graphics VRAM
      const addr = VRAM.GRAPHICS;
      gpu.write(addr, 0x12); // Two pixels: color 1 and color 2
      expect(gpu.read(addr)).toBe(0x12);
    });
  });

  describe('display constants', () => {
    it('should have correct display dimensions', () => {
      expect(DISPLAY.TEXT_COLS).toBe(80);
      expect(DISPLAY.TEXT_ROWS).toBe(25);
      expect(DISPLAY.TEXT_CHARS_SIZE).toBe(2000);
      expect(DISPLAY.CANVAS_WIDTH).toBe(640);
      expect(DISPLAY.CANVAS_HEIGHT).toBe(200);
      expect(DISPLAY.GFX_WIDTH).toBe(160);
      expect(DISPLAY.GFX_HEIGHT).toBe(100);
    });

    it('should have correct I/O addresses', () => {
      expect(VIDEO_IO.VIDEO_CTRL).toBe(0x8050);
      expect(VIDEO_IO.CURSOR_X).toBe(0x8051);
      expect(VIDEO_IO.CURSOR_Y).toBe(0x8052);
      expect(VRAM.TEXT_CHARS).toBe(0x8100);
      // Note: VRAM.TEXT_ATTRS constant is $87D0 but actual attr storage is at TEXT_CHARS + 2000 = $88D0
      expect(VRAM.TEXT_ATTRS).toBe(0x87D0);
    });
  });
});
