// JavaScript evaluation kernel for NAND/DFF simulation
// This is the fallback when WASM is not available

import { LevelizedNetlist, NandGate, Dff, BehavioralModule, SignalId } from '../types/netlist.js';
import { SignalStore } from './signal-store.js';

export class JSKernel {
  private netlist: LevelizedNetlist;
  private store: SignalStore;

  constructor(netlist: LevelizedNetlist, store: SignalStore) {
    this.netlist = netlist;
    this.store = store;
  }

  /**
   * Evaluate all combinational logic (NAND gates + behavioral modules)
   */
  evaluateCombinational(): void {
    // First evaluate NAND gates in level order
    for (const level of this.netlist.levels) {
      for (const gate of level) {
        this.evaluateNand(gate);
      }
    }

    // Then evaluate behavioral modules
    if (this.netlist.behavioralModules.length > 0 && this.netlist.compiledBehaviors) {
      for (const mod of this.netlist.behavioralModules) {
        this.evaluateBehavioralModule(mod);
      }
    }
  }

  /**
   * Evaluate a behavioral module by running its compiled function
   */
  private evaluateBehavioralModule(mod: BehavioralModule): void {
    const func = this.netlist.compiledBehaviors?.get(mod.moduleName);
    if (!func) {
      return; // No compiled function available
    }

    // Pack input signals into a record
    const inputs: Record<string, number> = {};
    for (const [name, signalIds] of mod.inputs) {
      const width = mod.inputWidths.get(name) || 1;
      if (width === 1) {
        // Single-bit input
        inputs[name] = this.store.read(signalIds as SignalId);
      } else {
        // Multi-bit input: pack bits into a number
        const bits = signalIds as SignalId[];
        let value = 0;
        for (let i = 0; i < bits.length; i++) {
          value |= this.store.read(bits[i]) << i;
        }
        inputs[name] = value;
      }
    }

    // Run the behavioral function (pass modules registry for composable behaviors)
    const outputs = func(inputs, undefined, this.netlist.compiledBehaviors);

    // Unpack output values to signals
    for (const [name, signalIds] of mod.outputs) {
      const value = outputs[name] || 0;
      const width = mod.outputWidths.get(name) || 1;

      if (width === 1) {
        // Single-bit output
        this.store.write(signalIds as SignalId, value & 1);
      } else {
        // Multi-bit output: unpack bits
        const bits = signalIds as SignalId[];
        for (let i = 0; i < bits.length; i++) {
          this.store.write(bits[i], (value >> i) & 1);
        }
      }
    }
  }

  /**
   * Evaluate a single NAND gate
   */
  private evaluateNand(gate: NandGate): void {
    const a = this.store.read(gate.in1);
    const b = this.store.read(gate.in2);
    // NAND: output is 0 only when both inputs are 1
    const result = (a & b) ^ 1;
    this.store.write(gate.out, result);
  }

  /**
   * Update all DFFs (clock edge)
   * Samples D input and updates Q output
   */
  updateSequential(): void {
    // First, sample all D inputs (before any Q updates)
    const dValues: number[] = [];
    for (const dff of this.netlist.dffs) {
      dValues.push(this.store.read(dff.d));
    }

    // Then, update all Q outputs
    for (let i = 0; i < this.netlist.dffs.length; i++) {
      this.store.write(this.netlist.dffs[i].q, dValues[i]);
    }
  }

  /**
   * Run a single simulation cycle
   * 1. Evaluate combinational logic
   * 2. Update DFFs at clock edge
   */
  cycle(): void {
    this.evaluateCombinational();
    this.updateSequential();
    this.store.incrementCycle();
  }

  /**
   * Run multiple simulation cycles
   */
  run(cycles: number): void {
    for (let i = 0; i < cycles; i++) {
      this.cycle();
    }
  }

  /**
   * Run simulation and call callback after each cycle
   */
  runWithCallback(cycles: number, callback: (cycle: number) => void): void {
    for (let i = 0; i < cycles; i++) {
      this.cycle();
      callback(this.store.getCycle());
    }
  }

  /**
   * Get statistics about the last evaluation
   */
  getStats(): {
    gatesEvaluated: number;
    dffsUpdated: number;
  } {
    return {
      gatesEvaluated: this.netlist.nandGates.length,
      dffsUpdated: this.netlist.dffs.length,
    };
  }
}

/**
 * Optimized batch evaluation for maximum performance
 * Inlines the evaluation loop to avoid function call overhead
 */
export function evaluateBatch(
  view: Uint32Array,
  gates: NandGate[],
  headerOffset: number
): void {
  for (const gate of gates) {
    // Read inputs
    const in1Word = headerOffset + Math.floor(gate.in1 / 32);
    const in1Bit = gate.in1 % 32;
    const a = (view[in1Word] >> in1Bit) & 1;

    const in2Word = headerOffset + Math.floor(gate.in2 / 32);
    const in2Bit = gate.in2 % 32;
    const b = (view[in2Word] >> in2Bit) & 1;

    // NAND
    const result = (a & b) ^ 1;

    // Write output
    const outWord = headerOffset + Math.floor(gate.out / 32);
    const outBit = gate.out % 32;

    if (result) {
      view[outWord] |= 1 << outBit;
    } else {
      view[outWord] &= ~(1 << outBit);
    }
  }
}

/**
 * Batch update DFFs
 */
export function updateDffsBatch(
  view: Uint32Array,
  dffs: Dff[],
  headerOffset: number
): void {
  // Sample all D inputs first
  const dValues: number[] = new Array(dffs.length);
  for (let i = 0; i < dffs.length; i++) {
    const dWord = headerOffset + Math.floor(dffs[i].d / 32);
    const dBit = dffs[i].d % 32;
    dValues[i] = (view[dWord] >> dBit) & 1;
  }

  // Update all Q outputs
  for (let i = 0; i < dffs.length; i++) {
    const qWord = headerOffset + Math.floor(dffs[i].q / 32);
    const qBit = dffs[i].q % 32;

    if (dValues[i]) {
      view[qWord] |= 1 << qBit;
    } else {
      view[qWord] &= ~(1 << qBit);
    }
  }
}
