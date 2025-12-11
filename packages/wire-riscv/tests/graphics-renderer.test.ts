import { describe, it, expect, beforeEach } from 'vitest';
import { GraphicsCard, DisplayMode, PALETTE_ENTRIES } from '../src/emulator/graphics.js';
import {
  GraphicsRenderer,
  GRAPHICS_320_WIDTH,
  GRAPHICS_320_HEIGHT,
  GRAPHICS_640_WIDTH,
  GRAPHICS_640_HEIGHT,
} from '../src/emulator/graphics-renderer.js';

describe('GraphicsRenderer', () => {
  let gpu: GraphicsCard;
  let renderer: GraphicsRenderer;

  beforeEach(() => {
    gpu = new GraphicsCard();
    renderer = new GraphicsRenderer();
  });

  describe('dimensions', () => {
    it('should report 320x200 dimensions in GRAPHICS mode', () => {
      gpu.writeRegister(0x00, DisplayMode.GRAPHICS);
      const dims = renderer.getDimensions(gpu);
      expect(dims.width).toBe(GRAPHICS_320_WIDTH);
      expect(dims.height).toBe(GRAPHICS_320_HEIGHT);
      expect(GRAPHICS_320_WIDTH).toBe(320);
      expect(GRAPHICS_320_HEIGHT).toBe(200);
    });

    it('should report 640x480 dimensions in GRAPHICS_HIRES mode', () => {
      gpu.writeRegister(0x00, DisplayMode.GRAPHICS_HIRES);
      const dims = renderer.getDimensions(gpu);
      expect(dims.width).toBe(GRAPHICS_640_WIDTH);
      expect(dims.height).toBe(GRAPHICS_640_HEIGHT);
      expect(GRAPHICS_640_WIDTH).toBe(640);
      expect(GRAPHICS_640_HEIGHT).toBe(480);
    });
  });

  describe('pixel operations', () => {
    beforeEach(() => {
      gpu.writeRegister(0x00, DisplayMode.GRAPHICS);
    });

    it('should set and get pixel at (0,0)', () => {
      gpu.setPixel(0, 0, 15); // White
      expect(gpu.getPixel(0, 0)).toBe(15);
    });

    it('should set and get pixel at (319,199)', () => {
      gpu.setPixel(319, 199, 4); // Red
      expect(gpu.getPixel(319, 199)).toBe(4);
    });

    it('should set pixel with each palette index (0-255)', () => {
      for (let i = 0; i < 256; i++) {
        gpu.setPixel(i % 320, Math.floor(i / 320), i);
        expect(gpu.getPixel(i % 320, Math.floor(i / 320))).toBe(i);
      }
    });

    it('should clamp pixel coordinates out of bounds', () => {
      gpu.setPixel(-1, 0, 15);
      gpu.setPixel(320, 0, 15);
      gpu.setPixel(0, -1, 15);
      gpu.setPixel(0, 200, 15);
      // No crash, pixels at edges should be 0
      expect(gpu.getPixel(0, 0)).toBe(0);
    });
  });

  describe('framebuffer layout', () => {
    beforeEach(() => {
      gpu.writeRegister(0x00, DisplayMode.GRAPHICS);
    });

    it('should map pixel (x,y) to offset y*width + x', () => {
      // Set pixel at (10, 5) using setPixel
      gpu.setPixel(10, 5, 42);

      // Verify using direct framebuffer access
      const offset = 5 * 320 + 10;
      expect(gpu.readFramebufferByte(offset)).toBe(42);
    });

    it('should have correct row boundaries', () => {
      // Fill first row
      for (let x = 0; x < 320; x++) {
        gpu.setPixel(x, 0, 1);
      }
      // Fill second row
      for (let x = 0; x < 320; x++) {
        gpu.setPixel(x, 1, 2);
      }

      // Verify rows are separate
      expect(gpu.getPixel(319, 0)).toBe(1);
      expect(gpu.getPixel(0, 1)).toBe(2);
      expect(gpu.readFramebufferByte(319)).toBe(1);
      expect(gpu.readFramebufferByte(320)).toBe(2);
    });

    it('should have framebuffer size matching 320x200 resolution', () => {
      // Fill entire screen
      gpu.fillFramebuffer(7);

      // Check all pixels are set
      for (let y = 0; y < 200; y++) {
        for (let x = 0; x < 320; x++) {
          expect(gpu.getPixel(x, y)).toBe(7);
        }
      }
    });

    it('should have framebuffer size matching 640x480 resolution', () => {
      gpu.writeRegister(0x00, DisplayMode.GRAPHICS_HIRES);
      gpu.fillFramebuffer(9);

      // Spot check some pixels
      expect(gpu.getPixel(0, 0)).toBe(9);
      expect(gpu.getPixel(639, 479)).toBe(9);
      expect(gpu.getPixel(320, 240)).toBe(9);
    });
  });

  describe('palette operations', () => {
    it('should have default CGA palette for entries 0-15', () => {
      // Black
      expect(gpu.getPaletteEntry(0)).toEqual({ r: 0, g: 0, b: 0 });
      // White
      expect(gpu.getPaletteEntry(15)).toEqual({ r: 255, g: 255, b: 255 });
      // Red
      expect(gpu.getPaletteEntry(4)).toEqual({ r: 170, g: 0, b: 0 });
      // Blue
      expect(gpu.getPaletteEntry(1)).toEqual({ r: 0, g: 0, b: 170 });
    });

    it('should set palette entry to custom color', () => {
      gpu.setPaletteEntry(0, 128, 64, 32);
      expect(gpu.getPaletteEntry(0)).toEqual({ r: 128, g: 64, b: 32 });
    });

    it('should set all 256 palette entries', () => {
      for (let i = 0; i < 256; i++) {
        gpu.setPaletteEntry(i, i, 255 - i, i / 2);
      }

      for (let i = 0; i < 256; i++) {
        const entry = gpu.getPaletteEntry(i);
        expect(entry.r).toBe(i);
        expect(entry.g).toBe(255 - i);
        expect(entry.b).toBe(Math.floor(i / 2));
      }
    });

    it('should clamp palette values to 0-255', () => {
      gpu.setPaletteEntry(0, -10, 300, 128);
      const entry = gpu.getPaletteEntry(0);
      expect(entry.r).toBe(0);   // Clamped from -10
      expect(entry.g).toBe(255); // Clamped from 300
      expect(entry.b).toBe(128);
    });

    it('should have grayscale ramp for entries 16-255 by default', () => {
      // Entry 16 should be near black
      const entry16 = gpu.getPaletteEntry(16);
      expect(entry16.r).toBe(entry16.g);
      expect(entry16.g).toBe(entry16.b);
      expect(entry16.r).toBeLessThan(10);

      // Entry 255 should be near white
      const entry255 = gpu.getPaletteEntry(255);
      expect(entry255.r).toBe(entry255.g);
      expect(entry255.g).toBe(entry255.b);
      expect(entry255.r).toBeGreaterThan(245);
    });
  });

  describe('rendering', () => {
    beforeEach(() => {
      gpu.writeRegister(0x00, DisplayMode.GRAPHICS);
    });

    it('should render black screen when framebuffer is zeroed', () => {
      gpu.fillFramebuffer(0);
      const imageData = renderer.render(gpu);

      expect(imageData.length).toBe(320 * 200 * 4);

      // Check first pixel is black
      expect(imageData[0]).toBe(0);   // R
      expect(imageData[1]).toBe(0);   // G
      expect(imageData[2]).toBe(0);   // B
      expect(imageData[3]).toBe(255); // A
    });

    it('should render white screen with palette index 15', () => {
      gpu.fillFramebuffer(15);
      const imageData = renderer.render(gpu);

      // Check first pixel is white
      expect(imageData[0]).toBe(255);
      expect(imageData[1]).toBe(255);
      expect(imageData[2]).toBe(255);
      expect(imageData[3]).toBe(255);
    });

    it('should render single red pixel at (0,0)', () => {
      gpu.fillFramebuffer(0); // Black background
      gpu.setPixel(0, 0, 4);  // Red pixel
      const imageData = renderer.render(gpu);

      // First pixel should be red
      expect(imageData[0]).toBe(170);
      expect(imageData[1]).toBe(0);
      expect(imageData[2]).toBe(0);
      expect(imageData[3]).toBe(255);

      // Second pixel should be black
      expect(imageData[4]).toBe(0);
      expect(imageData[5]).toBe(0);
      expect(imageData[6]).toBe(0);
    });

    it('should render pixel at correct location', () => {
      gpu.fillFramebuffer(0);
      gpu.setPixel(10, 5, 1); // Blue pixel at (10, 5)
      const imageData = renderer.render(gpu);

      // Calculate offset: (5 * 320 + 10) * 4
      const offset = (5 * 320 + 10) * 4;
      expect(imageData[offset]).toBe(0);     // R
      expect(imageData[offset + 1]).toBe(0); // G
      expect(imageData[offset + 2]).toBe(170); // B (CGA blue)
      expect(imageData[offset + 3]).toBe(255); // A
    });

    it('should render horizontal line correctly', () => {
      gpu.fillFramebuffer(0);
      for (let x = 0; x < 320; x++) {
        gpu.setPixel(x, 100, 14); // Yellow line at y=100
      }
      const imageData = renderer.render(gpu);

      // Check pixel on the line
      const onLineOffset = (100 * 320 + 160) * 4;
      expect(imageData[onLineOffset]).toBe(255);     // R
      expect(imageData[onLineOffset + 1]).toBe(255); // G
      expect(imageData[onLineOffset + 2]).toBe(85);  // B (CGA yellow)

      // Check pixel above the line
      const aboveLineOffset = (99 * 320 + 160) * 4;
      expect(imageData[aboveLineOffset]).toBe(0);
    });

    it('should render vertical line correctly', () => {
      gpu.fillFramebuffer(0);
      for (let y = 0; y < 200; y++) {
        gpu.setPixel(160, y, 2); // Green line at x=160
      }
      const imageData = renderer.render(gpu);

      // Check pixel on the line
      const onLineOffset = (100 * 320 + 160) * 4;
      expect(imageData[onLineOffset]).toBe(0);       // R
      expect(imageData[onLineOffset + 1]).toBe(170); // G (CGA green)
      expect(imageData[onLineOffset + 2]).toBe(0);   // B

      // Check pixel left of the line
      const leftOfLineOffset = (100 * 320 + 159) * 4;
      expect(imageData[leftOfLineOffset]).toBe(0);
      expect(imageData[leftOfLineOffset + 1]).toBe(0);
    });

    it('should render rectangle fill correctly', () => {
      gpu.fillFramebuffer(0);
      // Fill 10x10 rectangle at (50, 50)
      for (let y = 50; y < 60; y++) {
        for (let x = 50; x < 60; x++) {
          gpu.setPixel(x, y, 5); // Magenta
        }
      }
      const imageData = renderer.render(gpu);

      // Check corner of rectangle
      const cornerOffset = (50 * 320 + 50) * 4;
      expect(imageData[cornerOffset]).toBe(170);     // R
      expect(imageData[cornerOffset + 1]).toBe(0);   // G
      expect(imageData[cornerOffset + 2]).toBe(170); // B (CGA magenta)

      // Check outside rectangle
      const outsideOffset = (49 * 320 + 50) * 4;
      expect(imageData[outsideOffset]).toBe(0);
    });

    it('should render checkerboard pattern correctly', () => {
      gpu.fillFramebuffer(0);
      // Create checkerboard with 2 colors
      for (let y = 0; y < 200; y++) {
        for (let x = 0; x < 320; x++) {
          const color = ((x + y) % 2 === 0) ? 0 : 15;
          gpu.setPixel(x, y, color);
        }
      }
      const imageData = renderer.render(gpu);

      // (0,0) should be black
      expect(imageData[0]).toBe(0);
      // (1,0) should be white
      expect(imageData[4]).toBe(255);
      // (0,1) should be white
      expect(imageData[320 * 4]).toBe(255);
      // (1,1) should be black
      expect(imageData[320 * 4 + 4]).toBe(0);
    });

    it('should use custom palette colors', () => {
      gpu.setPaletteEntry(100, 42, 128, 200);
      gpu.setPixel(0, 0, 100);
      const imageData = renderer.render(gpu);

      expect(imageData[0]).toBe(42);
      expect(imageData[1]).toBe(128);
      expect(imageData[2]).toBe(200);
    });
  });

  describe('resolution switching', () => {
    it('should render 640x480 image in GRAPHICS_HIRES mode', () => {
      gpu.writeRegister(0x00, DisplayMode.GRAPHICS_HIRES);
      gpu.fillFramebuffer(15);
      const imageData = renderer.render(gpu);

      expect(imageData.length).toBe(640 * 480 * 4);

      // First pixel
      expect(imageData[0]).toBe(255);
      expect(imageData[1]).toBe(255);
      expect(imageData[2]).toBe(255);

      // Last pixel
      const lastOffset = (640 * 480 - 1) * 4;
      expect(imageData[lastOffset]).toBe(255);
    });

    it('should render pixel at (639, 479) in GRAPHICS_HIRES mode', () => {
      gpu.writeRegister(0x00, DisplayMode.GRAPHICS_HIRES);
      gpu.fillFramebuffer(0);
      gpu.setPixel(639, 479, 4); // Red at bottom-right

      const imageData = renderer.render(gpu);
      const lastOffset = (640 * 480 - 1) * 4;

      expect(imageData[lastOffset]).toBe(170);     // R
      expect(imageData[lastOffset + 1]).toBe(0);   // G
      expect(imageData[lastOffset + 2]).toBe(0);   // B
    });

    it('should not render framebuffer in TEXT mode', () => {
      gpu.writeRegister(0x00, DisplayMode.TEXT);
      gpu.fillFramebuffer(15);

      // Renderer should return null or empty for text mode
      const imageData = renderer.render(gpu);
      expect(imageData).toBeNull();
    });
  });

  describe('getPixel helper', () => {
    beforeEach(() => {
      gpu.writeRegister(0x00, DisplayMode.GRAPHICS);
    });

    it('should return correct RGBA for rendered pixel', () => {
      gpu.fillFramebuffer(0);
      gpu.setPixel(10, 10, 12); // Light red
      renderer.render(gpu);

      const pixel = renderer.getPixel(10, 10);
      expect(pixel.r).toBe(255);
      expect(pixel.g).toBe(85);
      expect(pixel.b).toBe(85);
      expect(pixel.a).toBe(255);
    });

    it('should return zeros for out-of-bounds coordinates', () => {
      renderer.render(gpu);

      expect(renderer.getPixel(-1, 0)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
      expect(renderer.getPixel(320, 0)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
      expect(renderer.getPixel(0, -1)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
      expect(renderer.getPixel(0, 200)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    });
  });
});
