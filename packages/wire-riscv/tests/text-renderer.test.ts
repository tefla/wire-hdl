import { describe, it, expect, beforeEach } from 'vitest';
import { GraphicsCard } from '../src/emulator/graphics.js';
import { TextRenderer, TEXT_PIXEL_WIDTH, TEXT_PIXEL_HEIGHT, colorMatches, getCGAColor } from '../src/emulator/text-renderer.js';
import { FONT_WIDTH, FONT_HEIGHT, getCharBitmap, isPixelSet } from '../src/emulator/font.js';

describe('Font', () => {
  describe('getCharBitmap', () => {
    it('should return 16 bytes for any character', () => {
      const bitmap = getCharBitmap(0x41); // 'A'
      expect(bitmap.length).toBe(16);
    });

    it('should return different data for different characters', () => {
      const bitmapA = getCharBitmap(0x41);
      const bitmapB = getCharBitmap(0x42);
      let different = false;
      for (let i = 0; i < 16; i++) {
        if (bitmapA[i] !== bitmapB[i]) {
          different = true;
          break;
        }
      }
      expect(different).toBe(true);
    });

    it('should return empty bitmap for space character', () => {
      const bitmap = getCharBitmap(0x20);
      let allZero = true;
      for (let i = 0; i < 16; i++) {
        if (bitmap[i] !== 0) {
          allZero = false;
          break;
        }
      }
      expect(allZero).toBe(true);
    });

    it('should handle character codes > 127 by masking', () => {
      const bitmap128 = getCharBitmap(128);
      const bitmap0 = getCharBitmap(0);
      expect(bitmap128).toEqual(bitmap0);
    });
  });

  describe('isPixelSet', () => {
    it('should return false for space character', () => {
      for (let y = 0; y < FONT_HEIGHT; y++) {
        for (let x = 0; x < FONT_WIDTH; x++) {
          expect(isPixelSet(0x20, x, y)).toBe(false);
        }
      }
    });

    it('should return true for some pixels in letter A', () => {
      // 'A' should have some pixels set
      let foundSet = false;
      for (let y = 0; y < FONT_HEIGHT; y++) {
        for (let x = 0; x < FONT_WIDTH; x++) {
          if (isPixelSet(0x41, x, y)) {
            foundSet = true;
            break;
          }
        }
        if (foundSet) break;
      }
      expect(foundSet).toBe(true);
    });

    it('should return false for out-of-bounds coordinates', () => {
      expect(isPixelSet(0x41, -1, 0)).toBe(false);
      expect(isPixelSet(0x41, FONT_WIDTH, 0)).toBe(false);
      expect(isPixelSet(0x41, 0, -1)).toBe(false);
      expect(isPixelSet(0x41, 0, FONT_HEIGHT)).toBe(false);
    });

    it('should be consistent with getCharBitmap', () => {
      const charCode = 0x41; // 'A'
      const bitmap = getCharBitmap(charCode);

      for (let y = 0; y < FONT_HEIGHT; y++) {
        for (let x = 0; x < FONT_WIDTH; x++) {
          const expected = (bitmap[y] & (0x80 >> x)) !== 0;
          expect(isPixelSet(charCode, x, y)).toBe(expected);
        }
      }
    });
  });
});

