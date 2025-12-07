// Graphics Card for WireOS
// Provides text and graphics display with VRAM

// I/O Register addresses (directly in memory, not offsets)
export const VIDEO_IO = {
  // Control registers ($8050-$806F)
  VIDEO_CTRL: 0x8050,    // Mode control
  CURSOR_X: 0x8051,      // Cursor column (0-79)
  CURSOR_Y: 0x8052,      // Cursor row (0-24)
  SCROLL_Y: 0x8053,      // Smooth scroll offset
  BORDER_COLOR: 0x8054,  // Border color (0-15)
  PALETTE_IDX: 0x8055,   // Palette index to modify
  PALETTE_R: 0x8056,     // Red (0-255)
  PALETTE_G: 0x8057,     // Green (0-255)
  PALETTE_B: 0x8058,     // Blue (0-255)
  FONT_ADDR_LO: 0x8060,  // Custom font address low (0=ROM)
  FONT_ADDR_HI: 0x8061,  // Custom font address high
};

// Video control bits
export const VIDEO_CTRL_BITS = {
  DISPLAY_ENABLE: 0x01,  // Bit 0: Display enable
  GRAPHICS_MODE: 0x02,   // Bit 1: 0=text, 1=graphics
  COLUMNS_40: 0x04,      // Bit 2: 0=80 cols, 1=40 cols
  CURSOR_VISIBLE: 0x20,  // Bit 5: Cursor visible
  VBLANK: 0x80,          // Bit 7: VBlank flag (read-only)
};

// VRAM addresses
export const VRAM = {
  TEXT_CHARS: 0x8100,    // Character codes (80x25 = 2000 bytes)
  TEXT_ATTRS: 0x87D0,    // Attributes (80x25 = 2000 bytes)
  GRAPHICS: 0x8100,      // Graphics mode (160x100 @ 4bpp = 8000 bytes)
};

// Display dimensions
export const DISPLAY = {
  TEXT_COLS: 80,
  TEXT_ROWS: 25,
  TEXT_CHARS_SIZE: 2000,  // 80 * 25
  CHAR_WIDTH: 8,
  CHAR_HEIGHT: 8,
  CANVAS_WIDTH: 640,      // 80 * 8
  CANVAS_HEIGHT: 200,     // 25 * 8
  GFX_WIDTH: 160,
  GFX_HEIGHT: 100,
};

// Default CGA 16-color palette
const DEFAULT_PALETTE: [number, number, number][] = [
  [0x00, 0x00, 0x00], // 0: Black
  [0x00, 0x00, 0xAA], // 1: Blue
  [0x00, 0xAA, 0x00], // 2: Green
  [0x00, 0xAA, 0xAA], // 3: Cyan
  [0xAA, 0x00, 0x00], // 4: Red
  [0xAA, 0x00, 0xAA], // 5: Magenta
  [0xAA, 0x55, 0x00], // 6: Brown
  [0xAA, 0xAA, 0xAA], // 7: Light Gray
  [0x55, 0x55, 0x55], // 8: Dark Gray
  [0x55, 0x55, 0xFF], // 9: Light Blue
  [0x55, 0xFF, 0x55], // 10: Light Green
  [0x55, 0xFF, 0xFF], // 11: Light Cyan
  [0xFF, 0x55, 0x55], // 12: Light Red
  [0xFF, 0x55, 0xFF], // 13: Light Magenta
  [0xFF, 0xFF, 0x55], // 14: Yellow
  [0xFF, 0xFF, 0xFF], // 15: White
];

export class GraphicsCard {
  // VRAM (text chars + attrs + graphics)
  private vram: Uint8Array;

  // Control registers
  private videoCtrl = VIDEO_CTRL_BITS.DISPLAY_ENABLE | VIDEO_CTRL_BITS.CURSOR_VISIBLE;
  private cursorX = 0;
  private cursorY = 0;
  private scrollY = 0;
  private borderColor = 0;
  private paletteIdx = 0;
  private fontAddrLo = 0;
  private fontAddrHi = 0;

  // Palette (16 colors)
  private palette: [number, number, number][];

  // Cursor blink state
  private cursorBlinkOn = true;
  private lastBlinkTime = 0;

  // Dirty flag for rendering optimization
  private dirty = true;

