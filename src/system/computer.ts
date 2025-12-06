// Computer System Integration
// Connects the CPU to memory and peripherals

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parse, elaborate, levelize, optimize, compileToWasmOptimized, type CompiledCircuit, type LevelizedNetlist } from '../index.js';
import { Memory, IOHandlers, MEM } from './memory.js';
import { Disk, DISK_CMD } from './disk.js';

// Wire source files needed for CPU
const CPU_SOURCES = [
  'gates.wire',
  'arithmetic.wire',
  'registers.wire',
  'mux8.wire',
  'mux4way8.wire',
  'mux8way8.wire',
  'mux16.wire',
  'adder16.wire',
  'inc16.wire',
  'register16.wire',
  'decoder.wire',
  'alu8.wire',
  'pc.wire',
  'cpu_minimal.wire',
];

export interface ComputerConfig {
  wireDir?: string;
  optimize?: boolean;
  maxConeInputs?: number;
}

export interface ComputerState {
  pc: number;
  a: number;
  x: number;
  y: number;
  sp: number;
  flags: number;
  state: number;
  halted: boolean;
  cycles: number;
}

export class Computer {
  private circuit: CompiledCircuit;
  private netlist: LevelizedNetlist;
  private memory: Memory;
  private disk: Disk;

  // Signal IDs for CPU interface
  private clkId: number;
  private resetId: number;
  private dataInIds: number[] = [];
  private addrIds: number[] = [];
  private dataOutIds: number[] = [];
  private memWriteId: number;
  private haltedId: number;
  private pcIds: number[] = [];
  private aIds: number[] = [];
  private xIds: number[] = [];
  private yIds: number[] = [];
  private spIds: number[] = [];
  private flagsIds: number[] = [];
  private stateIds: number[] = [];

  // Keyboard buffer
  private keyBuffer: number[] = [];

  // Execution state
  private cycleCount: number = 0;
  private running: boolean = false;

  // Event handlers
  private onVideoUpdate?: (offset: number, value: number) => void;
  private onSerialOutput?: (char: number) => void;
  private onHalt?: () => void;

  constructor(config: ComputerConfig = {}) {
    const wireDir = config.wireDir || './wire';

    // Load and parse all CPU source files
    const sources = CPU_SOURCES.map(file => {
      const path = join(wireDir, file);
      if (!existsSync(path)) {
        throw new Error(`Missing wire file: ${path}`);
      }
      return readFileSync(path, 'utf-8');
    });

    const allSource = sources.join('\n');
    const program = parse(allSource);
    const netlist = elaborate(program, 'cpu_minimal');

    // Optimize by default (can disable with optimize: false)
    let finalNetlist = netlist;
    if (config.optimize !== false) {
      const result = optimize(netlist, {
        maxConeInputs: config.maxConeInputs ?? 10,
        minSavingsPercent: 5,
        verbose: false,
      });
      finalNetlist = result.netlist;
    }

    this.netlist = levelize(finalNetlist);
    this.circuit = compileToWasmOptimized(this.netlist);

    // Initialize memory with I/O handlers
    const handlers: IOHandlers = {
      onVideoWrite: (offset, value) => {
        if (this.onVideoUpdate) {
          this.onVideoUpdate(offset, value);
        }
      },
      onKeyboardRead: () => this.readKey(),
      hasKeyAvailable: () => this.keyBuffer.length > 0,
      onDiskCommand: (cmd) => this.executeDiskCommand(cmd),
      getDiskStatus: () => this.disk.getStatus(),
      onSerialWrite: (value) => {
        if (this.onSerialOutput) {
          this.onSerialOutput(value);
        }
      },
    };

    this.memory = new Memory({}, handlers);

    // Initialize disk with memory access
    this.disk = new Disk(
      (addr) => this.memory.read(addr),
      (addr, value) => this.memory.write(addr, value)
    );

    // Find signal IDs for CPU interface
    this.clkId = this.getSignalId('clk');
    this.resetId = this.getSignalId('reset');
    this.memWriteId = this.getSignalId('mem_write');
    this.haltedId = this.getSignalId('halted');

    for (let i = 0; i < 8; i++) {
      this.dataInIds.push(this.getSignalId(`data_in[${i}]`));
      this.dataOutIds.push(this.getSignalId(`data_out[${i}]`));
      this.aIds.push(this.getSignalId(`a_out[${i}]`));
      this.xIds.push(this.getSignalId(`x_out[${i}]`));
      this.yIds.push(this.getSignalId(`y_out[${i}]`));
      this.spIds.push(this.getSignalId(`sp_out[${i}]`));
    }

    for (let i = 0; i < 16; i++) {
      this.addrIds.push(this.getSignalId(`addr[${i}]`));
      this.pcIds.push(this.getSignalId(`pc_out[${i}]`));
    }

    for (let i = 0; i < 4; i++) {
      this.flagsIds.push(this.getSignalId(`flags_out[${i}]`));
    }

    for (let i = 0; i < 5; i++) {
      this.stateIds.push(this.getSignalId(`state_out[${i}]`));
    }
  }

  private getSignalId(name: string): number {
    const id = this.netlist.signalMap.get(name);
    if (id === undefined) {
      throw new Error(`Signal not found: ${name}`);
    }
    return id;
  }

  private readBits(ids: number[]): number {
    let value = 0;
    for (let i = 0; i < ids.length; i++) {
      value |= this.circuit.getSignal(ids[i]) << i;
    }
    return value;
  }

  private writeBits(ids: number[], value: number): void {
    for (let i = 0; i < ids.length; i++) {
      this.circuit.setSignal(ids[i], (value >> i) & 1);
    }
  }

