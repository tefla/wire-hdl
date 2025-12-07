import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Display } from './Display.js';
import { Computer } from './computer.js';
import { PersistentDisk } from './persistent-disk.js';
import { createFloppyDisk } from '../bootstrap/disk-image.js';
import type { GraphicsCard } from './graphics-card.js';

export function App() {
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [diskActive, setDiskActive] = useState(false);
  const [floppyActive, setFloppyActive] = useState(false);
  const [floppyInserted, setFloppyInserted] = useState(false);
  const [cpuState, setCpuState] = useState({ pc: 0, a: 0, x: 0, y: 0, sp: 0, p: 0 });
  const [graphics, setGraphics] = useState<GraphicsCard | null>(null);

  const computerRef = useRef<Computer | null>(null);
  const diskRef = useRef<PersistentDisk | null>(null);
  const displayContainerRef = useRef<HTMLDivElement | null>(null);

  // Initialize on mount
  useEffect(() => {
    async function init() {
      const disk = new PersistentDisk();
      await disk.init();
      diskRef.current = disk;

      const computer = new Computer(disk, {
        onOutput: (char) => {
          const terminalOutput = (window as unknown as { terminalOutput?: (c: number) => void })
            .terminalOutput;
          if (terminalOutput) {
            terminalOutput(char);
          }
        },
        onDiskActivity: (reading) => {
          setDiskActive(reading);
        },
        onFloppyActivity: (reading) => {
          setFloppyActive(reading);
        },
      });

      computerRef.current = computer;
      setGraphics(computer.getGraphics());
      setReady(true);
    }

    init();

    return () => {
      computerRef.current?.stop();
    };
  }, []);

  // Update CPU state periodically
  useEffect(() => {
    if (!running) return;

    const interval = setInterval(() => {
      if (computerRef.current) {
        setCpuState(computerRef.current.getState());
      }
    }, 100);

    return () => clearInterval(interval);
  }, [running]);

  // Handle keyboard input on the display container
  useEffect(() => {
    const container = displayContainerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      let key = 0;

      if (e.key.length === 1) {
        key = e.key.charCodeAt(0);
      } else {
        switch (e.key) {
          case 'Enter': key = 13; break;
          case 'Backspace': key = 8; break;
          case 'Escape': key = 27; break;
          case 'ArrowUp': key = 0x91; break;
          case 'ArrowDown': key = 0x92; break;
          case 'ArrowLeft': key = 0x93; break;
          case 'ArrowRight': key = 0x94; break;
        }
      }

      if (key !== 0) {
        computerRef.current?.sendKey(key);
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [ready]);

  const handleStart = useCallback(() => {
    if (computerRef.current) {
      computerRef.current.start();
      setRunning(true);
    }
  }, []);

  const handleStop = useCallback(() => {
    if (computerRef.current) {
      computerRef.current.stop();
      setRunning(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    if (computerRef.current) {
      computerRef.current.reset();
    }
  }, []);

  const handleClearDisk = useCallback(async () => {
    if (diskRef.current && confirm('Clear all disk data? This cannot be undone.')) {
      await diskRef.current.clear();
      alert('Disk cleared');
    }
  }, []);

  const handleExportDisk = useCallback(async () => {
    if (diskRef.current) {
      const blob = await diskRef.current.exportDisk();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'wireos-disk.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  }, []);

  const handleImportDisk = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && diskRef.current) {
        await diskRef.current.importDisk(file);
        alert('Disk imported. Reset the computer to load.');
      }
    };
    input.click();
  }, []);

  const handleFloppyToggle = useCallback(() => {
    if (!computerRef.current) return;

    if (floppyInserted) {
      computerRef.current.ejectFloppy();
      setFloppyInserted(false);
    } else {
      const floppySectors = createFloppyDisk();
      computerRef.current.insertFloppy(floppySectors);
      setFloppyInserted(true);
    }
  }, [floppyInserted]);

  const hex = (n: number, digits = 4) => n.toString(16).toUpperCase().padStart(digits, '0');

  if (!ready) {
    return (
      <div style={{ color: '#33ff33', textAlign: 'center', padding: '40px' }}>
        Initializing...
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <h1 style={{ color: '#33ff33', fontSize: '24px', fontWeight: 'normal' }}>
          WireOS Computer
        </h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Button onClick={handleFloppyToggle}>
            {floppyInserted ? 'Eject Floppy' : 'Insert WireOS Disk'}
          </Button>
          {floppyInserted && (
            <span style={{ color: floppyActive ? '#ffff00' : '#33ff33', fontSize: '12px' }}>
              A:
            </span>
          )}
          {!running ? (
            <Button onClick={handleStart}>Start</Button>
          ) : (
            <Button onClick={handleStop}>Stop</Button>
          )}
          <Button onClick={handleReset}>Reset</Button>
        </div>
      </div>

      {/* Display */}
      <div
        ref={displayContainerRef}
        tabIndex={0}
        style={{
          outline: 'none',
          display: 'flex',
          justifyContent: 'center',
          position: 'relative',
        }}
        onClick={(e) => e.currentTarget.focus()}
      >
        {graphics && <Display graphics={graphics} scale={2} />}
        {diskActive && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              color: '#ff0',
              fontSize: '12px',
            }}
          >
            HDD
          </div>
        )}
      </div>

      {/* Status bar */}
      <div
        style={{
          marginTop: '32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#888',
          fontSize: '12px',
          fontFamily: 'monospace',
        }}
      >
        <div>
          PC:{hex(cpuState.pc)} A:{hex(cpuState.a, 2)} X:{hex(cpuState.x, 2)} Y:
          {hex(cpuState.y, 2)} SP:{hex(cpuState.sp, 2)} P:{hex(cpuState.p, 2)}
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <button
            onClick={handleExportDisk}
            style={{
              background: 'none',
              border: 'none',
              color: '#666',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Export Disk
          </button>
          <button
            onClick={handleImportDisk}
            style={{
              background: 'none',
              border: 'none',
              color: '#666',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Import Disk
          </button>
          <button
            onClick={handleClearDisk}
            style={{
              background: 'none',
              border: 'none',
              color: '#666',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Clear Disk
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div
        style={{
          marginTop: '24px',
          padding: '16px',
          backgroundColor: '#16213e',
          borderRadius: '8px',
          color: '#aaa',
          fontSize: '13px',
          lineHeight: '1.6',
        }}
      >
        <strong style={{ color: '#33ff33' }}>Hex Loader Commands:</strong>
        <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: '120px 1fr', gap: '4px 16px' }}>
          <code>L xxxx</code> <span>Set load address</span>
          <code>D xxxx</code> <span>Dump 16 bytes</span>
          <code>E</code> <span>Execute at load address</span>
          <code>R</code> <span>Reset to $0200</span>
          <code>xx xx ...</code> <span>Enter hex bytes</span>
        </div>
        <div style={{ marginTop: '12px', color: '#666' }}>
          Disk data persists in browser storage across page refreshes.
        </div>
      </div>
    </div>
  );
}

function Button({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 16px',
        backgroundColor: '#1a1a2e',
        border: '1px solid #33ff33',
        borderRadius: '4px',
        color: '#33ff33',
        cursor: 'pointer',
        fontSize: '14px',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#33ff33';
        e.currentTarget.style.color = '#1a1a2e';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = '#1a1a2e';
        e.currentTarget.style.color = '#33ff33';
      }}
    >
      {children}
    </button>
  );
}