  constructor() {
    // VRAM: text chars (2000) + attrs (2000) + padding for graphics
    this.vram = new Uint8Array(8192);

    // Initialize with spaces and default attribute (light gray on black)
    for (let i = 0; i < DISPLAY.TEXT_CHARS_SIZE; i++) {
      this.vram[i] = 0x20; // Space
      this.vram[DISPLAY.TEXT_CHARS_SIZE + i] = 0x07; // Light gray on black
    }

    // Copy default palette
    this.palette = DEFAULT_PALETTE.map(c => [...c] as [number, number, number]);
  }

  // Read from I/O register or VRAM
  read(addr: number): number {
    // I/O registers ($8050-$806F)
    if (addr >= 0x8050 && addr <= 0x806F) {
      return this.readRegister(addr);
    }

    // VRAM ($8100-$BFFF)
    if (addr >= VRAM.TEXT_CHARS && addr < VRAM.TEXT_CHARS + this.vram.length) {
      return this.vram[addr - VRAM.TEXT_CHARS];
    }

    return 0;
  }

  // Write to I/O register or VRAM
  write(addr: number, value: number): void {
    // I/O registers ($8050-$806F)
    if (addr >= 0x8050 && addr <= 0x806F) {
      this.writeRegister(addr, value);
      return;
    }

    // VRAM ($8100-$BFFF)
    if (addr >= VRAM.TEXT_CHARS && addr < VRAM.TEXT_CHARS + this.vram.length) {
      this.vram[addr - VRAM.TEXT_CHARS] = value;
      this.dirty = true;
    }
  }

  private readRegister(addr: number): number {
    switch (addr) {
      case VIDEO_IO.VIDEO_CTRL:
        return this.videoCtrl;
      case VIDEO_IO.CURSOR_X:
        return this.cursorX;
      case VIDEO_IO.CURSOR_Y:
        return this.cursorY;
      case VIDEO_IO.SCROLL_Y:
        return this.scrollY;
      case VIDEO_IO.BORDER_COLOR:
        return this.borderColor;
      case VIDEO_IO.PALETTE_IDX:
        return this.paletteIdx;
      case VIDEO_IO.PALETTE_R:
        return this.palette[this.paletteIdx]?.[0] ?? 0;
      case VIDEO_IO.PALETTE_G:
        return this.palette[this.paletteIdx]?.[1] ?? 0;
      case VIDEO_IO.PALETTE_B:
        return this.palette[this.paletteIdx]?.[2] ?? 0;
      case VIDEO_IO.FONT_ADDR_LO:
        return this.fontAddrLo;
      case VIDEO_IO.FONT_ADDR_HI:
        return this.fontAddrHi;
      default:
        return 0;
    }
  }

  private writeRegister(addr: number, value: number): void {
    this.dirty = true;

    switch (addr) {
      case VIDEO_IO.VIDEO_CTRL:
        // Preserve VBLANK bit (read-only)
        this.videoCtrl = (value & 0x7F) | (this.videoCtrl & 0x80);
        break;
      case VIDEO_IO.CURSOR_X:
        this.cursorX = value % DISPLAY.TEXT_COLS;
        break;
      case VIDEO_IO.CURSOR_Y:
        this.cursorY = value % DISPLAY.TEXT_ROWS;
        break;
      case VIDEO_IO.SCROLL_Y:
        this.scrollY = value & 0x07; // 0-7 pixels
        break;
      case VIDEO_IO.BORDER_COLOR:
        this.borderColor = value & 0x0F;
        break;
      case VIDEO_IO.PALETTE_IDX:
        this.paletteIdx = value & 0x0F;
        break;
      case VIDEO_IO.PALETTE_R:
        if (this.palette[this.paletteIdx]) {
          this.palette[this.paletteIdx][0] = value;
        }
        break;
      case VIDEO_IO.PALETTE_G:
        if (this.palette[this.paletteIdx]) {
          this.palette[this.paletteIdx][1] = value;
        }
        break;
      case VIDEO_IO.PALETTE_B:
        if (this.palette[this.paletteIdx]) {
          this.palette[this.paletteIdx][2] = value;
        }
        break;
      case VIDEO_IO.FONT_ADDR_LO:
        this.fontAddrLo = value;
        break;
      case VIDEO_IO.FONT_ADDR_HI:
        this.fontAddrHi = value;
        break;
    }
  }

