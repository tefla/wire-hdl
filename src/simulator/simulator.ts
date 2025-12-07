// Main simulator controller

import { LevelizedNetlist, SignalId } from '../types/netlist.js';
import { parse } from '../parser/index.js';
import { elaborate } from '../elaborator/index.js';
import { levelize, getStats } from '../circuit/index.js';
import { SignalStore } from './signal-store.js';
import { JSKernel } from './js-kernel.js';

export interface SimulatorOptions {
  useSharedMemory?: boolean;
  optimize?: boolean;
}

export interface WaveformSample {
  cycle: number;
  values: Map<string, number>;
}

export class Simulator {
  private netlist: LevelizedNetlist;
  private store: SignalStore;
  private kernel: JSKernel;

  // Waveform recording
  private recording: boolean = false;
  private waveform: WaveformSample[] = [];
  private watchedSignals: Map<string, SignalId> = new Map();

  constructor(netlist: LevelizedNetlist, options: SimulatorOptions = {}) {
    this.netlist = netlist;
    this.store = new SignalStore(netlist, options.useSharedMemory);
    this.kernel = new JSKernel(netlist, this.store);
  }

  /**
   * Create a simulator from Wire HDL source code
   */
  static fromSource(
    source: string,
    topModule: string,
    options: SimulatorOptions = {}
  ): Simulator {
    const program = parse(source);
    const netlist = elaborate(program, topModule);
    // Pass program to levelize so it can compile behavioral functions
    const levelized = levelize(netlist, program);
    return new Simulator(levelized, options);
  }

  /**
   * Create a simulator from multiple Wire HDL source files
   */
  static fromSources(
    sources: string[],
    topModule: string,
    options: SimulatorOptions = {}
  ): Simulator {
    // Concatenate all sources
    const combined = sources.join('\n\n');
    return Simulator.fromSource(combined, topModule, options);
  }

  /**
   * Set a primary input value
   */
  setInput(name: string, value: number): void {
    const sigId = this.netlist.signalMap.get(name);
    if (sigId === undefined) {
      throw new Error(`Unknown input: ${name}`);
    }
    this.store.write(sigId, value);
  }

  /**
   * Set multiple input bits
   */
  setInputBits(name: string, value: number, width: number): void {
    for (let i = 0; i < width; i++) {
      const bitName = `${name}[${i}]`;
      const sigId = this.netlist.signalMap.get(bitName);
      if (sigId !== undefined) {
        this.store.write(sigId, (value >> i) & 1);
      }
    }
  }

  /**
   * Get a primary output value
   */
  getOutput(name: string): number {
    const sigId = this.netlist.signalMap.get(name);
    if (sigId === undefined) {
      throw new Error(`Unknown output: ${name}`);
    }
    return this.store.read(sigId);
  }

  /**
   * Get multiple output bits as a number
   */
  getOutputBits(name: string, width: number): number {
    let value = 0;
    for (let i = 0; i < width; i++) {
      const bitName = `${name}[${i}]`;
      const sigId = this.netlist.signalMap.get(bitName);
      if (sigId !== undefined) {
        value |= this.store.read(sigId) << i;
      }
    }
    return value;
  }

  /**
   * Get any signal value by name
   */
  getSignal(name: string): number {
    const sigId = this.netlist.signalMap.get(name);
    if (sigId === undefined) {
      throw new Error(`Unknown signal: ${name}`);
    }
    return this.store.read(sigId);
  }

  /**
   * Run a single simulation cycle
   */
  step(): void {
    this.kernel.cycle();

    if (this.recording) {
      this.recordWaveform();
    }
  }

  /**
   * Run multiple simulation cycles
   */
  run(cycles: number): void {
    for (let i = 0; i < cycles; i++) {
      this.step();
    }
  }