  /**
   * Load ROM image
   */
  loadRom(data: Uint8Array): void {
    this.memory.loadRom(data);
  }

  /**
   * Load program into RAM
   */
  loadProgram(data: Uint8Array, address: number = 0x0200): void {
    this.memory.loadRam(data, address);
  }

  /**
   * Get direct access to video RAM for rendering
   */
  getVideoRam(): Uint8Array {
    return this.memory.getVideoRam();
  }

  /**
   * Get the Memory controller
   */
  getMemory(): Memory {
    return this.memory;
  }

  /**
   * Get the Disk controller
   */
  getDisk(): Disk {
    return this.disk;
  }

  /**
   * Reset the computer
   */
  reset(): void {
    // Assert reset signal for a few cycles to enter reset state
    this.circuit.setSignal(this.resetId, 1);
    this.circuit.setSignal(this.clkId, 1);

    for (let i = 0; i < 3; i++) {
      this.step();
    }

    // Release reset - CPU will now progress through states 20->21->22->0
    this.circuit.setSignal(this.resetId, 0);

    // Run enough cycles to complete reset sequence
    for (let i = 0; i < 10; i++) {
      this.step();
    }

    this.cycleCount = 0;
  }

  /**
   * Execute one CPU cycle
   */
  step(): void {
    // Read the address bus and mem_write from CPU
    const addr = this.readBits(this.addrIds);
    const memWrite = this.circuit.getSignal(this.memWriteId);

    if (memWrite) {
      // CPU is writing to memory
      const dataOut = this.readBits(this.dataOutIds);
      this.memory.write(addr, dataOut);
    } else {
      // CPU is reading from memory - provide data_in
      const dataIn = this.memory.read(addr);
      this.writeBits(this.dataInIds, dataIn);
    }

    // Execute one clock cycle
    this.circuit.evaluate();
    this.cycleCount++;

    // Update tick counter
    this.memory.tick();

    // Check if halted
    if (this.circuit.getSignal(this.haltedId) && this.onHalt) {
      this.onHalt();
    }
  }

  /**
   * Run for a specified number of cycles
   */
  run(cycles: number): void {
    for (let i = 0; i < cycles; i++) {
      this.step();
      if (this.circuit.getSignal(this.haltedId)) {
        break;
      }
    }
  }

  /**
   * Run until halted or max cycles reached
   */
  runUntilHalt(maxCycles: number = 1000000): number {
    let cycles = 0;
    while (cycles < maxCycles) {
      this.step();
      cycles++;
      if (this.circuit.getSignal(this.haltedId)) {
        break;
      }
    }
    return cycles;
  }

  /**
   * Run at target speed with periodic yields (for browser)
   */
  async runAsync(
    targetHz: number = 1000000,
    batchSize: number = 10000,
    onProgress?: (state: ComputerState) => void
  ): Promise<void> {
    this.running = true;
    const cycleTimeMs = 1000 / targetHz;

    while (this.running) {
      const startTime = performance.now();

      // Run a batch of cycles
      for (let i = 0; i < batchSize && this.running; i++) {
        this.step();
        if (this.circuit.getSignal(this.haltedId)) {
          this.running = false;
          break;
        }
      }

      if (onProgress) {
        onProgress(this.getState());
      }

      // Calculate time to wait to maintain target speed
      const elapsed = performance.now() - startTime;
      const targetTime = batchSize * cycleTimeMs;
      const waitTime = Math.max(0, targetTime - elapsed);

      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        // At least yield to event loop
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  }

  /**
   * Stop async execution
   */
  stop(): void {
    this.running = false;
  }

  /**
   * Get current CPU state
   */
  getState(): ComputerState {
    return {
      pc: this.readBits(this.pcIds),
      a: this.readBits(this.aIds),
      x: this.readBits(this.xIds),
      y: this.readBits(this.yIds),
      sp: this.readBits(this.spIds),
      flags: this.readBits(this.flagsIds),
      state: this.readBits(this.stateIds),
      halted: this.circuit.getSignal(this.haltedId) === 1,
      cycles: this.cycleCount,
    };
  }

  /**
   * Queue a keyboard keypress
   */
  sendKey(ascii: number): void {
    this.keyBuffer.push(ascii & 0xFF);
  }

  /**
   * Send a string as keypresses
   */
  sendString(str: string): void {
    for (const char of str) {
      this.sendKey(char.charCodeAt(0));
    }
  }

  private readKey(): number {
    return this.keyBuffer.shift() ?? 0;
  }

  private executeDiskCommand(cmd: number): void {
    const sector = this.memory.getDiskSector();
    const bufferAddr = this.memory.getDiskBufferAddress();
    const count = this.memory.getDiskSectorCount();
    this.disk.executeCommand(cmd, sector, bufferAddr, count);
  }

  /**
   * Set callback for video RAM updates
   */
  onVideo(callback: (offset: number, value: number) => void): void {
    this.onVideoUpdate = callback;
  }

  /**
   * Set callback for serial output
   */
  onSerial(callback: (char: number) => void): void {
    this.onSerialOutput = callback;
  }

  /**
   * Set callback for CPU halt
   */
  onHalted(callback: () => void): void {
    this.onHalt = callback;
  }

  /**
   * Get netlist stats
   */
  getStats(): { nands: number; dffs: number; levels: number } {
    return {
      nands: this.netlist.nandGates.length,
      dffs: this.netlist.dffs.length,
      levels: this.netlist.levels.length,
    };
  }
}
