import { describe, it, expect } from 'vitest';
import { DisplayMode } from '../src/emulator/graphics.js';
import {
  getScreenDimensions,
  getBaseDimensions,
} from '../src/web/Screen.js';

describe('Screen utilities', () => {
  describe('getBaseDimensions', () => {
    it('should return 640x400 for TEXT mode', () => {
      const dims = getBaseDimensions(DisplayMode.TEXT);
      expect(dims.width).toBe(640);
      expect(dims.height).toBe(400);
    });

    it('should return 320x200 for GRAPHICS mode', () => {
      const dims = getBaseDimensions(DisplayMode.GRAPHICS);
      expect(dims.width).toBe(320);
      expect(dims.height).toBe(200);
    });

    it('should return 640x480 for GRAPHICS_HIRES mode', () => {
      const dims = getBaseDimensions(DisplayMode.GRAPHICS_HIRES);
      expect(dims.width).toBe(640);
      expect(dims.height).toBe(480);
    });
  });

  describe('getScreenDimensions', () => {
    it('should return scaled dimensions for TEXT mode at 1x', () => {
      const dims = getScreenDimensions(DisplayMode.TEXT, 1);
      expect(dims.width).toBe(640);
      expect(dims.height).toBe(400);
    });

    it('should return scaled dimensions for TEXT mode at 2x', () => {
      const dims = getScreenDimensions(DisplayMode.TEXT, 2);
      expect(dims.width).toBe(1280);
      expect(dims.height).toBe(800);
    });

    it('should return scaled dimensions for TEXT mode at 3x', () => {
      const dims = getScreenDimensions(DisplayMode.TEXT, 3);
      expect(dims.width).toBe(1920);
      expect(dims.height).toBe(1200);
    });

    it('should return scaled dimensions for GRAPHICS mode at 1x', () => {
      const dims = getScreenDimensions(DisplayMode.GRAPHICS, 1);
      expect(dims.width).toBe(320);
      expect(dims.height).toBe(200);
    });

    it('should return scaled dimensions for GRAPHICS mode at 2x', () => {
      const dims = getScreenDimensions(DisplayMode.GRAPHICS, 2);
      expect(dims.width).toBe(640);
      expect(dims.height).toBe(400);
    });

    it('should return scaled dimensions for GRAPHICS mode at 3x', () => {
      const dims = getScreenDimensions(DisplayMode.GRAPHICS, 3);
      expect(dims.width).toBe(960);
      expect(dims.height).toBe(600);
    });

    it('should return scaled dimensions for GRAPHICS_HIRES mode at 1x', () => {
      const dims = getScreenDimensions(DisplayMode.GRAPHICS_HIRES, 1);
      expect(dims.width).toBe(640);
      expect(dims.height).toBe(480);
    });

    it('should return scaled dimensions for GRAPHICS_HIRES mode at 2x', () => {
      const dims = getScreenDimensions(DisplayMode.GRAPHICS_HIRES, 2);
      expect(dims.width).toBe(1280);
      expect(dims.height).toBe(960);
    });
  });
});
