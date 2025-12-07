import React, { useEffect, useRef, useCallback, useState } from 'react';

const COLS = 80;
const ROWS = 25;

interface TerminalProps {
  onKeyPress: (key: number) => void;
  diskActive: boolean;
}

export function Terminal({ onKeyPress, diskActive }: TerminalProps) {
  const [lines, setLines] = useState<string[]>(() => Array(ROWS).fill(''));
  const [cursorX, setCursorX] = useState(0);
  const [cursorY, setCursorY] = useState(0);
  const [cursorVisible, setCursorVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Blink cursor
  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible((v) => !v);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Output character
  const outputChar = useCallback((char: number) => {
    setLines((prev) => {
      const newLines = [...prev];

      if (char === 0x0d || char === 0x0a) {
        // Newline
        setCursorX(0);
        setCursorY((y) => {
          if (y >= ROWS - 1) {
            // Scroll
            setLines((l) => [...l.slice(1), '']);
            return y;
          }
          return y + 1;
        });
      } else if (char === 0x08) {
        // Backspace
        setCursorX((x) => Math.max(0, x - 1));
      } else if (char >= 0x20 && char < 0x7f) {
        // Printable character
        const ch = String.fromCharCode(char);
        setCursorY((cy) => {
          setCursorX((cx) => {
            const line = newLines[cy] || '';
            const padded = line.padEnd(cx, ' ');
            newLines[cy] = padded.substring(0, cx) + ch + padded.substring(cx + 1);

            if (cx >= COLS - 1) {
              // Wrap to next line
              setCursorY((y) => {
                if (y >= ROWS - 1) {
                  setLines((l) => [...l.slice(1), '']);
                  return y;
                }
                return y + 1;
              });
              return 0;
            }
            return cx + 1;
          });
          return cy;
        });
      }

      return newLines;
    });
  }, []);

  // Expose outputChar to parent via ref-like pattern
  useEffect(() => {
    (window as unknown as { terminalOutput: (char: number) => void }).terminalOutput = outputChar;
    return () => {
      delete (window as unknown as { terminalOutput?: unknown }).terminalOutput;
    };
  }, [outputChar]);

  // Handle keyboard
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.preventDefault();

      let key = 0;

      if (e.key === 'Enter') {
        key = 0x0d;
      } else if (e.key === 'Backspace') {
        key = 0x08;
      } else if (e.key === 'Escape') {
        key = 0x1b;
      } else if (e.key.length === 1) {
        key = e.key.charCodeAt(0);
      }

      if (key > 0) {
        onKeyPress(key);
      }
    },
    [onKeyPress]
  );

  // Focus on click
  const handleClick = useCallback(() => {
    containerRef.current?.focus();
  }, []);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      style={{
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: '14px',
        lineHeight: '1.2',
        backgroundColor: '#0a0a0a',
        color: '#33ff33',
        padding: '16px',
        borderRadius: '8px',
        border: '2px solid #333',
        outline: 'none',
        cursor: 'text',
        position: 'relative',
        boxShadow: '0 0 20px rgba(51, 255, 51, 0.1), inset 0 0 60px rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* CRT scan line effect */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            'repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px)',
          pointerEvents: 'none',
          borderRadius: '6px',
        }}
      />

      {/* Screen content */}
      <div style={{ position: 'relative' }}>
        {lines.map((line, y) => (
          <div key={y} style={{ height: '16.8px', whiteSpace: 'pre' }}>
            {line.padEnd(COLS, ' ').split('').map((ch, x) => (
              <span
                key={x}
                style={{
                  backgroundColor:
                    x === cursorX && y === cursorY && cursorVisible
                      ? '#33ff33'
                      : 'transparent',
                  color:
                    x === cursorX && y === cursorY && cursorVisible
                      ? '#0a0a0a'
                      : '#33ff33',
                }}
              >
                {ch}
              </span>
            ))}
          </div>
        ))}
      </div>

      {/* Disk activity indicator */}
      {diskActive && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#ff3333',
            boxShadow: '0 0 8px #ff3333',
          }}
        />
      )}

      {/* Click to focus hint */}
      <div
        style={{
          position: 'absolute',
          bottom: '-24px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '11px',
          color: '#666',
        }}
      >
        Click to focus, then type
      </div>
    </div>
  );
}
