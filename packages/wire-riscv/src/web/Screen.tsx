/**
 * Screen Component
 *
 * React component that renders the graphics card output to an HTML5 canvas.
 * Supports text mode and graphics mode rendering with configurable scale.
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { GraphicsCard, DisplayMode } from '../emulator/graphics.js';
import { TextRenderer, TEXT_PIXEL_WIDTH, TEXT_PIXEL_HEIGHT } from '../emulator/text-renderer.js';
import {
  GraphicsRenderer,
  GRAPHICS_320_WIDTH,
  GRAPHICS_320_HEIGHT,
  GRAPHICS_640_WIDTH,
  GRAPHICS_640_HEIGHT,
} from '../emulator/graphics-renderer.js';

export interface ScreenProps {
  gpu: GraphicsCard;
  scale?: 1 | 2 | 3;
  showCursor?: boolean;
  cursorBlink?: boolean;
  onKeyDown?: (event: KeyboardEvent) => void;
  onKeyUp?: (event: KeyboardEvent) => void;
  className?: string;
  style?: React.CSSProperties;
}

// Calculate dimensions based on mode and scale
export function getScreenDimensions(
  mode: DisplayMode,
  scale: number
): { width: number; height: number } {
  switch (mode) {
    case DisplayMode.TEXT:
      return { width: TEXT_PIXEL_WIDTH * scale, height: TEXT_PIXEL_HEIGHT * scale };
    case DisplayMode.GRAPHICS:
      return { width: GRAPHICS_320_WIDTH * scale, height: GRAPHICS_320_HEIGHT * scale };
    case DisplayMode.GRAPHICS_HIRES:
      return { width: GRAPHICS_640_WIDTH * scale, height: GRAPHICS_640_HEIGHT * scale };
    default:
      return { width: TEXT_PIXEL_WIDTH * scale, height: TEXT_PIXEL_HEIGHT * scale };
  }
}

// Get the base (unscaled) dimensions
export function getBaseDimensions(mode: DisplayMode): { width: number; height: number } {
  switch (mode) {
    case DisplayMode.TEXT:
      return { width: TEXT_PIXEL_WIDTH, height: TEXT_PIXEL_HEIGHT };
    case DisplayMode.GRAPHICS:
      return { width: GRAPHICS_320_WIDTH, height: GRAPHICS_320_HEIGHT };
    case DisplayMode.GRAPHICS_HIRES:
      return { width: GRAPHICS_640_WIDTH, height: GRAPHICS_640_HEIGHT };
    default:
      return { width: TEXT_PIXEL_WIDTH, height: TEXT_PIXEL_HEIGHT };
  }
}

export function Screen({
  gpu,
  scale = 1,
  showCursor = true,
  cursorBlink = true,
  onKeyDown,
  onKeyUp,
  className,
  style,
}: ScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRendererRef = useRef<TextRenderer | null>(null);
  const graphicsRendererRef = useRef<GraphicsRenderer | null>(null);
  const animationFrameRef = useRef<number>(0);
  const [blinkState, setBlinkState] = useState(true);
  const blinkCounterRef = useRef(0);

  // Initialize renderers
  useEffect(() => {
    textRendererRef.current = new TextRenderer();
    graphicsRendererRef.current = new GraphicsRenderer();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Handle keyboard events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      onKeyDown?.(e);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      onKeyUp?.(e);
    };

    canvas.addEventListener('keydown', handleKeyDown);
    canvas.addEventListener('keyup', handleKeyUp);

    return () => {
      canvas.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('keyup', handleKeyUp);
    };
  }, [onKeyDown, onKeyUp]);

  // Render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const mode = gpu.getMode();
    const baseDims = getBaseDimensions(mode);

    // Ensure canvas size is correct
    const dims = getScreenDimensions(mode, scale);
    if (canvas.width !== dims.width || canvas.height !== dims.height) {
      canvas.width = dims.width;
      canvas.height = dims.height;
    }

    let imageData: Uint8ClampedArray | null = null;

    if (mode === DisplayMode.TEXT) {
      // Text mode
      const textRenderer = textRendererRef.current;
      if (textRenderer) {
        imageData = textRenderer.render(gpu, {
          showCursor,
          cursorBlink,
          blinkState,
        });
      }
    } else {
      // Graphics mode
      const graphicsRenderer = graphicsRendererRef.current;
      if (graphicsRenderer) {
        imageData = graphicsRenderer.render(gpu);
      }
    }

    if (imageData) {
      // Create ImageData and draw to canvas
      const imgData = new ImageData(imageData, baseDims.width, baseDims.height);

      // Disable image smoothing for crisp pixels
      ctx.imageSmoothingEnabled = false;

      if (scale === 1) {
        // Direct copy
        ctx.putImageData(imgData, 0, 0);
      } else {
        // Scale up using off-screen canvas
        const offscreen = new OffscreenCanvas(baseDims.width, baseDims.height);
        const offCtx = offscreen.getContext('2d');
        if (offCtx) {
          offCtx.putImageData(imgData, 0, 0);
          ctx.drawImage(offscreen, 0, 0, dims.width, dims.height);
        }
      }
    }

    gpu.clearDirty();
  }, [gpu, scale, showCursor, cursorBlink, blinkState]);

  // Animation loop
  useEffect(() => {
    let running = true;

    const animate = () => {
      if (!running) return;

      // Update blink state (~500ms interval at 60fps = 30 frames)
      blinkCounterRef.current++;
      if (blinkCounterRef.current >= 30) {
        blinkCounterRef.current = 0;
        setBlinkState((prev) => !prev);
      }

      // Render if dirty or cursor is blinking
      if (gpu.isDirty() || (cursorBlink && showCursor)) {
        render();
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      running = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gpu, render, cursorBlink, showCursor]);

  // Initial render
  useEffect(() => {
    render();
  }, [render]);

  const mode = gpu.getMode();
  const dims = getScreenDimensions(mode, scale);

  return (
    <canvas
      ref={canvasRef}
      width={dims.width}
      height={dims.height}
      tabIndex={0}
      className={className}
      style={{
        imageRendering: 'pixelated',
        backgroundColor: '#000',
        ...style,
      }}
      aria-label={`RISC-V ${mode === DisplayMode.TEXT ? 'text' : 'graphics'} display`}
      role="img"
    />
  );
}

export default Screen;