  // Text mode: write character at cursor and advance
  putChar(char: number): void {
    if (char === 0x0D || char === 0x0A) {
      // Carriage return / newline
      this.cursorX = 0;
      this.cursorY++;
    } else if (char === 0x08) {
      // Backspace
      if (this.cursorX > 0) {
        this.cursorX--;
      }
    } else {
      // Write character to VRAM
      const offset = this.cursorY * DISPLAY.TEXT_COLS + this.cursorX;
      if (offset < DISPLAY.TEXT_CHARS_SIZE) {
        this.vram[offset] = char;
        this.dirty = true;
      }

      // Advance cursor
      this.cursorX++;
      if (this.cursorX >= DISPLAY.TEXT_COLS) {
        this.cursorX = 0;
        this.cursorY++;
      }
    }

    // Scroll if needed
    if (this.cursorY >= DISPLAY.TEXT_ROWS) {
      this.scrollUp();
      this.cursorY = DISPLAY.TEXT_ROWS - 1;
    }
  }

  // Scroll screen up one line
  private scrollUp(): void {
    // Move characters up
    for (let i = 0; i < DISPLAY.TEXT_CHARS_SIZE - DISPLAY.TEXT_COLS; i++) {
      this.vram[i] = this.vram[i + DISPLAY.TEXT_COLS];
      this.vram[DISPLAY.TEXT_CHARS_SIZE + i] = this.vram[DISPLAY.TEXT_CHARS_SIZE + i + DISPLAY.TEXT_COLS];
    }

    // Clear bottom line
    const lastLineStart = DISPLAY.TEXT_CHARS_SIZE - DISPLAY.TEXT_COLS;
    for (let i = 0; i < DISPLAY.TEXT_COLS; i++) {
      this.vram[lastLineStart + i] = 0x20; // Space
      this.vram[DISPLAY.TEXT_CHARS_SIZE + lastLineStart + i] = 0x07; // Default attr
    }

    this.dirty = true;
  }

  // Clear screen
  clearScreen(): void {
    for (let i = 0; i < DISPLAY.TEXT_CHARS_SIZE; i++) {
      this.vram[i] = 0x20;
      this.vram[DISPLAY.TEXT_CHARS_SIZE + i] = 0x07;
    }
    this.cursorX = 0;
    this.cursorY = 0;
    this.dirty = true;
  }

  // Get character at position
  getChar(x: number, y: number): number {
    const offset = y * DISPLAY.TEXT_COLS + x;
    return this.vram[offset] ?? 0;
  }

  // Get attribute at position
  getAttr(x: number, y: number): number {
    const offset = y * DISPLAY.TEXT_COLS + x;
    return this.vram[DISPLAY.TEXT_CHARS_SIZE + offset] ?? 0x07;
  }

  // Get color from palette
  getColor(index: number): [number, number, number] {
    return this.palette[index & 0x0F] ?? [0, 0, 0];
  }

  // Get cursor position
  getCursor(): { x: number; y: number; visible: boolean; blink: boolean } {
    // Update blink state (toggle every 500ms)
    const now = Date.now();
    if (now - this.lastBlinkTime > 500) {
      this.cursorBlinkOn = !this.cursorBlinkOn;
      this.lastBlinkTime = now;
      this.dirty = true;
    }

    return {
      x: this.cursorX,
      y: this.cursorY,
      visible: (this.videoCtrl & VIDEO_CTRL_BITS.CURSOR_VISIBLE) !== 0,
      blink: this.cursorBlinkOn,
    };
  }

  // Check if display needs redraw
  isDirty(): boolean {
    return this.dirty;
  }

  // Mark display as clean after rendering
  markClean(): void {
    this.dirty = false;
  }

  // Check if display is enabled
  isEnabled(): boolean {
    return (this.videoCtrl & VIDEO_CTRL_BITS.DISPLAY_ENABLE) !== 0;
  }

  // Check if in graphics mode
  isGraphicsMode(): boolean {
    return (this.videoCtrl & VIDEO_CTRL_BITS.GRAPHICS_MODE) !== 0;
  }

  // Get border color
  getBorderColor(): [number, number, number] {
    return this.getColor(this.borderColor);
  }

  // Get font address (0 = use ROM font)
  getFontAddress(): number {
    return this.fontAddrLo | (this.fontAddrHi << 8);
  }

  // Get VRAM for direct access (for rendering)
  getVRAM(): Uint8Array {
    return this.vram;
  }
}
