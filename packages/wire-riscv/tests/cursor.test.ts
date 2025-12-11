import { describe, it, expect, beforeEach } from 'vitest';
import { GraphicsCard, GRAPHICS_REGS } from '../src/emulator/graphics.js';
import { TextRenderer, TEXT_PIXEL_HEIGHT, colorMatches } from '../src/emulator/text-renderer.js';
import { FONT_HEIGHT } from '../src/emulator/font.js';

describe('Hardware Cursor', () => {
  let gpu: GraphicsCard;
  let renderer: TextRenderer;

  beforeEach(() => {
    gpu = new GraphicsCard();
    renderer = new TextRenderer();
  });

  describe('position', () => {
    it('should set cursor to (0,0)', () => {
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_X, 0);
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_Y, 0);

      const pos = gpu.getCursorPosition();
      expect(pos.x).toBe(0);
      expect(pos.y).toBe(0);
    });

    it('should set cursor to (79,24)', () => {
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_X, 79);
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_Y, 24);

      const pos = gpu.getCursorPosition();
      expect(pos.x).toBe(79);
      expect(pos.y).toBe(24);
    });

    it('should clamp cursor X beyond bounds', () => {
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_X, 100);
      expect(gpu.getCursorPosition().x).toBe(79);

      gpu.writeRegister(GRAPHICS_REGS.CURSOR_X, -5);
      expect(gpu.getCursorPosition().x).toBe(0);
    });

    it('should clamp cursor Y beyond bounds', () => {
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_Y, 30);
      expect(gpu.getCursorPosition().y).toBe(24);

      gpu.writeRegister(GRAPHICS_REGS.CURSOR_Y, -1);
      expect(gpu.getCursorPosition().y).toBe(0);
    });

    it('should render cursor at moved position', () => {
      gpu.writeTextVram(40, 12, 0x20, 0x07); // Space, white on black
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_X, 40);
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_Y, 12);

      renderer.render(gpu, { showCursor: true, blinkState: true });

      // Check cursor renders at new position
      const startX = 40 * 8;
      const startY = 12 * FONT_HEIGHT;
      const cursorEndY = startY + gpu.getCursorEndScanline();

      const pixel = renderer.getPixel(startX, cursorEndY);
      expect(colorMatches(pixel, 7)).toBe(true); // White cursor
    });
  });

  describe('visibility', () => {
    it('should show cursor when enabled', () => {
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_CTRL, 0x01); // Enabled
      expect(gpu.isCursorEnabled()).toBe(true);
    });

    it('should hide cursor when disabled', () => {
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_CTRL, 0x00); // Disabled
      expect(gpu.isCursorEnabled()).toBe(false);
    });

    it('should toggle visibility correctly', () => {
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_CTRL, 0x01);
      expect(gpu.isCursorEnabled()).toBe(true);

      gpu.writeRegister(GRAPHICS_REGS.CURSOR_CTRL, 0x00);
      expect(gpu.isCursorEnabled()).toBe(false);

      gpu.writeRegister(GRAPHICS_REGS.CURSOR_CTRL, 0x01);
      expect(gpu.isCursorEnabled()).toBe(true);
    });

    it('should not render cursor when disabled', () => {
      gpu.writeTextVram(0, 0, 0x20, 0x07);
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_CTRL, 0x00); // Disabled

      renderer.render(gpu, { showCursor: true, blinkState: true });

      // All pixels should be black (no cursor)
      for (let y = 0; y < FONT_HEIGHT; y++) {
        const pixel = renderer.getPixel(0, y);
        expect(colorMatches(pixel, 0)).toBe(true);
      }
    });
  });

  describe('cursor shape', () => {
    it('should have default underline cursor (scanlines 14-15)', () => {
      // Default cursor should be underline style
      expect(gpu.getCursorStartScanline()).toBe(14);
      expect(gpu.getCursorEndScanline()).toBe(15);
    });

    it('should set block cursor (scanlines 0-15)', () => {
      // CURSOR_CTRL: bits 8-11 = start, bits 12-15 = end
      // Block cursor: start=0, end=15
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_CTRL, 0xF001); // end=15, start=0, enabled

      expect(gpu.getCursorStartScanline()).toBe(0);
      expect(gpu.getCursorEndScanline()).toBe(15);
    });

    it('should set half-block cursor (scanlines 8-15)', () => {
      // Half-block: start=8, end=15
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_CTRL, 0xF801); // end=15, start=8, enabled

      expect(gpu.getCursorStartScanline()).toBe(8);
      expect(gpu.getCursorEndScanline()).toBe(15);
    });

    it('should set custom scanline range (scanlines 4-10)', () => {
      // Custom: start=4, end=10
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_CTRL, 0xA401); // end=10, start=4, enabled

      expect(gpu.getCursorStartScanline()).toBe(4);
      expect(gpu.getCursorEndScanline()).toBe(10);
    });

    it('should render underline cursor correctly', () => {
      gpu.writeTextVram(0, 0, 0x20, 0x07);
      // Default underline
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_CTRL, 0xFE01); // end=15, start=14, enabled

      renderer.render(gpu, { showCursor: true, blinkState: true });

      // Scanlines 0-13 should be black (background)
      for (let y = 0; y < 14; y++) {
        const pixel = renderer.getPixel(0, y);
        expect(colorMatches(pixel, 0)).toBe(true);
      }

      // Scanlines 14-15 should be white (cursor)
      for (let y = 14; y < 16; y++) {
        const pixel = renderer.getPixel(0, y);
        expect(colorMatches(pixel, 7)).toBe(true);
      }
    });

    it('should render block cursor correctly', () => {
      gpu.writeTextVram(0, 0, 0x20, 0x07);
      // Block cursor: all scanlines
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_CTRL, 0xF001); // end=15, start=0, enabled

      renderer.render(gpu, { showCursor: true, blinkState: true });

      // All scanlines should be white (cursor covers entire cell)
      for (let y = 0; y < FONT_HEIGHT; y++) {
        const pixel = renderer.getPixel(0, y);
        expect(colorMatches(pixel, 7)).toBe(true);
      }
    });

    it('should render half-block cursor correctly', () => {
      gpu.writeTextVram(0, 0, 0x20, 0x07);
      // Half-block: bottom half
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_CTRL, 0xF801); // end=15, start=8, enabled

      renderer.render(gpu, { showCursor: true, blinkState: true });

      // Scanlines 0-7 should be black
      for (let y = 0; y < 8; y++) {
        const pixel = renderer.getPixel(0, y);
        expect(colorMatches(pixel, 0)).toBe(true);
      }

      // Scanlines 8-15 should be white
      for (let y = 8; y < 16; y++) {
        const pixel = renderer.getPixel(0, y);
        expect(colorMatches(pixel, 7)).toBe(true);
      }
    });
  });

  describe('blink', () => {
    it('should enable blink via CURSOR_CTRL', () => {
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_CTRL, 0x03); // Enabled + blink
      expect(gpu.isCursorBlinking()).toBe(true);
    });

    it('should disable blink', () => {
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_CTRL, 0x01); // Enabled, no blink
      expect(gpu.isCursorBlinking()).toBe(false);
    });

    it('should show cursor when blink is on and blinkState is true', () => {
      gpu.writeTextVram(0, 0, 0x20, 0x07);
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_CTRL, 0xFE03); // Enabled + blink + underline

      renderer.render(gpu, { showCursor: true, cursorBlink: true, blinkState: true });

      const pixel = renderer.getPixel(0, 15);
      expect(colorMatches(pixel, 7)).toBe(true); // Cursor visible
    });

    it('should hide cursor when blink is on and blinkState is false', () => {
      gpu.writeTextVram(0, 0, 0x20, 0x07);
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_CTRL, 0xFE03); // Enabled + blink + underline

      renderer.render(gpu, { showCursor: true, cursorBlink: true, blinkState: false });

      const pixel = renderer.getPixel(0, 15);
      expect(colorMatches(pixel, 0)).toBe(true); // Cursor hidden
    });

    it('should always show cursor when blink is disabled', () => {
      gpu.writeTextVram(0, 0, 0x20, 0x07);
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_CTRL, 0xFE01); // Enabled, no blink

      // Even with blinkState false, cursor should be visible
      renderer.render(gpu, { showCursor: true, cursorBlink: false, blinkState: false });

      const pixel = renderer.getPixel(0, 15);
      expect(colorMatches(pixel, 7)).toBe(true); // Cursor visible
    });

    it('should get blink rate from CURSOR_CTRL', () => {
      // Bits 4-7 = blink rate
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_CTRL, 0x51); // rate=5, enabled
      expect(gpu.getCursorBlinkRate()).toBe(5);

      gpu.writeRegister(GRAPHICS_REGS.CURSOR_CTRL, 0xF1); // rate=15, enabled
      expect(gpu.getCursorBlinkRate()).toBe(15);
    });
  });

  describe('interaction with text', () => {
    it('should render cursor over character correctly', () => {
      gpu.writeTextVram(0, 0, 0x41, 0x07); // 'A', white on black
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_CTRL, 0xFE01); // Underline, enabled

      renderer.render(gpu, { showCursor: true, blinkState: true });

      // The 'A' character should still be visible above cursor
      // Check a scanline that's part of 'A' but not cursor
      let foundWhiteInChar = false;
      for (let y = 0; y < 14; y++) {
        for (let x = 0; x < 8; x++) {
          const pixel = renderer.getPixel(x, y);
          if (colorMatches(pixel, 7)) {
            foundWhiteInChar = true;
            break;
          }
        }
        if (foundWhiteInChar) break;
      }
      expect(foundWhiteInChar).toBe(true);
    });

    it('should use correct colors for cursor', () => {
      // Yellow on blue
      gpu.writeTextVram(0, 0, 0x20, 0x1E); // Space, yellow on blue
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_CTRL, 0xFE01); // Underline

      renderer.render(gpu, { showCursor: true, blinkState: true });

      // Background (non-cursor area) should be blue
      const bgPixel = renderer.getPixel(0, 0);
      expect(colorMatches(bgPixel, 1)).toBe(true); // Blue

      // Cursor area should be yellow (inverted from blue bg)
      const cursorPixel = renderer.getPixel(0, 15);
      expect(colorMatches(cursorPixel, 14)).toBe(true); // Yellow
    });

    it('should render cursor at last visible cell', () => {
      gpu.writeTextVram(79, 24, 0x20, 0x07);
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_X, 79);
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_Y, 24);
      gpu.writeRegister(GRAPHICS_REGS.CURSOR_CTRL, 0xFE01);

      renderer.render(gpu, { showCursor: true, blinkState: true });

      const startX = 79 * 8;
      const startY = 24 * FONT_HEIGHT + 15;

      const pixel = renderer.getPixel(startX, startY);
      expect(colorMatches(pixel, 7)).toBe(true);
    });
  });
});
