/**
 * Graphics Mode Renderer
 *
 * Renders the framebuffer to an RGBA pixel buffer using the palette.
 */

import { GraphicsCard, DisplayMode } from './graphics.js';

export const GRAPHICS_320_WIDTH = 320;
export const GRAPHICS_320_HEIGHT = 200;
export const GRAPHICS_640_WIDTH = 640;
export const GRAPHICS_640_HEIGHT = 480;

export class GraphicsRenderer {
  private imageData: Uint8ClampedArray | null = null;
  private width: number = 0;
  private height: number = 0;

  /**
   * Get the dimensions based on current GPU mode
   */
  getDimensions(gpu: GraphicsCard): { width: number; height: number } {
    const mode = gpu.getMode();
    switch (mode) {
      case DisplayMode.GRAPHICS:
        return { width: GRAPHICS_320_WIDTH, height: GRAPHICS_320_HEIGHT };
      case DisplayMode.GRAPHICS_HIRES:
        return { width: GRAPHICS_640_WIDTH, height: GRAPHICS_640_HEIGHT };
      default:
        return { width: 0, height: 0 };
    }
  }

  /**
   * Render the framebuffer to an RGBA pixel buffer
   * Returns null if GPU is in text mode
   */
  render(gpu: GraphicsCard): Uint8ClampedArray | null {
    const mode = gpu.getMode();

    // Don't render framebuffer in text mode
    if (mode === DisplayMode.TEXT) {
      return null;
    }

    const dims = this.getDimensions(gpu);
    this.width = dims.width;
    this.height = dims.height;

    const size = this.width * this.height * 4;

    // Allocate or reallocate buffer if needed
    if (!this.imageData || this.imageData.length !== size) {
      this.imageData = new Uint8ClampedArray(size);
    }

    const framebuffer = gpu.getFramebuffer();
    const palette = gpu.getPalette();

    // Convert framebuffer palette indices to RGBA
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const fbOffset = y * this.width + x;
        const colorIndex = framebuffer[fbOffset];

        // Look up color in palette
        const palOffset = colorIndex * 4;
        const r = palette[palOffset];
        const g = palette[palOffset + 1];
        const b = palette[palOffset + 2];

        // Write to image data
        const imgOffset = fbOffset * 4;
        this.imageData[imgOffset] = r;
        this.imageData[imgOffset + 1] = g;
        this.imageData[imgOffset + 2] = b;
        this.imageData[imgOffset + 3] = 255; // Alpha always opaque
      }
    }

    return this.imageData;
  }

  /**
   * Get a single pixel from the rendered buffer
   */
  getPixel(x: number, y: number): { r: number; g: number; b: number; a: number } {
    if (!this.imageData || x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return { r: 0, g: 0, b: 0, a: 0 };
    }

    const offset = (y * this.width + x) * 4;
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
  getImageData(): Uint8ClampedArray | null {
    return this.imageData;
  }

  /**
   * Get current width (after render)
   */
  getWidth(): number {
    return this.width;
  }

  /**
   * Get current height (after render)
   */
  getHeight(): number {
    return this.height;
  }
}
