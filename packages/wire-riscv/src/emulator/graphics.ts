/**
 * RISC-V Graphics Card
 *
 * Memory-mapped graphics card with text and graphics modes.
 *
 * Memory Map:
 * - 0x10000000 - 0x100000FF: Control registers
 * - 0x10001000 - 0x10001F9F: Text VRAM (80*25*2 = 4000 bytes)
 * - 0x10002000 - 0x100023FF: Palette (256 * 4 = 1024 bytes)
 * - 0x10010000 - 0x1005AFFF: Framebuffer (640*480 = 307200 bytes max)
 */

export const GRAPHICS_BASE = 0x10000000;
export const GRAPHICS_REGS_SIZE = 0x100;
export const TEXT_VRAM_OFFSET = 0x1000;
export const PALETTE_OFFSET = 0x2000;
export const FRAMEBUFFER_OFFSET = 0x10000;

export const TEXT_COLS = 80;
export const TEXT_ROWS = 25;
export const TEXT_VRAM_SIZE = TEXT_COLS * TEXT_ROWS * 2; // char + attr per cell

export const PALETTE_ENTRIES = 256;
export const PALETTE_SIZE = PALETTE_ENTRIES * 4; // RGBA per entry

export const GRAPHICS_REGS = {
  MODE: 0x00,
  CURSOR_X: 0x04,
  CURSOR_Y: 0x08,
  CURSOR_CTRL: 0x0C,
  WIDTH: 0x10,
  HEIGHT: 0x14,
  STATUS: 0x18,
} as const;

export enum DisplayMode {
  TEXT = 0,
  GRAPHICS = 1,        // 320x200
  GRAPHICS_HIRES = 2,  // 640x480
}

export interface PaletteEntry {
  r: number;
  g: number;
  b: number;
}

