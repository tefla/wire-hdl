/**
 * Text Mode Renderer
 *
 * Renders text VRAM to an RGBA pixel buffer using the bitmap font.
 */

import { GraphicsCard, TEXT_COLS, TEXT_ROWS } from './graphics.js';
import { FONT_WIDTH, FONT_HEIGHT, isPixelSet } from './font.js';

export const TEXT_PIXEL_WIDTH = TEXT_COLS * FONT_WIDTH;   // 80 * 8 = 640
export const TEXT_PIXEL_HEIGHT = TEXT_ROWS * FONT_HEIGHT; // 25 * 16 = 400

// CGA 16-color palette (same as in graphics.ts)
const CGA_COLORS: [number, number, number][] = [
  [0, 0, 0],       // 0: Black
  [0, 0, 170],     // 1: Blue
  [0, 170, 0],     // 2: Green
  [0, 170, 170],   // 3: Cyan
  [170, 0, 0],     // 4: Red
  [170, 0, 170],   // 5: Magenta
  [170, 85, 0],    // 6: Brown
  [170, 170, 170], // 7: Light Gray
  [85, 85, 85],    // 8: Dark Gray
  [85, 85, 255],   // 9: Light Blue
  [85, 255, 85],   // 10: Light Green
  [85, 255, 255],  // 11: Light Cyan
  [255, 85, 85],   // 12: Light Red
  [255, 85, 255],  // 13: Light Magenta
  [255, 255, 85],  // 14: Yellow
  [255, 255, 255], // 15: White
];

export interface RenderOptions {
  showCursor?: boolean;
  cursorBlink?: boolean;
  blinkState?: boolean;
}

export class TextRenderer {
  private imageData: Uint8ClampedArray;
  private cursorVisible: boolean = true;
  private blinkCounter: number = 0;

  constructor() {
    // RGBA buffer for the text display
    this.imageData = new Uint8ClampedArray(TEXT_PIXEL_WIDTH * TEXT_PIXEL_HEIGHT * 4);
  }

  /**
   * Render the text VRAM to the pixel buffer
   */
  render(gpu: GraphicsCard, options: RenderOptions = {}): Uint8ClampedArray {
    const textVram = gpu.getTextVram();
    const {
      showCursor = true,
      cursorBlink = true,
      blinkState = true,
    } = options;

    const cursorPos = gpu.getCursorPosition();
    const cursorEnabled = showCursor && gpu.isCursorEnabled();
    const cursorBlinking = cursorBlink && gpu.isCursorBlinking();
    const showCursorNow = cursorEnabled && (!cursorBlinking || blinkState);

    // Render each character cell
    for (let row = 0; row < TEXT_ROWS; row++) {
      for (let col = 0; col < TEXT_COLS; col++) {
        const vramOffset = (row * TEXT_COLS + col) * 2;
        const charCode = textVram[vramOffset];
        const attr = textVram[vramOffset + 1];

        const fgColorIndex = attr & 0x0F;
        const bgColorIndex = (attr >> 4) & 0x0F;

        const fgColor = CGA_COLORS[fgColorIndex];
        const bgColor = CGA_COLORS[bgColorIndex];

        // Check if cursor is at this position
        const isCursorCell = showCursorNow && col === cursorPos.x && row === cursorPos.y;

        this.renderChar(col, row, charCode, fgColor, bgColor, isCursorCell);
      }
    }

    return this.imageData;
  }

  /**
   * Render a single character at the given cell position
   */
  private renderChar(
    col: number,
    row: number,
    charCode: number,
    fgColor: [number, number, number],
    bgColor: [number, number, number],
    showCursor: boolean
  ): void {
    const startX = col * FONT_WIDTH;
    const startY = row * FONT_HEIGHT;

    for (let py = 0; py < FONT_HEIGHT; py++) {
      for (let px = 0; px < FONT_WIDTH; px++) {
        const pixelX = startX + px;
        const pixelY = startY + py;
        const pixelOffset = (pixelY * TEXT_PIXEL_WIDTH + pixelX) * 4;

        // Determine if this pixel is foreground or background
        let isForeground = isPixelSet(charCode, px, py);

        // Cursor: invert colors in the cursor region (typically bottom 2 scanlines)
        if (showCursor && py >= FONT_HEIGHT - 2) {
          isForeground = !isForeground;
        }

        const color = isForeground ? fgColor : bgColor;

        this.imageData[pixelOffset] = color[0];     // R
        this.imageData[pixelOffset + 1] = color[1]; // G
        this.imageData[pixelOffset + 2] = color[2]; // B
        this.imageData[pixelOffset + 3] = 255;      // A
      }
    }
  }

  /**
   * Get a single pixel from the rendered buffer
   */
  getPixel(x: number, y: number): { r: number; g: number; b: number; a: number } {
    if (x < 0 || x >= TEXT_PIXEL_WIDTH || y < 0 || y >= TEXT_PIXEL_HEIGHT) {
      return { r: 0, g: 0, b: 0, a: 0 };
    }
    const offset = (y * TEXT_PIXEL_WIDTH + x) * 4;
    return {
      r: this.imageData[offset],
      g: this.imageData[offset + 1],
      b: this.imageData[offset + 2],
      a: this.imageData[offset + 3],
    };
  }

  /**
   * Get the raw image data buffer
   */
  getImageData(): Uint8ClampedArray {
    return this.imageData;
  }

  /**
   * Get dimensions
   */
  getWidth(): number {
    return TEXT_PIXEL_WIDTH;
  }

  getHeight(): number {
    return TEXT_PIXEL_HEIGHT;
  }

  /**
   * Toggle cursor blink state (call this periodically)
   */
  tickBlink(): boolean {
    this.blinkCounter++;
    if (this.blinkCounter >= 30) { // ~500ms at 60fps
      this.blinkCounter = 0;
      this.cursorVisible = !this.cursorVisible;
    }
    return this.cursorVisible;
  }

  /**
   * Reset blink state
   */
  resetBlink(): void {
    this.blinkCounter = 0;
    this.cursorVisible = true;
  }
}

/**
 * Check if a color matches the expected CGA color
 */
export function colorMatches(
  actual: { r: number; g: number; b: number },
  colorIndex: number
): boolean {
  const expected = CGA_COLORS[colorIndex];
  return actual.r === expected[0] && actual.g === expected[1] && actual.b === expected[2];
}

/**
 * Get CGA color by index
 */
export function getCGAColor(index: number): { r: number; g: number; b: number } {
  const color = CGA_COLORS[index & 0x0F];
  return { r: color[0], g: color[1], b: color[2] };
}