describe('TextRenderer', () => {
  let gpu: GraphicsCard;
  let renderer: TextRenderer;

  beforeEach(() => {
    gpu = new GraphicsCard();
    renderer = new TextRenderer();
  });

  describe('dimensions', () => {
    it('should have correct width', () => {
      expect(renderer.getWidth()).toBe(TEXT_PIXEL_WIDTH);
      expect(TEXT_PIXEL_WIDTH).toBe(640); // 80 * 8
    });

    it('should have correct height', () => {
      expect(renderer.getHeight()).toBe(TEXT_PIXEL_HEIGHT);
      expect(TEXT_PIXEL_HEIGHT).toBe(400); // 25 * 16
    });

    it('should have image data of correct size', () => {
      renderer.render(gpu);
      const data = renderer.getImageData();
      expect(data.length).toBe(TEXT_PIXEL_WIDTH * TEXT_PIXEL_HEIGHT * 4);
    });
  });

  describe('character rendering', () => {
    it('should render space as background color', () => {
      // Default VRAM is filled with spaces (0x20) and white-on-black (0x07)
      renderer.render(gpu, { showCursor: false });

      // Check a pixel in the first cell (should be black background)
      const pixel = renderer.getPixel(0, 0);
      expect(colorMatches(pixel, 0)).toBe(true); // Black
    });

    it('should render character A at position 0,0', () => {
      gpu.writeTextVram(0, 0, 0x41, 0x07); // 'A', white on black
      renderer.render(gpu, { showCursor: false });

      // Find a foreground pixel in the 'A'
      let foundWhite = false;
      for (let y = 0; y < FONT_HEIGHT; y++) {
        for (let x = 0; x < FONT_WIDTH; x++) {
          if (isPixelSet(0x41, x, y)) {
            const pixel = renderer.getPixel(x, y);
            if (colorMatches(pixel, 7)) { // Light gray (white)
              foundWhite = true;
              break;
            }
          }
        }
        if (foundWhite) break;
      }
      expect(foundWhite).toBe(true);
    });

    it('should render character at position 79,24 (last cell)', () => {
      gpu.writeTextVram(79, 24, 0x5A, 0x07); // 'Z', white on black
      renderer.render(gpu, { showCursor: false });

      const startX = 79 * FONT_WIDTH;
      const startY = 24 * FONT_HEIGHT;

      // Check that some pixels are white (foreground)
      let foundWhite = false;
      for (let y = 0; y < FONT_HEIGHT; y++) {
        for (let x = 0; x < FONT_WIDTH; x++) {
          if (isPixelSet(0x5A, x, y)) {
            const pixel = renderer.getPixel(startX + x, startY + y);
            if (colorMatches(pixel, 7)) {
              foundWhite = true;
              break;
            }
          }
        }
        if (foundWhite) break;
      }
      expect(foundWhite).toBe(true);
    });
  });

  describe('color attributes', () => {
    it('should render with foreground color', () => {
      gpu.writeTextVram(0, 0, 0x41, 0x04); // 'A', red on black
      renderer.render(gpu, { showCursor: false });

      // Find a foreground pixel
      for (let y = 0; y < FONT_HEIGHT; y++) {
        for (let x = 0; x < FONT_WIDTH; x++) {
          if (isPixelSet(0x41, x, y)) {
            const pixel = renderer.getPixel(x, y);
            expect(colorMatches(pixel, 4)).toBe(true); // Red
            return;
          }
        }
      }
    });

    it('should render with background color', () => {
      gpu.writeTextVram(0, 0, 0x20, 0x40); // Space, black on red
      renderer.render(gpu, { showCursor: false });

      // All pixels should be red background
      const pixel = renderer.getPixel(0, 0);
      expect(colorMatches(pixel, 4)).toBe(true); // Red
    });

    it('should render all 16 foreground colors', () => {
      for (let i = 0; i < 16; i++) {
        gpu.writeTextVram(i, 0, 0x41, i); // 'A' with fg color i, bg black
      }
      renderer.render(gpu, { showCursor: false });

      for (let col = 0; col < 16; col++) {
        const startX = col * FONT_WIDTH;
        // Find a foreground pixel
        for (let y = 0; y < FONT_HEIGHT; y++) {
          for (let x = 0; x < FONT_WIDTH; x++) {
            if (isPixelSet(0x41, x, y)) {
              const pixel = renderer.getPixel(startX + x, y);
              expect(colorMatches(pixel, col)).toBe(true);
              break;
            }
          }
        }
      }
    });

    it('should render all 16 background colors', () => {
      for (let i = 0; i < 16; i++) {
        gpu.writeTextVram(i, 0, 0x20, i << 4); // Space with bg color i
      }
      renderer.render(gpu, { showCursor: false });

      for (let col = 0; col < 16; col++) {
        const pixel = renderer.getPixel(col * FONT_WIDTH, 0);
        expect(colorMatches(pixel, col)).toBe(true);
      }
    });

    it('should render combined fg/bg correctly', () => {
      gpu.writeTextVram(0, 0, 0x41, 0x4E); // 'A', yellow (14) on red (4)
      renderer.render(gpu, { showCursor: false });

      // Check foreground pixel
      for (let y = 0; y < FONT_HEIGHT; y++) {
        for (let x = 0; x < FONT_WIDTH; x++) {
          const pixel = renderer.getPixel(x, y);
          if (isPixelSet(0x41, x, y)) {
            expect(colorMatches(pixel, 14)).toBe(true); // Yellow
          } else {
            expect(colorMatches(pixel, 4)).toBe(true); // Red
          }
        }
      }
    });
  });

  describe('cursor rendering', () => {
    it('should render cursor at position 0,0', () => {
      gpu.writeTextVram(0, 0, 0x20, 0x07); // Space, white on black
      gpu.writeRegister(0x04, 0); // CURSOR_X = 0
      gpu.writeRegister(0x08, 0); // CURSOR_Y = 0

      renderer.render(gpu, { showCursor: true, blinkState: true });

      // Cursor should invert bottom 2 scanlines
      const cursorY = FONT_HEIGHT - 1;
      const pixel = renderer.getPixel(0, cursorY);
      // Should be inverted (white foreground where there was black)
      expect(colorMatches(pixel, 7)).toBe(true); // White
    });

    it('should hide cursor when disabled', () => {
      gpu.writeTextVram(0, 0, 0x20, 0x07);
      gpu.writeRegister(0x0C, 0); // Disable cursor

      renderer.render(gpu, { showCursor: true, blinkState: true });

      // Bottom scanline should still be black (no cursor)
      const cursorY = FONT_HEIGHT - 1;
      const pixel = renderer.getPixel(0, cursorY);
      expect(colorMatches(pixel, 0)).toBe(true); // Black
    });

    it('should hide cursor when showCursor option is false', () => {
      gpu.writeTextVram(0, 0, 0x20, 0x07);

      renderer.render(gpu, { showCursor: false });

      const cursorY = FONT_HEIGHT - 1;
      const pixel = renderer.getPixel(0, cursorY);
      expect(colorMatches(pixel, 0)).toBe(true); // Black
    });

    it('should hide cursor on blink off state', () => {
      gpu.writeTextVram(0, 0, 0x20, 0x07);
      gpu.writeRegister(0x0C, 0x03); // Enable cursor + blink

      renderer.render(gpu, { showCursor: true, cursorBlink: true, blinkState: false });

      const cursorY = FONT_HEIGHT - 1;
      const pixel = renderer.getPixel(0, cursorY);
      expect(colorMatches(pixel, 0)).toBe(true); // Black (cursor hidden)
    });

    it('should render cursor at different positions', () => {
      gpu.writeTextVram(5, 3, 0x20, 0x07);
      gpu.writeRegister(0x04, 5); // CURSOR_X = 5
      gpu.writeRegister(0x08, 3); // CURSOR_Y = 3

      renderer.render(gpu, { showCursor: true, blinkState: true });

      const startX = 5 * FONT_WIDTH;
      const startY = 3 * FONT_HEIGHT;
      const cursorY = startY + FONT_HEIGHT - 1;

      const pixel = renderer.getPixel(startX, cursorY);
      expect(colorMatches(pixel, 7)).toBe(true); // White
    });
  });

  describe('full screen rendering', () => {
    it('should fill screen with single character', () => {
      gpu.fillTextVram(0x58, 0x07); // 'X', white on black
      renderer.render(gpu, { showCursor: false });

      // Check a few cells
      const cells = [[0, 0], [40, 12], [79, 24]];
      for (const [col, row] of cells) {
        const startX = col * FONT_WIDTH;
        const startY = row * FONT_HEIGHT;

        // Verify some pixels match expected pattern
        for (let y = 0; y < FONT_HEIGHT; y++) {
          for (let x = 0; x < FONT_WIDTH; x++) {
            const pixel = renderer.getPixel(startX + x, startY + y);
            if (isPixelSet(0x58, x, y)) {
              expect(colorMatches(pixel, 7)).toBe(true);
            } else {
              expect(colorMatches(pixel, 0)).toBe(true);
            }
          }
        }
      }
    });

    it('should render alternating colors', () => {
      // Create checkerboard pattern
      for (let row = 0; row < 25; row++) {
        for (let col = 0; col < 80; col++) {
          const color = ((row + col) % 2 === 0) ? 0x01 : 0x04; // Blue or Red
          gpu.writeTextVram(col, row, 0x20, color << 4);
        }
      }

      renderer.render(gpu, { showCursor: false });

      // Verify pattern
      const pixel00 = renderer.getPixel(0, 0);
      const pixel10 = renderer.getPixel(FONT_WIDTH, 0);

      expect(colorMatches(pixel00, 1)).toBe(true); // Blue
      expect(colorMatches(pixel10, 4)).toBe(true); // Red
    });
  });

  describe('blink timing', () => {
    it('should toggle blink state', () => {
      const initialState = renderer.tickBlink();
      expect(initialState).toBe(true);

      // Tick 30 times to toggle
      for (let i = 0; i < 30; i++) {
        renderer.tickBlink();
      }

      expect(renderer.tickBlink()).toBe(false);
    });

    it('should reset blink state', () => {
      // Toggle to off
      for (let i = 0; i < 31; i++) {
        renderer.tickBlink();
      }

      renderer.resetBlink();
      expect(renderer.tickBlink()).toBe(true);
    });
  });

  describe('getPixel bounds', () => {
    it('should return zeros for out-of-bounds coordinates', () => {
      renderer.render(gpu);

      expect(renderer.getPixel(-1, 0)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
      expect(renderer.getPixel(0, -1)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
      expect(renderer.getPixel(TEXT_PIXEL_WIDTH, 0)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
      expect(renderer.getPixel(0, TEXT_PIXEL_HEIGHT)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    });
  });
});

describe('Color utilities', () => {
  it('getCGAColor should return correct colors', () => {
    expect(getCGAColor(0)).toEqual({ r: 0, g: 0, b: 0 });
    expect(getCGAColor(15)).toEqual({ r: 255, g: 255, b: 255 });
    expect(getCGAColor(4)).toEqual({ r: 170, g: 0, b: 0 });
  });

  it('getCGAColor should mask index to 0-15', () => {
    expect(getCGAColor(16)).toEqual(getCGAColor(0));
    expect(getCGAColor(255)).toEqual(getCGAColor(15));
  });
});
