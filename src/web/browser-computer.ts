// Browser-compatible Computer System
// Uses bundled wire files instead of filesystem
// NOTE: Import directly from modules to avoid pulling in Node.js 'fs' via index.js

import { parse } from '../parser/index.js';
import { elaborate } from '../elaborator/index.js';
import { levelize } from '../circuit/index.js';
import { optimize } from '../optimizer/optimizer.js';
import { compileToWasmOptimized, type CompiledCircuit } from '../compiler/index.js';
import type { LevelizedNetlist } from '../types/netlist.js';
import { Memory, type IOHandlers } from '../system/memory.js';
import { Disk } from '../system/disk.js';
import { getCpuSource } from '../vfs/bundled-wire-files.js';

export interface BrowserComputerConfig {
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

export class BrowserComputer {
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

  constructor(config: BrowserComputerConfig = {}) {
    // Load CPU from bundled wire files
    const allSource = getCpuSource();
    const program = parse(allSource);
    const netlist = elaborate(program, 'cpu_minimal');

    // Optionally optimize
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

    // Initialize disk
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

  loadRom(data: Uint8Array): void {
    this.memory.loadRom(data);
  }

  loadProgram(data: Uint8Array, address: number = 0x0200): void {
    this.memory.loadRam(data, address);
  }

  getVideoRam(): Uint8Array {
    return this.memory.getVideoRam();
  }

  getMemory(): Memory {
    return this.memory;
  }

  getDisk(): Disk {
    return this.disk;
  }

  reset(): void {
    this.circuit.setSignal(this.resetId, 1);
    this.circuit.setSignal(this.clkId, 1);

    for (let i = 0; i < 3; i++) {
      this.step();
    }

    this.circuit.setSignal(this.resetId, 0);

    for (let i = 0; i < 10; i++) {
      this.step();
    }

    this.cycleCount = 0;
  }

  step(): void {
    const addr = this.readBits(this.addrIds);
    const memWrite = this.circuit.getSignal(this.memWriteId);

    if (memWrite) {
      const dataOut = this.readBits(this.dataOutIds);
      this.memory.write(addr, dataOut);
    } else {
      const dataIn = this.memory.read(addr);
      this.writeBits(this.dataInIds, dataIn);
    }

    this.circuit.evaluate();
    this.cycleCount++;
    this.memory.tick();

    if (this.circuit.getSignal(this.haltedId) && this.onHalt) {
      this.onHalt();
    }
  }

  run(cycles: number): void {
    for (let i = 0; i < cycles; i++) {
      this.step();
      if (this.circuit.getSignal(this.haltedId)) {
        break;
      }
    }
  }

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

  async runAsync(
    targetHz: number = 30000,
    batchSize: number = 1000,
    onProgress?: (state: ComputerState) => void
  ): Promise<void> {
    this.running = true;
    const cycleTimeMs = 1000 / targetHz;

    while (this.running) {
      const startTime = performance.now();

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

      const elapsed = performance.now() - startTime;
      const targetTime = batchSize * cycleTimeMs;
      const waitTime = Math.max(0, targetTime - elapsed);

      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  }

  stop(): void {
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

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

  sendKey(ascii: number): void {
    this.keyBuffer.push(ascii & 0xFF);
  }

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

  onVideo(callback: (offset: number, value: number) => void): void {
    this.onVideoUpdate = callback;
  }

  onSerial(callback: (char: number) => void): void {
    this.onSerialOutput = callback;
  }

  onHalted(callback: () => void): void {
    this.onHalt = callback;
  }

  getStats(): { nands: number; dffs: number; levels: number } {
    return {
      nands: this.netlist.nandGates.length,
      dffs: this.netlist.dffs.length,
      levels: this.netlist.levels.length,
    };
  }
}