// CGA 16-color palette
const CGA_PALETTE: PaletteEntry[] = [
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

export class GraphicsCard {
  // Control registers
  private mode: DisplayMode = DisplayMode.TEXT;
  private cursorX: number = 0;
  private cursorY: number = 0;
  // CURSOR_CTRL: bit 0=enable, bit 1=blink, bits 4-7=blink rate, bits 8-11=start scanline, bits 12-15=end scanline
  // Default: enabled, no blink, underline (scanlines 14-15)
  private cursorCtrl: number = 0xFE01; // end=15, start=14, enabled
  private status: number = 0;

  // Memory regions
  private textVram: Uint8Array;
  private framebuffer: Uint8Array;
  private palette: Uint8Array;

  // Dirty tracking
  private dirty: boolean = false;

  // Resolution
  private readonly resolutions = {
    [DisplayMode.TEXT]: { width: TEXT_COLS, height: TEXT_ROWS },
    [DisplayMode.GRAPHICS]: { width: 320, height: 200 },
    [DisplayMode.GRAPHICS_HIRES]: { width: 640, height: 480 },
  };

  constructor() {
    this.textVram = new Uint8Array(TEXT_VRAM_SIZE);
    this.framebuffer = new Uint8Array(640 * 480); // Max resolution
    this.palette = new Uint8Array(PALETTE_SIZE);

    // Initialize default palette (CGA colors + grayscale ramp)
    this.initPalette();

    // Clear text VRAM with spaces
    this.fillTextVram(0x20, 0x07); // Space, white on black

    // Clear dirty flag after initialization
    this.dirty = false;
  }

  private initPalette(): void {
    // Set CGA colors (0-15)
    for (let i = 0; i < 16; i++) {
      const color = CGA_PALETTE[i];
      this.setPaletteEntry(i, color.r, color.g, color.b);
    }

    // Fill remaining entries with grayscale ramp
    for (let i = 16; i < 256; i++) {
      const gray = Math.floor((i - 16) * 255 / 239);
      this.setPaletteEntry(i, gray, gray, gray);
    }
  }

  // Register access

  readRegister(offset: number): number {
    switch (offset) {
      case GRAPHICS_REGS.MODE:
        return this.mode;
      case GRAPHICS_REGS.CURSOR_X:
        return this.cursorX;
      case GRAPHICS_REGS.CURSOR_Y:
        return this.cursorY;
      case GRAPHICS_REGS.CURSOR_CTRL:
        return this.cursorCtrl;
      case GRAPHICS_REGS.WIDTH:
        return this.resolutions[this.mode].width;
      case GRAPHICS_REGS.HEIGHT:
        return this.resolutions[this.mode].height;
      case GRAPHICS_REGS.STATUS:
        return this.status;
      default:
        return 0;
    }
  }

  writeRegister(offset: number, value: number): void {
    switch (offset) {
      case GRAPHICS_REGS.MODE:
        if (value >= 0 && value <= 2) {
          this.mode = value as DisplayMode;
          this.dirty = true;
        }
        break;
      case GRAPHICS_REGS.CURSOR_X:
        this.cursorX = Math.max(0, Math.min(TEXT_COLS - 1, value));
        break;
      case GRAPHICS_REGS.CURSOR_Y:
        this.cursorY = Math.max(0, Math.min(TEXT_ROWS - 1, value));
        break;
      case GRAPHICS_REGS.CURSOR_CTRL:
        this.cursorCtrl = value & 0xFFFF;
        break;
      // WIDTH, HEIGHT, STATUS are read-only
    }
  }

  // Text VRAM access

  writeTextVram(x: number, y: number, char: number, attr: number): void {
    if (x < 0 || x >= TEXT_COLS || y < 0 || y >= TEXT_ROWS) {
      return;
    }
    const offset = (y * TEXT_COLS + x) * 2;
    this.textVram[offset] = char & 0xFF;
    this.textVram[offset + 1] = attr & 0xFF;
    this.dirty = true;
  }

  readTextVram(x: number, y: number): { char: number; attr: number } {
    if (x < 0 || x >= TEXT_COLS || y < 0 || y >= TEXT_ROWS) {
      return { char: 0, attr: 0 };
    }
    const offset = (y * TEXT_COLS + x) * 2;
    return {
      char: this.textVram[offset],
      attr: this.textVram[offset + 1],
    };
  }

  writeVramByte(offset: number, value: number): void {
    if (offset >= 0 && offset < TEXT_VRAM_SIZE) {
      this.textVram[offset] = value & 0xFF;
      this.dirty = true;
    }
  }

  readVramByte(offset: number): number {
    if (offset >= 0 && offset < TEXT_VRAM_SIZE) {
      return this.textVram[offset];
    }
    return 0;
  }

  writeVramWord(offset: number, value: number): void {
    if (offset >= 0 && offset + 3 < TEXT_VRAM_SIZE) {
      this.textVram[offset] = value & 0xFF;
      this.textVram[offset + 1] = (value >> 8) & 0xFF;
      this.textVram[offset + 2] = (value >> 16) & 0xFF;
      this.textVram[offset + 3] = (value >> 24) & 0xFF;
      this.dirty = true;
    }
  }

  readVramWord(offset: number): number {
    if (offset >= 0 && offset + 3 < TEXT_VRAM_SIZE) {
      return (
        this.textVram[offset] |
        (this.textVram[offset + 1] << 8) |
        (this.textVram[offset + 2] << 16) |
        (this.textVram[offset + 3] << 24)
      ) >>> 0;
    }
    return 0;
  }

  fillTextVram(char: number, attr: number): void {
    for (let i = 0; i < TEXT_VRAM_SIZE; i += 2) {
      this.textVram[i] = char & 0xFF;
      this.textVram[i + 1] = attr & 0xFF;
    }
    this.dirty = true;
  }

  // Framebuffer access

  setPixel(x: number, y: number, colorIndex: number): void {
    const res = this.resolutions[this.mode];
    if (x < 0 || x >= res.width || y < 0 || y >= res.height) {
      return;
    }
    const offset = y * res.width + x;
    this.framebuffer[offset] = colorIndex & 0xFF;
    this.dirty = true;
  }

  getPixel(x: number, y: number): number {
    const res = this.resolutions[this.mode];
    if (x < 0 || x >= res.width || y < 0 || y >= res.height) {
      return 0;
    }
    const offset = y * res.width + x;
    return this.framebuffer[offset];
  }

  writeFramebufferByte(offset: number, value: number): void {
    const maxSize = this.resolutions[this.mode].width * this.resolutions[this.mode].height;
    if (offset >= 0 && offset < maxSize) {
      this.framebuffer[offset] = value & 0xFF;
      this.dirty = true;
    }
  }

  readFramebufferByte(offset: number): number {
    const maxSize = this.resolutions[this.mode].width * this.resolutions[this.mode].height;
    if (offset >= 0 && offset < maxSize) {
      return this.framebuffer[offset];
    }
    return 0;
  }

  fillFramebuffer(colorIndex: number): void {
    const res = this.resolutions[this.mode];
    const size = res.width * res.height;
    for (let i = 0; i < size; i++) {
      this.framebuffer[i] = colorIndex & 0xFF;
    }
    this.dirty = true;
  }

  // Palette access

  setPaletteEntry(index: number, r: number, g: number, b: number): void {
    if (index < 0 || index >= PALETTE_ENTRIES) return;
    const offset = index * 4;
    this.palette[offset] = Math.max(0, Math.min(255, r));
    this.palette[offset + 1] = Math.max(0, Math.min(255, g));
    this.palette[offset + 2] = Math.max(0, Math.min(255, b));
    this.palette[offset + 3] = 255; // Alpha always 255
  }

  getPaletteEntry(index: number): PaletteEntry {
    if (index < 0 || index >= PALETTE_ENTRIES) {
      return { r: 0, g: 0, b: 0 };
    }
    const offset = index * 4;
    return {
      r: this.palette[offset],
      g: this.palette[offset + 1],
      b: this.palette[offset + 2],
    };
  }

  writePaletteByte(offset: number, value: number): void {
    if (offset >= 0 && offset < PALETTE_SIZE) {
      this.palette[offset] = value & 0xFF;
    }
  }

  readPaletteByte(offset: number): number {
    if (offset >= 0 && offset < PALETTE_SIZE) {
      return this.palette[offset];
    }
    return 0;
  }

  // Memory-mapped I/O

  isInRange(address: number): boolean {
    const offset = address - GRAPHICS_BASE;
    // Check if in any of our memory regions
    if (offset >= 0 && offset < GRAPHICS_REGS_SIZE) return true;
    if (offset >= TEXT_VRAM_OFFSET && offset < TEXT_VRAM_OFFSET + TEXT_VRAM_SIZE) return true;
    if (offset >= PALETTE_OFFSET && offset < PALETTE_OFFSET + PALETTE_SIZE) return true;
    if (offset >= FRAMEBUFFER_OFFSET && offset < FRAMEBUFFER_OFFSET + 640 * 480) return true;
    return false;
  }

  mmioRead(address: number): number {
    const offset = address - GRAPHICS_BASE;

    // Registers
    if (offset >= 0 && offset < GRAPHICS_REGS_SIZE) {
      const regOffset = offset & ~0x3; // Align to 4 bytes
      return this.readRegister(regOffset);
    }

    // Text VRAM
    if (offset >= TEXT_VRAM_OFFSET && offset < TEXT_VRAM_OFFSET + TEXT_VRAM_SIZE) {
      const vramOffset = offset - TEXT_VRAM_OFFSET;
      return this.readVramWord(vramOffset & ~0x3);
    }

    // Palette
    if (offset >= PALETTE_OFFSET && offset < PALETTE_OFFSET + PALETTE_SIZE) {
      const palOffset = offset - PALETTE_OFFSET;
      return (
        this.palette[palOffset] |
        (this.palette[palOffset + 1] << 8) |
        (this.palette[palOffset + 2] << 16) |
        (this.palette[palOffset + 3] << 24)
      ) >>> 0;
    }

    // Framebuffer
    if (offset >= FRAMEBUFFER_OFFSET) {
      const fbOffset = offset - FRAMEBUFFER_OFFSET;
      return (
        this.framebuffer[fbOffset] |
        (this.framebuffer[fbOffset + 1] << 8) |
        (this.framebuffer[fbOffset + 2] << 16) |
        (this.framebuffer[fbOffset + 3] << 24)
      ) >>> 0;
    }

    return 0;
  }

  mmioWrite(address: number, value: number): void {
    const offset = address - GRAPHICS_BASE;

    // Registers
    if (offset >= 0 && offset < GRAPHICS_REGS_SIZE) {
      const regOffset = offset & ~0x3;
      this.writeRegister(regOffset, value);
      return;
    }

    // Text VRAM
    if (offset >= TEXT_VRAM_OFFSET && offset < TEXT_VRAM_OFFSET + TEXT_VRAM_SIZE) {
      const vramOffset = offset - TEXT_VRAM_OFFSET;
      this.writeVramWord(vramOffset & ~0x3, value);
      return;
    }

    // Palette
    if (offset >= PALETTE_OFFSET && offset < PALETTE_OFFSET + PALETTE_SIZE) {
      const palOffset = offset - PALETTE_OFFSET;
      this.palette[palOffset] = value & 0xFF;
      this.palette[palOffset + 1] = (value >> 8) & 0xFF;
      this.palette[palOffset + 2] = (value >> 16) & 0xFF;
      this.palette[palOffset + 3] = (value >> 24) & 0xFF;
      return;
    }

    // Framebuffer
    if (offset >= FRAMEBUFFER_OFFSET) {
      const fbOffset = offset - FRAMEBUFFER_OFFSET;
      this.framebuffer[fbOffset] = value & 0xFF;
      this.framebuffer[fbOffset + 1] = (value >> 8) & 0xFF;
      this.framebuffer[fbOffset + 2] = (value >> 16) & 0xFF;
      this.framebuffer[fbOffset + 3] = (value >> 24) & 0xFF;
      this.dirty = true;
    }
  }

  mmioReadByte(address: number): number {
    const offset = address - GRAPHICS_BASE;

    // Registers
    if (offset >= 0 && offset < GRAPHICS_REGS_SIZE) {
      const regOffset = offset & ~0x3;
      const byteOffset = offset & 0x3;
      const value = this.readRegister(regOffset);
      return (value >> (byteOffset * 8)) & 0xFF;
    }

    // Text VRAM
    if (offset >= TEXT_VRAM_OFFSET && offset < TEXT_VRAM_OFFSET + TEXT_VRAM_SIZE) {
      return this.readVramByte(offset - TEXT_VRAM_OFFSET);
    }

    // Palette
    if (offset >= PALETTE_OFFSET && offset < PALETTE_OFFSET + PALETTE_SIZE) {
      return this.readPaletteByte(offset - PALETTE_OFFSET);
    }

    // Framebuffer
    if (offset >= FRAMEBUFFER_OFFSET) {
      return this.readFramebufferByte(offset - FRAMEBUFFER_OFFSET);
    }

    return 0;
  }

  mmioWriteByte(address: number, value: number): void {
    const offset = address - GRAPHICS_BASE;

    // Registers
    if (offset >= 0 && offset < GRAPHICS_REGS_SIZE) {
      const regOffset = offset & ~0x3;
      this.writeRegister(regOffset, value & 0xFF);
      return;
    }

    // Text VRAM
    if (offset >= TEXT_VRAM_OFFSET && offset < TEXT_VRAM_OFFSET + TEXT_VRAM_SIZE) {
      this.writeVramByte(offset - TEXT_VRAM_OFFSET, value);
      return;
    }

    // Palette
    if (offset >= PALETTE_OFFSET && offset < PALETTE_OFFSET + PALETTE_SIZE) {
      this.writePaletteByte(offset - PALETTE_OFFSET, value);
      return;
    }

    // Framebuffer
    if (offset >= FRAMEBUFFER_OFFSET) {
      this.writeFramebufferByte(offset - FRAMEBUFFER_OFFSET, value);
    }
  }

  mmioReadHalfword(address: number): number {
    const offset = address - GRAPHICS_BASE;

    // Registers
    if (offset >= 0 && offset < GRAPHICS_REGS_SIZE) {
      const regOffset = offset & ~0x3;
      const value = this.readRegister(regOffset);
      return value & 0xFFFF;
    }

    // Other regions - just read two bytes
    const lo = this.mmioReadByte(address);
    const hi = this.mmioReadByte(address + 1);
    return lo | (hi << 8);
  }

  mmioWriteHalfword(address: number, value: number): void {
    const offset = address - GRAPHICS_BASE;

    // Registers
    if (offset >= 0 && offset < GRAPHICS_REGS_SIZE) {
      const regOffset = offset & ~0x3;
      this.writeRegister(regOffset, value & 0xFFFF);
      return;
    }

    // Other regions - write two bytes
    this.mmioWriteByte(address, value & 0xFF);
    this.mmioWriteByte(address + 1, (value >> 8) & 0xFF);
  }

  // Dirty tracking

  isDirty(): boolean {
    return this.dirty;
  }

  clearDirty(): void {
    this.dirty = false;
  }

  // Getters for rendering

  getMode(): DisplayMode {
    return this.mode;
  }

  getCursorPosition(): { x: number; y: number } {
    return { x: this.cursorX, y: this.cursorY };
  }

  getCursorControl(): number {
    return this.cursorCtrl;
  }

  isCursorEnabled(): boolean {
    return (this.cursorCtrl & 0x01) !== 0;
  }

  isCursorBlinking(): boolean {
    return (this.cursorCtrl & 0x02) !== 0;
  }

  getCursorBlinkRate(): number {
    return (this.cursorCtrl >> 4) & 0x0F;
  }

  getCursorStartScanline(): number {
    return (this.cursorCtrl >> 8) & 0x0F;
  }

  getCursorEndScanline(): number {
    return (this.cursorCtrl >> 12) & 0x0F;
  }

  getTextVram(): Uint8Array {
    return this.textVram;
  }

  getFramebuffer(): Uint8Array {
    return this.framebuffer;
  }

  getPalette(): Uint8Array {
    return this.palette;
  }

  getResolution(): { width: number; height: number } {
    return this.resolutions[this.mode];
  }

  /**
   * Set cursor position
   */
  setCursorPosition(x: number, y: number): void {
    this.cursorX = Math.max(0, Math.min(TEXT_COLS - 1, x));
    this.cursorY = Math.max(0, Math.min(TEXT_ROWS - 1, y));
    this.dirty = true;
  }

  /**
   * Write a character at cursor position and advance cursor
   * Handles special characters (newline, backspace, tab)
   */
  putcharWithCursor(char: number): void {
    if (char === 0x0A || char === 0x0D) {
      // Newline/CR - move to start of next line
      this.cursorX = 0;
      this.cursorY++;
    } else if (char === 0x08) {
      // Backspace - move back and clear
      if (this.cursorX > 0) {
        this.cursorX--;
        this.writeTextVram(this.cursorX, this.cursorY, 0x20, 0x07);
      }
    } else if (char === 0x09) {
      // Tab - advance to next 8-column boundary
      this.cursorX = (Math.floor(this.cursorX / 8) + 1) * 8;
      if (this.cursorX >= TEXT_COLS) {
        this.cursorX = 0;
        this.cursorY++;
      }
    } else {
      // Regular character
      this.writeTextVram(this.cursorX, this.cursorY, char, 0x07);
      this.cursorX++;
      if (this.cursorX >= TEXT_COLS) {
        this.cursorX = 0;
        this.cursorY++;
      }
    }

    // Handle scroll if needed
    if (this.cursorY >= TEXT_ROWS) {
      this.scrollUp();
      this.cursorY = TEXT_ROWS - 1;
    }
    this.dirty = true;
  }

  /**
   * Scroll screen up by one line
   */
  private scrollUp(): void {
    // Move all lines up by 1
    for (let y = 0; y < TEXT_ROWS - 1; y++) {
      for (let x = 0; x < TEXT_COLS; x++) {
        const srcOffset = ((y + 1) * TEXT_COLS + x) * 2;
        const dstOffset = (y * TEXT_COLS + x) * 2;
        this.textVram[dstOffset] = this.textVram[srcOffset];
        this.textVram[dstOffset + 1] = this.textVram[srcOffset + 1];
      }
    }
    // Clear last line
    const lastLineY = TEXT_ROWS - 1;
    for (let x = 0; x < TEXT_COLS; x++) {
      this.writeTextVram(x, lastLineY, 0x20, 0x07);
    }
  }
}
