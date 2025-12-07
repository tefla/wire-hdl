// Fast Simulator: Uses behavioral functions for high-speed simulation
//
// This simulator runs compiled behavioral code instead of gate-level simulation.
// It's designed for modules that have @behavior blocks, providing MHz-level
// performance compared to the ~33kHz NAND-gate simulation.

import { parse } from '../parser/parser.js';
import type { Program, ModuleDecl } from '../types/ast.js';
import { BehavioralCompiler, type BehavioralFunction } from '../compiler/behavioral-compiler.js';

export type SimulationMode = 'fast' | 'educational';

export interface FastSimulatorOptions {
  mode?: SimulationMode;
}

export interface ModuleState {
  inputs: Record<string, number>;
  outputs: Record<string, number>;
  registers: Record<string, number>;
}

// Fast simulator for behavioral modules
export class FastSimulator {
  private modules: Map<string, ModuleDecl> = new Map();
  private compiler: BehavioralCompiler = new BehavioralCompiler();
  private behavioralFunctions: Map<string, BehavioralFunction> = new Map();
  private state: ModuleState;
  private topModule: ModuleDecl;
  private mode: SimulationMode;

  constructor(program: Program, topModuleName: string, options: FastSimulatorOptions = {}) {
    this.mode = options.mode || 'fast';

    // Build module registry
    for (const mod of program.modules) {
      this.modules.set(mod.name, mod);
    }

    const top = this.modules.get(topModuleName);
    if (!top) {
      throw new Error(`Top module '${topModuleName}' not found`);
    }
    this.topModule = top;

    // Compile behavioral functions
    for (const mod of program.modules) {
      if (mod.behavior) {
        const func = this.compiler.compile(mod);
        if (func) {
          this.behavioralFunctions.set(mod.name, func);
        }
      }
    }

    // Check if top module has behavioral implementation
    if (this.mode === 'fast' && !this.behavioralFunctions.has(topModuleName)) {
      console.warn(`Warning: Top module '${topModuleName}' has no @behavior block, falling back to educational mode`);
      this.mode = 'educational';
    }

    // Initialize state
    this.state = {
      inputs: {},
      outputs: {},
      registers: {},
    };

    // Initialize inputs to 0
    for (const param of top.params) {
      this.state.inputs[param.name] = 0;
    }

    // Initialize outputs to 0
    for (const output of top.outputs) {
      this.state.outputs[output.name] = 0;
    }
  }

  static fromSource(source: string, topModule: string, options: FastSimulatorOptions = {}): FastSimulator {
    const program = parse(source);
    return new FastSimulator(program, topModule, options);
  }

  static fromSources(sources: string[], topModule: string, options: FastSimulatorOptions = {}): FastSimulator {
    const combined = sources.join('\n\n');
    return FastSimulator.fromSource(combined, topModule, options);
  }

  // Set a single-bit or multi-bit input
  setInput(name: string, value: number): void {
    this.state.inputs[name] = value;
  }

  // Get a single-bit or multi-bit output
  getOutput(name: string): number {
    return this.state.outputs[name] || 0;
  }

  // Get all outputs
  getOutputs(): Record<string, number> {
    return { ...this.state.outputs };
  }

  // Get all inputs
  getInputs(): Record<string, number> {
    return { ...this.state.inputs };
  }

  // Run one cycle of simulation
  step(): void {
    if (this.mode === 'fast') {
      this.stepBehavioral();
    } else {
      throw new Error('Educational mode not implemented in FastSimulator - use regular Simulator');
    }
  }

  private stepBehavioral(): void {
    const func = this.behavioralFunctions.get(this.topModule.name);
    if (!func) {
      throw new Error(`No behavioral function for module '${this.topModule.name}'`);
    }

    // Run the behavioral function with current inputs
    const result = func(this.state.inputs, this.state.registers);

    // Update outputs
    this.state.outputs = result;
  }

  // Run multiple cycles
  run(cycles: number): void {
    for (let i = 0; i < cycles; i++) {
      this.step();
    }
  }

  // Get current simulation mode
  getMode(): SimulationMode {
    return this.mode;
  }

  // Check if a module has behavioral implementation
  hasBehavioral(moduleName: string): boolean {
    return this.behavioralFunctions.has(moduleName);
  }
}

// Create a fast simulator from source code
export function createFastSimulator(
  source: string,
  topModule: string,
  options: FastSimulatorOptions = {}
): FastSimulator {
  return FastSimulator.fromSource(source, topModule, options);
}
