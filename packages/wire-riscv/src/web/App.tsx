import { useState, useEffect } from 'react';
import { RiscVCpu } from '../emulator/cpu.js';

export function App() {
  const [cpu] = useState(() => new RiscVCpu({ memorySize: 64 * 1024 }));
  const [pc, setPc] = useState(0);
  const [registers, setRegisters] = useState<number[]>([]);
  const [output, setOutput] = useState<string>('');
  const [program, setProgram] = useState<string>('');

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
    setProgram('addi x1, x0, 5\\naddi x2, x0, 10\\nadd x3, x1, x2\\necall');
    setOutput('Loaded example: add 5 + 10');
    updateState();
  };

  const handleRun = () => {
    const cycles = cpu.run(10000);
    setOutput(`Executed ${cycles} cycles. ${cpu.halted ? 'CPU halted.' : ''}`);
    updateState();
  };

  return (
    <div style={{ fontFamily: 'monospace', padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Wire-RISCV Emulator</h1>
      <p style={{ color: '#666' }}>RISC-V RV32I CPU Emulator</p>

      <div style={{ marginBottom: '20px' }}>
        <button onClick={handleLoadExample} style={{ marginRight: '10px' }}>
          Load Example
        </button>
        <button onClick={handleStep} style={{ marginRight: '10px' }}>
          Step
        </button>
        <button onClick={handleRun} style={{ marginRight: '10px' }}>
          Run
        </button>
        <button onClick={handleReset}>Reset</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <h3>Registers</h3>
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

        <div>
          <h3>Program</h3>
          <pre
            style={{
              backgroundColor: '#1a1a1a',
              color: '#fff',
              padding: '10px',
              fontSize: '12px',
              height: '150px',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
            }}
          >
            {program || '(No program loaded)'}
          </pre>

          <h3>Output</h3>
          <pre
            style={{
              backgroundColor: '#1a1a1a',
              color: '#0f0',
              padding: '10px',
              fontSize: '12px',
              height: '100px',
              overflow: 'auto',
            }}
          >
            {output || '(No output)'}
          </pre>
        </div>
      </div>

      <div style={{ marginTop: '20px', color: '#666', fontSize: '12px' }}>
        <p>
          This is a basic RV32I (RISC-V 32-bit Integer) emulator. It supports the base integer instruction set
          including: LUI, AUIPC, JAL, JALR, branches (BEQ, BNE, BLT, BGE, BLTU, BGEU), loads (LB, LH, LW, LBU, LHU),
          stores (SB, SH, SW), and ALU operations (ADD, SUB, SLL, SLT, SLTU, XOR, SRL, SRA, OR, AND).
        </p>
      </div>
    </div>
  );
}
