// Display Component for WireOS
// Renders graphics card VRAM to a canvas element

import { useRef, useEffect, useCallback } from 'react';
import { GraphicsCard, DISPLAY } from './graphics-card.js';
import { DEFAULT_FONT } from './font.js';

interface DisplayProps {
  graphics: GraphicsCard;
  scale?: number;
}

export function Display({ graphics, scale = 2 }: DisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  // Render a single frame
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cursor = graphics.getCursor();

    // Get image data for direct pixel manipulation
    const imageData = ctx.createImageData(DISPLAY.CANVAS_WIDTH, DISPLAY.CANVAS_HEIGHT);
    const pixels = imageData.data;

    // Fill with border color
    const [br, bg, bb] = graphics.getBorderColor();
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = br;
      pixels[i + 1] = bg;
      pixels[i + 2] = bb;
      pixels[i + 3] = 255;
    }

    if (graphics.isEnabled()) {
      if (graphics.isGraphicsMode()) {
        renderGraphicsMode(graphics, pixels);
      } else {
        renderTextMode(graphics, pixels, cursor);
      }
    }

    ctx.putImageData(imageData, 0, 0);
    graphics.markClean();

    // Schedule next frame
    animationRef.current = requestAnimationFrame(render);
  }, [graphics]);

  // Start rendering loop
  useEffect(() => {
    animationRef.current = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [render]);

  const width = DISPLAY.CANVAS_WIDTH * scale;
  const height = DISPLAY.CANVAS_HEIGHT * scale;

  return (
    <canvas
      ref={canvasRef}
      width={DISPLAY.CANVAS_WIDTH}
      height={DISPLAY.CANVAS_HEIGHT}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        imageRendering: 'pixelated',
        backgroundColor: '#000',
        border: '2px solid #333',
      }}
    />
  );
}

// Render text mode to pixel buffer
function renderTextMode(
  graphics: GraphicsCard,
  pixels: Uint8ClampedArray,
  cursor: { x: number; y: number; visible: boolean; blink: boolean }
): void {
  for (let row = 0; row < DISPLAY.TEXT_ROWS; row++) {
    for (let col = 0; col < DISPLAY.TEXT_COLS; col++) {
      const charCode = graphics.getChar(col, row);
      const attr = graphics.getAttr(col, row);

      // Get colors from attribute
      const fgIdx = attr & 0x0F;
      const bgIdx = (attr >> 4) & 0x0F;
      const [fr, fg, fb] = graphics.getColor(fgIdx);
      const [bgr, bgg, bgb] = graphics.getColor(bgIdx);

      // Get font bitmap for this character
      const fontOffset = charCode * 8;

      // Draw character
      for (let py = 0; py < DISPLAY.CHAR_HEIGHT; py++) {
        const fontRow = DEFAULT_FONT[fontOffset + py] ?? 0;

        for (let px = 0; px < DISPLAY.CHAR_WIDTH; px++) {
          const bit = (fontRow >> (7 - px)) & 1;
          const screenX = col * DISPLAY.CHAR_WIDTH + px;
          const screenY = row * DISPLAY.CHAR_HEIGHT + py;
          const pixelIdx = (screenY * DISPLAY.CANVAS_WIDTH + screenX) * 4;

          if (bit) {
            pixels[pixelIdx] = fr;
            pixels[pixelIdx + 1] = fg;
            pixels[pixelIdx + 2] = fb;
          } else {
            pixels[pixelIdx] = bgr;
            pixels[pixelIdx + 1] = bgg;
            pixels[pixelIdx + 2] = bgb;
          }
          pixels[pixelIdx + 3] = 255;
        }
      }

      // Draw cursor if at this position
      if (cursor.visible && cursor.blink && cursor.x === col && cursor.y === row) {
        // Draw cursor as underscore on last 2 rows
        for (let py = DISPLAY.CHAR_HEIGHT - 2; py < DISPLAY.CHAR_HEIGHT; py++) {
          for (let px = 0; px < DISPLAY.CHAR_WIDTH; px++) {
            const screenX = col * DISPLAY.CHAR_WIDTH + px;
            const screenY = row * DISPLAY.CHAR_HEIGHT + py;
            const pixelIdx = (screenY * DISPLAY.CANVAS_WIDTH + screenX) * 4;
            pixels[pixelIdx] = fr;
            pixels[pixelIdx + 1] = fg;
            pixels[pixelIdx + 2] = fb;
            pixels[pixelIdx + 3] = 255;
          }
        }
      }
    }
  }
}

// Render graphics mode to pixel buffer (placeholder)
function renderGraphicsMode(graphics: GraphicsCard, pixels: Uint8ClampedArray): void {
  const vram = graphics.getVRAM();

  // 160x100 @ 4bpp (2 pixels per byte)
  for (let y = 0; y < DISPLAY.GFX_HEIGHT; y++) {
    for (let x = 0; x < DISPLAY.GFX_WIDTH; x += 2) {
      const offset = y * (DISPLAY.GFX_WIDTH / 2) + (x / 2);
      const byte = vram[offset] ?? 0;

      // High nibble = left pixel, low nibble = right pixel
      const leftColor = (byte >> 4) & 0x0F;
      const rightColor = byte & 0x0F;

      // Scale 160x100 to 640x200 (4x2)
      const [lr, lg, lb] = graphics.getColor(leftColor);
      const [rr, rg, rb] = graphics.getColor(rightColor);

      for (let sy = 0; sy < 2; sy++) {
        for (let sx = 0; sx < 4; sx++) {
          // Left pixel
          const lx = x * 4 + sx;
          const ly = y * 2 + sy;
          const li = (ly * DISPLAY.CANVAS_WIDTH + lx) * 4;
          pixels[li] = lr;
          pixels[li + 1] = lg;
          pixels[li + 2] = lb;
          pixels[li + 3] = 255;

          // Right pixel
          const rx = (x + 1) * 4 + sx;
          const ri = (ly * DISPLAY.CANVAS_WIDTH + rx) * 4;
          pixels[ri] = rr;
          pixels[ri + 1] = rg;
          pixels[ri + 2] = rb;
          pixels[ri + 3] = 255;
        }
      }
    }
  }
}
