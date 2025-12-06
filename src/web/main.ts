// Wire-HDL Computer Web App
// NOTE: Import directly from modules to avoid pulling in Node.js 'fs' via index.js

import { BrowserComputer, type ComputerState } from './browser-computer.js';
import { assembleMonitor } from '../assembler/monitor.js';

// Terminal settings
const COLS = 80;
const ROWS = 25;

class Terminal {
  private buffer: string[];
  private cursorX: number = 0;
  private cursorY: number = 0;
  private element: HTMLElement;

  constructor(element: HTMLElement) {
    this.element = element;
    this.buffer = Array(ROWS).fill('').map(() => ' '.repeat(COLS));
    this.render();
  }

  clear(): void {
    this.buffer = Array(ROWS).fill('').map(() => ' '.repeat(COLS));
    this.cursorX = 0;
    this.cursorY = 0;
    this.render();
  }

  writeChar(char: number): void {
    if (char === 0x0D || char === 0x0A) {
      // Carriage return / newline
      this.cursorX = 0;
      this.cursorY++;
      if (this.cursorY >= ROWS) {
        this.scroll();
        this.cursorY = ROWS - 1;
      }
    } else if (char === 0x08) {
      // Backspace
      if (this.cursorX > 0) {
        this.cursorX--;
        this.setChar(this.cursorX, this.cursorY, ' ');
      }
    } else if (char >= 0x20 && char < 0x7F) {
      // Printable character
      this.setChar(this.cursorX, this.cursorY, String.fromCharCode(char));
      this.cursorX++;
      if (this.cursorX >= COLS) {
        this.cursorX = 0;
        this.cursorY++;
        if (this.cursorY >= ROWS) {
          this.scroll();
          this.cursorY = ROWS - 1;
        }
      }
    }
    this.render();
  }

  private setChar(x: number, y: number, char: string): void {
    if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
      const row = this.buffer[y];
      this.buffer[y] = row.substring(0, x) + char + row.substring(x + 1);
    }
  }

  private scroll(): void {
    this.buffer.shift();
    this.buffer.push(' '.repeat(COLS));
  }

  render(): void {
    // Add cursor
    const display = this.buffer.map((row, y) => {
      if (y === this.cursorY && this.cursorX < COLS) {
        return row.substring(0, this.cursorX) + '\u2588' + row.substring(this.cursorX + 1);
      }
      return row;
    });
    this.element.textContent = display.join('\n');
  }
}

// Initialize app
async function init() {
  const screenEl = document.getElementById('screen')!;
  const statsEl = document.getElementById('stats')!;
  const statusEl = document.getElementById('status')!;
  const resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;
  const runBtn = document.getElementById('runBtn') as HTMLButtonElement;
  const stepBtn = document.getElementById('stepBtn') as HTMLButtonElement;
  const inputEl = document.getElementById('input') as HTMLInputElement;

  statusEl.textContent = 'Compiling CPU...';

  // Create terminal
  const terminal = new Terminal(screenEl);

  // Create computer (this may take a moment)
  let computer: BrowserComputer;
  try {
    computer = new BrowserComputer();
  } catch (err) {
    statusEl.textContent = `Error: ${err}`;
    console.error(err);
    return;
  }

  const stats = computer.getStats();
  statsEl.textContent = `${stats.nands.toLocaleString()} NANDs, ${stats.dffs} DFFs, ${stats.levels} levels`;

  // Load monitor ROM
  const rom = assembleMonitor();
  computer.loadRom(rom);

  // Connect serial output to terminal
  computer.onSerial((char) => {
    terminal.writeChar(char);
  });

  // Track performance
  let lastCycles = 0;
  let lastTime = performance.now();

  function updateStatus() {
    const state = computer.getState();
    const now = performance.now();
    const elapsed = now - lastTime;
    const cyclesDelta = state.cycles - lastCycles;
    const speed = elapsed > 0 ? (cyclesDelta / elapsed * 1000 / 1000).toFixed(1) : '0';

    lastCycles = state.cycles;
    lastTime = now;

    const stateStr = state.halted ? 'HALTED' : (computer.isRunning() ? 'RUNNING' : 'STOPPED');
    statusEl.textContent = `${stateStr} | PC:$${state.pc.toString(16).padStart(4, '0').toUpperCase()} A:$${state.a.toString(16).padStart(2, '0').toUpperCase()} X:$${state.x.toString(16).padStart(2, '0').toUpperCase()} | ${speed}k cycles/sec`;
  }

  // Reset handler
  resetBtn.addEventListener('click', () => {
    computer.stop();
    terminal.clear();
    computer.reset();
    updateStatus();
  });

  // Run/Stop handler
  runBtn.addEventListener('click', () => {
    if (computer.isRunning()) {
      computer.stop();
      runBtn.textContent = 'Run';
    } else {
      runBtn.textContent = 'Stop';
      computer.runAsync(30000, 1000, (state) => {
        updateStatus();
      }).then(() => {
        runBtn.textContent = 'Run';
        updateStatus();
      });
    }
  });

  // Step handler
  stepBtn.addEventListener('click', () => {
    if (!computer.isRunning()) {
      computer.run(100);
      updateStatus();
    }
  });

  // Keyboard input
  inputEl.addEventListener('keydown', (e) => {
    if (!computer.isRunning()) return;

    if (e.key === 'Enter') {
      computer.sendKey(0x0D);
      e.preventDefault();
    } else if (e.key === 'Backspace') {
      computer.sendKey(0x08);
      e.preventDefault();
    } else if (e.key.length === 1) {
      computer.sendKey(e.key.charCodeAt(0));
      e.preventDefault();
    }
    inputEl.value = '';
  });

  // Keep input focused
  document.addEventListener('click', () => {
    inputEl.focus();
  });

  // Initial reset
  computer.reset();
  updateStatus();
  statusEl.textContent = 'Ready - Click Run to start';
}

init();
