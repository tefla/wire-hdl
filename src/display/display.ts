// Text Display Renderer for Wire-HDL Computer
// 80x25 character display with 8x16 bitmap font

import { CHAR_WIDTH, CHAR_HEIGHT, getCharData } from './font.js';

export const DISPLAY_COLS = 80;
export const DISPLAY_ROWS = 25;
export const DISPLAY_WIDTH = DISPLAY_COLS * CHAR_WIDTH;
export const DISPLAY_HEIGHT = DISPLAY_ROWS * CHAR_HEIGHT;

export interface DisplayConfig {
  foreground?: string;
  background?: string;
  cursorColor?: string;
  cursorBlinkRate?: number; // ms
  scale?: number;
}

export class Display {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private videoRam: Uint8Array;

  private foreground: string;
  private background: string;
  private cursorColor: string;
  private cursorBlinkRate: number;
  private scale: number;

  private cursorX: number = 0;
  private cursorY: number = 0;
  private cursorVisible: boolean = true;
  private cursorBlinkOn: boolean = true;
  private blinkTimer: number | null = null;

  // Pre-rendered character images
  private charCache: Map<string, ImageData> = new Map();

  // Dirty tracking for efficient rendering
  private dirty: boolean[] = new Array(DISPLAY_COLS * DISPLAY_ROWS).fill(true);
  private fullRedraw: boolean = true;

  constructor(canvas: HTMLCanvasElement, videoRam: Uint8Array, config: DisplayConfig = {}) {
    this.canvas = canvas;
    this.videoRam = videoRam;

    this.foreground = config.foreground || '#00FF00';
    this.background = config.background || '#000000';
    this.cursorColor = config.cursorColor || '#00FF00';
    this.cursorBlinkRate = config.cursorBlinkRate || 500;
    this.scale = config.scale || 1;

    // Set canvas size
    this.canvas.width = DISPLAY_WIDTH * this.scale;
    this.canvas.height = DISPLAY_HEIGHT * this.scale;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('Failed to get canvas 2d context');
    }
    this.ctx = ctx;

    // Disable image smoothing for crisp pixels
    this.ctx.imageSmoothingEnabled = false;

    // Start cursor blink
    this.startCursorBlink();
  }

  /**
   * Set foreground and background colors
   */
  setColors(foreground: string, background: string): void {
    this.foreground = foreground;
    this.background = background;
    this.charCache.clear();
    this.fullRedraw = true;
  }

  /**
   * Set cursor position
   */
  setCursor(x: number, y: number): void {
    if (x !== this.cursorX || y !== this.cursorY) {
      // Mark old and new cursor positions as dirty
      this.markDirty(this.cursorX, this.cursorY);
      this.cursorX = Math.max(0, Math.min(x, DISPLAY_COLS - 1));
      this.cursorY = Math.max(0, Math.min(y, DISPLAY_ROWS - 1));
      this.markDirty(this.cursorX, this.cursorY);
    }
  }

  /**
   * Set cursor visibility
   */
  setCursorVisible(visible: boolean): void {
    this.cursorVisible = visible;
    this.markDirty(this.cursorX, this.cursorY);
  }

  /**
   * Mark a character cell as needing redraw
   */
  markDirty(x: number, y: number): void {
    if (x >= 0 && x < DISPLAY_COLS && y >= 0 && y < DISPLAY_ROWS) {
      this.dirty[y * DISPLAY_COLS + x] = true;
    }
  }

  /**
   * Mark entire screen as needing redraw
   */
  markAllDirty(): void {
    this.fullRedraw = true;
  }

  /**
   * Called when video RAM is written
   */
  onVideoWrite(offset: number, value: number): void {
    if (offset >= 0 && offset < DISPLAY_COLS * DISPLAY_ROWS) {
      this.dirty[offset] = true;
    }
  }

  /**
   * Render the display to the canvas
   */
  render(): void {
    if (this.fullRedraw) {
      // Full redraw
      this.ctx.fillStyle = this.background;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      for (let y = 0; y < DISPLAY_ROWS; y++) {
        for (let x = 0; x < DISPLAY_COLS; x++) {
          this.renderChar(x, y);
        }
      }

      this.dirty.fill(false);
      this.fullRedraw = false;
    } else {
      // Incremental update
      for (let y = 0; y < DISPLAY_ROWS; y++) {
        for (let x = 0; x < DISPLAY_COLS; x++) {
          const idx = y * DISPLAY_COLS + x;
          if (this.dirty[idx]) {
            this.renderChar(x, y);
            this.dirty[idx] = false;
          }
        }
      }
    }

    // Render cursor
    if (this.cursorVisible && this.cursorBlinkOn) {
      this.renderCursor();
    }
  }

  /**
   * Render a single character at grid position
   */
  private renderChar(gridX: number, gridY: number): void {
    const idx = gridY * DISPLAY_COLS + gridX;
    const ascii = this.videoRam[idx] || 32; // Default to space

    const screenX = gridX * CHAR_WIDTH * this.scale;
    const screenY = gridY * CHAR_HEIGHT * this.scale;

    // Clear background
    this.ctx.fillStyle = this.background;
    this.ctx.fillRect(screenX, screenY, CHAR_WIDTH * this.scale, CHAR_HEIGHT * this.scale);

    // Get character bitmap
    const charData = getCharData(ascii);

    // Draw character pixels
    this.ctx.fillStyle = this.foreground;
    for (let row = 0; row < CHAR_HEIGHT; row++) {
      const rowData = charData[row];
      for (let col = 0; col < CHAR_WIDTH; col++) {
        if (rowData & (0x80 >> col)) {
          this.ctx.fillRect(
            screenX + col * this.scale,
            screenY + row * this.scale,
            this.scale,
            this.scale
          );
        }
      }
    }
  }

  /**
   * Render the cursor
   */
  private renderCursor(): void {
    const screenX = this.cursorX * CHAR_WIDTH * this.scale;
    const screenY = this.cursorY * CHAR_HEIGHT * this.scale;

    // Draw underline cursor
    this.ctx.fillStyle = this.cursorColor;
    this.ctx.fillRect(
      screenX,
      screenY + (CHAR_HEIGHT - 2) * this.scale,
      CHAR_WIDTH * this.scale,
      2 * this.scale
    );
  }

  /**
   * Start cursor blinking
   */
  private startCursorBlink(): void {
    if (this.blinkTimer) {
      clearInterval(this.blinkTimer);
    }
    this.blinkTimer = setInterval(() => {
      this.cursorBlinkOn = !this.cursorBlinkOn;
      this.markDirty(this.cursorX, this.cursorY);
    }, this.cursorBlinkRate) as unknown as number;
  }

  /**
   * Stop cursor blinking
   */
  stopCursorBlink(): void {
    if (this.blinkTimer) {
      clearInterval(this.blinkTimer);
      this.blinkTimer = null;
    }
  }

  /**
   * Get screen content as text
   */
  getScreenText(): string {
    const lines: string[] = [];
    for (let y = 0; y < DISPLAY_ROWS; y++) {
      let line = '';
      for (let x = 0; x < DISPLAY_COLS; x++) {
        const ascii = this.videoRam[y * DISPLAY_COLS + x] || 32;
        line += String.fromCharCode(ascii);
      }
      lines.push(line.trimEnd());
    }
    // Remove trailing empty lines
    while (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }
    return lines.join('\n');
  }

  /**
   * Destroy the display (cleanup)
   */
  destroy(): void {
    this.stopCursorBlink();
  }
}
