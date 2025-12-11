import { useState, useEffect, useCallback } from 'react';
import { RiscVCpu } from '../emulator/cpu.js';
import { Screen } from './Screen.js';

export function App() {
  const [cpu] = useState(() => new RiscVCpu({ memorySize: 64 * 1024 }));
  const [pc, setPc] = useState(0);
  const [registers, setRegisters] = useState<number[]>([]);
  const [output, setOutput] = useState<string>('');
  const [program, setProgram] = useState<string>('');
  const [scale, setScale] = useState<1 | 2 | 3>(1);
  const [, forceUpdate] = useState({});

  useEffect(() => {
    updateState();
  }, []);

  const updateState = () => {
    setPc(cpu.pc);
    setRegisters(Array.from(cpu.x));
  };

  const handleStep = () => {
    cpu.step();
    updateState();
  };

  const handleReset = () => {
    cpu.reset();
    setOutput('');
    updateState();
  };

  const handleLoadExample = () => {
    // Simple example: add two numbers
    // addi x1, x0, 5    ; x1 = 5
    // addi x2, x0, 10   ; x2 = 10
    // add  x3, x1, x2   ; x3 = x1 + x2 = 15
    // ecall             ; halt
    const program = new Uint8Array([
      0x93, 0x00, 0x50, 0x00, // addi x1, x0, 5
      0x13, 0x01, 0xa0, 0x00, // addi x2, x0, 10
      0xb3, 0x81, 0x20, 0x00, // add x3, x1, x2
      0x73, 0x00, 0x00, 0x00, // ecall
    ]);
    cpu.reset();
    cpu.loadProgram(program);
    setProgram('addi x1, x0, 5\naddi x2, x0, 10\nadd x3, x1, x2\necall');
    setOutput('Loaded example: add 5 + 10');
    updateState();
  };

  const handleLoadHelloWorld = () => {
    // Write "HELLO" to the screen (text VRAM at 0x10001000)
    // Each character takes 2 bytes: char + attribute
    cpu.reset();

    // Build program to write "HELLO" to VRAM
    // lui a0, 0x10001  ; a0 = 0x10001000 (VRAM base)
    // li t0, 'H'       ; load char
    // sb t0, 0(a0)     ; store char
    // li t0, 0x0F      ; white on black
    // sb t0, 1(a0)     ; store attr
    // ... repeat for E, L, L, O
    const program = new Uint8Array([
      // lui a0, 0x10001
      0x37, 0x15, 0x00, 0x10,

      // 'H' at position 0
      0x93, 0x02, 0x80, 0x04, // addi t0, x0, 0x48 ('H')
      0x23, 0x00, 0x55, 0x00, // sb t0, 0(a0)
      0x93, 0x02, 0xf0, 0x00, // addi t0, x0, 0x0F (white on black)
      0xa3, 0x00, 0x55, 0x00, // sb t0, 1(a0)

      // 'E' at position 1
      0x93, 0x02, 0x50, 0x04, // addi t0, x0, 0x45 ('E')
      0x23, 0x01, 0x55, 0x00, // sb t0, 2(a0)
      0x93, 0x02, 0xf0, 0x00, // addi t0, x0, 0x0F
      0xa3, 0x01, 0x55, 0x00, // sb t0, 3(a0)

      // 'L' at position 2
      0x93, 0x02, 0xc0, 0x04, // addi t0, x0, 0x4C ('L')
      0x23, 0x02, 0x55, 0x00, // sb t0, 4(a0)
      0x93, 0x02, 0xf0, 0x00, // addi t0, x0, 0x0F
      0xa3, 0x02, 0x55, 0x00, // sb t0, 5(a0)

      // 'L' at position 3
      0x93, 0x02, 0xc0, 0x04, // addi t0, x0, 0x4C ('L')
      0x23, 0x03, 0x55, 0x00, // sb t0, 6(a0)
      0x93, 0x02, 0xf0, 0x00, // addi t0, x0, 0x0F
      0xa3, 0x03, 0x55, 0x00, // sb t0, 7(a0)

      // 'O' at position 4
      0x93, 0x02, 0xf0, 0x04, // addi t0, x0, 0x4F ('O')
      0x23, 0x04, 0x55, 0x00, // sb t0, 8(a0)
      0x93, 0x02, 0xf0, 0x00, // addi t0, x0, 0x0F
      0xa3, 0x04, 0x55, 0x00, // sb t0, 9(a0)

      // ecall (halt)
      0x73, 0x00, 0x00, 0x00,
    ]);

    cpu.loadProgram(program);
    setProgram('lui a0, 0x10001\\n; Write HELLO to VRAM\\n... (graphics demo)');
    setOutput('Loaded Hello World example. Press Run!');
    updateState();
  };

  const handleRun = () => {
    const cycles = cpu.run(10000);
    setOutput(`Executed ${cycles} cycles. ${cpu.halted ? 'CPU halted.' : ''}`);
    updateState();
    forceUpdate({}); // Trigger screen re-render
  };

  const handleScaleChange = useCallback((newScale: 1 | 2 | 3) => {
    setScale(newScale);
  }, []);

  return (
    <div style={{ fontFamily: 'monospace', padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Wire-RISCV Emulator</h1>
      <p style={{ color: '#666' }}>RISC-V RV32I CPU Emulator with Graphics</p>

      {/* Controls */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={handleLoadExample}>
          Load Math
        </button>
        <button onClick={handleLoadHelloWorld}>
          Load Hello
        </button>
        <button onClick={handleStep}>
          Step
        </button>
        <button onClick={handleRun}>
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
        <div style={{ flexShrink: 0 }}>
          <h3 style={{ margin: '0 0 10px 0' }}>Screen</h3>
          <Screen
            gpu={cpu.gpu}
            scale={scale}
            showCursor={true}
            cursorBlink={true}
            style={{ border: '2px solid #333' }}
          />
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
          RV32I emulator with memory-mapped graphics. Click &quot;Load Hello&quot; and &quot;Run&quot; to see text output.
          Graphics memory is at 0x10000000+. Text VRAM starts at 0x10001000 (80x25 chars, 2 bytes each: char + attr).
        </p>
      </div>
    </div>
  );
}