  /**
   * Run simulation at target speed with periodic yields
   * Returns a promise that resolves when done
   */
  async runAsync(
    cycles: number,
    batchSize: number = 1000,
    onProgress?: (cycle: number) => void
  ): Promise<void> {
    let remaining = cycles;

    while (remaining > 0) {
      const batch = Math.min(remaining, batchSize);
      this.run(batch);
      remaining -= batch;

      if (onProgress) {
        onProgress(cycles - remaining);
      }

      // Yield to event loop
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  /**
   * Get current cycle count
   */
  getCycle(): number {
    return this.store.getCycle();
  }

  /**
   * Reset simulation to cycle 0
   */
  reset(): void {
    // Reset all signals to 0
    for (const sig of this.netlist.signals) {
      this.store.write(sig.id, 0);
    }

    // Reset cycle counter (by recreating store)
    this.store = new SignalStore(this.netlist, false);
    this.kernel = new JSKernel(this.netlist, this.store);
    this.waveform = [];
  }

  // Waveform recording

  /**
   * Start recording waveform for specified signals
   */
  startRecording(signalNames: string[]): void {
    this.watchedSignals.clear();
    for (const name of signalNames) {
      const sigId = this.netlist.signalMap.get(name);
      if (sigId !== undefined) {
        this.watchedSignals.set(name, sigId);
      }
    }
    this.waveform = [];
    this.recording = true;

    // Record initial state
    this.recordWaveform();
  }

  /**
   * Stop recording waveform
   */
  stopRecording(): WaveformSample[] {
    this.recording = false;
    return this.waveform;
  }

  private recordWaveform(): void {
    const values = new Map<string, number>();
    for (const [name, sigId] of this.watchedSignals) {
      values.set(name, this.store.read(sigId));
    }
    this.waveform.push({
      cycle: this.store.getCycle(),
      values,
    });
  }

  /**
   * Export waveform to VCD format
   */
  exportVCD(signalNames?: string[]): string {
    const signals =
      signalNames ||
      Array.from(this.netlist.signalMap.keys()).filter(
        (n) => !n.includes('nand_') && !n.includes('dff_')
      );

    const lines: string[] = [];

    // Header
    lines.push('$timescale 1ns $end');
    lines.push('$scope module top $end');

    // Declare signals
    const varIds = new Map<string, string>();
    let varId = 33; // ASCII '!'
    for (const name of signals) {
      const id = String.fromCharCode(varId++);
      varIds.set(name, id);
      lines.push(`$var wire 1 ${id} ${name} $end`);
    }

    lines.push('$upscope $end');
    lines.push('$enddefinitions $end');

    // Dump initial values
    lines.push('#0');
    lines.push('$dumpvars');
    for (const name of signals) {
      const sigId = this.netlist.signalMap.get(name);
      if (sigId !== undefined) {
        const val = this.store.read(sigId);
        lines.push(`${val}${varIds.get(name)}`);
      }
    }
    lines.push('$end');

    // Dump waveform changes
    for (const sample of this.waveform) {
      lines.push(`#${sample.cycle * 10}`);
      for (const [name, val] of sample.values) {
        if (varIds.has(name)) {
          lines.push(`${val}${varIds.get(name)}`);
        }
      }
    }

    return lines.join('\n');
  }

  // Statistics and debugging

  /**
   * Get simulation statistics
   */
  getStats(): {
    totalGates: number;
    totalDffs: number;
    maxLevel: number;
    gatesPerLevel: number[];
    avgFanout: number;
  } {
    return getStats(this.netlist);
  }

  /**
   * Get the netlist for inspection
   */
  getNetlist(): LevelizedNetlist {
    return this.netlist;
  }

  /**
   * List all available signals
   */
  listSignals(): string[] {
    return Array.from(this.netlist.signalMap.keys());
  }

  /**
   * List primary inputs
   */
  listInputs(): string[] {
    return this.netlist.primaryInputs.map(
      (id) => this.netlist.signals[id].name
    );
  }

  /**
   * List primary outputs
   */
  listOutputs(): string[] {
    return this.netlist.primaryOutputs.map(
      (id) => this.netlist.signals[id].name
    );
  }
}
