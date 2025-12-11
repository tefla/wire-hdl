import { useState, useEffect, useCallback, useRef } from 'react';
import { RiscVCpu } from '../emulator/cpu.js';
import { Screen } from './Screen.js';
import { KeyModifier } from '../emulator/keyboard.js';
import { InteractiveSystem } from '../emulator/boot-disk.js';

export function App() {
  const [cpu] = useState(() => new RiscVCpu({ memorySize: 64 * 1024 }));
  const [system, setSystem] = useState<InteractiveSystem | null>(null);
  const [pc, setPc] = useState(0);
  const [registers, setRegisters] = useState<number[]>([]);
  const [output, setOutput] = useState<string>('');
  const [program, setProgram] = useState<string>('');
  const [scale, setScale] = useState<1 | 2 | 3>(2);
  const [, forceUpdate] = useState({});
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const [isBooted, setIsBooted] = useState(false);
  const screenContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    updateState();
  }, []);

  // Keyboard event handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Update modifier state
      if (e.shiftKey) cpu.keyboard.setModifier(KeyModifier.SHIFT, true);
      if (e.ctrlKey) cpu.keyboard.setModifier(KeyModifier.CTRL, true);
      if (e.altKey) cpu.keyboard.setModifier(KeyModifier.ALT, true);

      // Map key to ASCII
      let ascii: number | null = null;

      // Handle special keys
      if (e.key === 'Enter') {
        ascii = 0x0D;
      } else if (e.key === 'Backspace') {
        ascii = 0x08;
        e.preventDefault(); // Prevent browser back navigation
      } else if (e.key === 'Escape') {
        ascii = 0x1B;
      } else if (e.key === 'Tab') {
        ascii = 0x09;
        e.preventDefault(); // Prevent focus change
      } else if (e.key.length === 1) {
        // Regular printable character
        ascii = e.key.charCodeAt(0);
      }

      if (ascii !== null) {
        // If booted, send to interactive system
        if (system && isBooted) {
          system.keyPress(ascii);
          forceUpdate({}); // Update screen
          setOutput(system.isRunning() ? 'System running' : 'System halted');
        } else {
          cpu.keyboard.keyPress(ascii);
          setOutput(`Key pressed: ${e.key} (0x${ascii.toString(16).padStart(2, '0')})`);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Update modifier state
      if (!e.shiftKey) cpu.keyboard.setModifier(KeyModifier.SHIFT, false);
      if (!e.ctrlKey) cpu.keyboard.setModifier(KeyModifier.CTRL, false);
      if (!e.altKey) cpu.keyboard.setModifier(KeyModifier.ALT, false);
    };

    // Only listen for keyboard events when focused on the screen
    const container = screenContainerRef.current;
    if (container && keyboardFocused) {
      container.addEventListener('keydown', handleKeyDown);
      container.addEventListener('keyup', handleKeyUp);
      return () => {
        container.removeEventListener('keydown', handleKeyDown);
        container.removeEventListener('keyup', handleKeyUp);
      };
    }
  }, [cpu, keyboardFocused, system, isBooted]);

  const updateState = () => {
    setPc(cpu.pc);
    setRegisters(Array.from(cpu.x));
  };

  const handleBoot = () => {
    const newSystem = new InteractiveSystem(cpu);
    newSystem.boot();
    setSystem(newSystem);
    setIsBooted(true);
    setProgram('Wire-RISCV OS\nType "help" for commands');
    setOutput('System booted. Click screen and type commands.');
    forceUpdate({});

    // Focus the screen
    screenContainerRef.current?.focus();
  };

  const handleStep = () => {
    cpu.step();
    updateState();
  };

  const handleReset = () => {
    cpu.reset();
    setSystem(null);
    setIsBooted(false);
    setOutput('');
    setProgram('');
    updateState();
  };

  const handleLoadExample = () => {
    // Simple example: add two numbers
    const program = new Uint8Array([
      0x93, 0x00, 0x50, 0x00, // addi x1, x0, 5
      0x13, 0x01, 0xa0, 0x00, // addi x2, x0, 10
      0xb3, 0x81, 0x20, 0x00, // add x3, x1, x2
      0x73, 0x00, 0x00, 0x00, // ecall
    ]);
    cpu.reset();
    setSystem(null);
    setIsBooted(false);
    cpu.loadProgram(program);
    setProgram('addi x1, x0, 5\naddi x2, x0, 10\nadd x3, x1, x2\necall');
    setOutput('Loaded example: add 5 + 10');
    updateState();
  };

  const handleLoadHelloWorld = () => {
    cpu.reset();
    setSystem(null);
    setIsBooted(false);

    const program = new Uint8Array([
      0x37, 0x15, 0x00, 0x10,
      0x93, 0x02, 0x80, 0x04,
      0x23, 0x00, 0x55, 0x00,
      0x93, 0x02, 0xf0, 0x00,
      0xa3, 0x00, 0x55, 0x00,
      0x93, 0x02, 0x50, 0x04,
      0x23, 0x01, 0x55, 0x00,
      0x93, 0x02, 0xf0, 0x00,
      0xa3, 0x01, 0x55, 0x00,
      0x93, 0x02, 0xc0, 0x04,
      0x23, 0x02, 0x55, 0x00,
      0x93, 0x02, 0xf0, 0x00,
      0xa3, 0x02, 0x55, 0x00,
      0x93, 0x02, 0xc0, 0x04,
      0x23, 0x03, 0x55, 0x00,
      0x93, 0x02, 0xf0, 0x00,
      0xa3, 0x03, 0x55, 0x00,
      0x93, 0x02, 0xf0, 0x04,
      0x23, 0x04, 0x55, 0x00,
      0x93, 0x02, 0xf0, 0x00,
      0xa3, 0x04, 0x55, 0x00,
      0x73, 0x00, 0x00, 0x00,
    ]);

    cpu.loadProgram(program);
    setProgram('lui a0, 0x10001\n; Write HELLO to VRAM\n... (graphics demo)');
    setOutput('Loaded Hello World example. Press Run!');
    updateState();
  };

  const handleRun = () => {
    const cycles = cpu.run(10000);
    setOutput(`Executed ${cycles} cycles. ${cpu.halted ? 'CPU halted.' : ''}`);
    updateState();
    forceUpdate({});
  };

  const handleScaleChange = useCallback((newScale: 1 | 2 | 3) => {
    setScale(newScale);
  }, []);

  return (
    <div style={{ fontFamily: 'monospace', padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Wire-RISCV Emulator</h1>
      <p style={{ color: '#666' }}>RISC-V RV32I CPU Emulator with Graphics and Shell</p>

      {/* Controls */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={handleBoot}
          style={{
            backgroundColor: isBooted ? '#2a2' : '#4a9eff',
            color: '#fff',
            fontWeight: 'bold',
          }}
        >
          {isBooted ? '✓ Booted' : '🚀 Boot'}
        </button>
        <button onClick={handleLoadExample}>
          Load Math
        </button>
        <button onClick={handleLoadHelloWorld}>
          Load Hello
        </button>
        <button onClick={handleStep} disabled={isBooted}>
          Step
        </button>
        <button onClick={handleRun} disabled={isBooted}>
          Run
        </button>
        <button onClick={handleReset}>Reset</button>

        <span style={{ marginLeft: '20px', color: '#666' }}>Scale:</span>
        {[1, 2, 3].map((s) => (
          <button
            key={s}
            onClick={() => handleScaleChange(s as 1 | 2 | 3)}
            style={{
              backgroundColor: scale === s ? '#4a9eff' : undefined,
              color: scale === s ? '#fff' : undefined,
            }}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Main content: Screen + Registers */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        {/* Screen */}
        <div
          ref={screenContainerRef}
          tabIndex={0}
          onFocus={() => setKeyboardFocused(true)}
          onBlur={() => setKeyboardFocused(false)}
          style={{ flexShrink: 0, outline: keyboardFocused ? '2px solid #4a9eff' : 'none' }}
        >
          <h3 style={{ margin: '0 0 10px 0' }}>
            Screen {keyboardFocused && <span style={{ color: '#4a9eff', fontSize: '12px' }}>(keyboard active)</span>}
            {isBooted && <span style={{ color: '#2a2', fontSize: '12px', marginLeft: '10px' }}>OS Running</span>}
          </h3>
          <Screen
            gpu={cpu.gpu}
            scale={scale}
            showCursor={true}
            cursorBlink={true}
            style={{ border: '2px solid #333', cursor: 'text' }}
          />
          <p style={{ fontSize: '11px', color: '#666', margin: '5px 0 0 0' }}>
            {isBooted
              ? 'Click screen and type commands (help, ls, cat, echo, cls, exit)'
              : 'Click screen to enable keyboard input'}
          </p>
        </div>

        {/* Registers */}
        <div style={{ flex: '1', minWidth: '200px' }}>
          <h3 style={{ margin: '0 0 10px 0' }}>Registers</h3>
          <div
            style={{
              backgroundColor: '#1a1a1a',
              color: '#0f0',
              padding: '10px',
              fontSize: '12px',
              height: '300px',
              overflow: 'auto',
            }}
          >
            <div style={{ marginBottom: '10px', color: '#ff0' }}>PC: 0x{pc.toString(16).padStart(8, '0')}</div>
            {registers.map((val, i) => (
              <div key={i}>
                x{i.toString().padStart(2, '0')}: 0x{val.toString(16).padStart(8, '0')} ({val})
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Program and Output */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
        <div>
          <h3 style={{ margin: '0 0 10px 0' }}>Program</h3>
          <pre
            style={{
              backgroundColor: '#1a1a1a',
              color: '#fff',
              padding: '10px',
              fontSize: '12px',
              height: '100px',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              margin: 0,
            }}
          >
            {program || '(No program loaded)'}
          </pre>
        </div>

        <div>
          <h3 style={{ margin: '0 0 10px 0' }}>Output</h3>
          <pre
            style={{
              backgroundColor: '#1a1a1a',
              color: '#0f0',
              padding: '10px',
              fontSize: '12px',
              height: '100px',
              overflow: 'auto',
              margin: 0,
            }}
          >
            {output || '(No output)'}
          </pre>
        </div>
      </div>

      <div style={{ marginTop: '20px', color: '#666', fontSize: '12px' }}>
        <p>
          <strong>Boot</strong> to start the OS with shell. Commands: help, ls, cat, echo, cls, mem, exit.
          Or load example programs and use Step/Run for manual execution.
        </p>
      </div>
    </div>
  );
}
