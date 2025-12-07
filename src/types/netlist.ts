// Netlist types for the flattened circuit representation
// After elaboration, we only have NAND gates, DFFs, and intrinsics

export type SignalId = number;
export type GateId = number;

// A signal is a single bit wire in the circuit
export interface Signal {
  id: SignalId;
  name: string;         // Original name for debugging
  width: number;        // Always 1 for flattened signals
  isPrimaryInput: boolean;
  isPrimaryOutput: boolean;
  isDffOutput: boolean; // True if this is a DFF Q output (level 0)
}

// A NAND gate with two inputs and one output
export interface NandGate {
  id: GateId;
  in1: SignalId;
  in2: SignalId;
  out: SignalId;
  level: number;        // Assigned during levelization
}

// A D flip-flop with data input, clock, and output
export interface Dff {
  id: GateId;
  d: SignalId;          // Data input
  clk: SignalId;        // Clock input
  q: SignalId;          // Output
  initialValue: 0 | 1;  // Initial value on reset
}

// Intrinsic module types
export type IntrinsicType = 'ram' | 'rom' | 'input' | 'output';

// Registry of compiled behavioral modules for inter-module calls
export type BehavioralModules = Map<string, BehavioralFunction>;

// Compiled behavioral function signature
// Now takes a third argument: modules registry for calling other behaviors
export type BehavioralFunction = (
  inputs: Record<string, number>,
  state?: Record<string, number>,
  modules?: BehavioralModules
) => Record<string, number>;

// Behavioral module - uses compiled TypeScript function instead of NAND gates
export interface BehavioralModule {
  id: number;
  name: string;           // Instance name (e.g., "alu_0")
  moduleName: string;     // Module definition name (e.g., "alu8")
  // Signal mappings: parameter/output name -> SignalId(s)
  inputs: Map<string, SignalId | SignalId[]>;   // Single bit or multi-bit input
  outputs: Map<string, SignalId | SignalId[]>;  // Single bit or multi-bit output
  // Width information for packing/unpacking
  inputWidths: Map<string, number>;
  outputWidths: Map<string, number>;
}

export interface Intrinsic {
  id: GateId;
  type: IntrinsicType;
  name: string;         // Instance name
  config: IntrinsicConfig;
  inputs: Map<string, SignalId>;
  outputs: Map<string, SignalId>;
}

export type IntrinsicConfig =
  | RamConfig
  | RomConfig
  | InputConfig
  | OutputConfig;

export interface RamConfig {
  type: 'ram';
  addressBits: number;  // e.g., 8 for 256 words
  dataBits: number;     // e.g., 8 for 8-bit words
}

export interface RomConfig {
  type: 'rom';
  addressBits: number;
  dataBits: number;
  data: number[];       // Initial ROM contents
}

export interface InputConfig {
  type: 'input';
  name: string;         // External input name
  bits: number;
}

export interface OutputConfig {
  type: 'output';
  name: string;         // External output name
  bits: number;
}

// The complete flattened netlist
export interface Netlist {
  name: string;

  // All signals (wires)
  signals: Signal[];
  signalMap: Map<string, SignalId>;

  // Primary I/O
  primaryInputs: SignalId[];
  primaryOutputs: SignalId[];
  clockSignal: SignalId | null;

  // Gates and sequential elements
  nandGates: NandGate[];
  dffs: Dff[];
  intrinsics: Intrinsic[];
  behavioralModules: BehavioralModule[];

  // Statistics
  totalSignals: number;
  totalNands: number;
  totalDffs: number;
}

// Levelized netlist ready for simulation
export interface LevelizedNetlist extends Netlist {
  // Gates organized by level for evaluation order
  levels: NandGate[][];
  maxLevel: number;

  // Signal allocation for SharedArrayBuffer
  signalBufferSize: number;  // In uint32 words

  // Compiled behavioral functions for fast JS simulation
  // Maps module name -> compiled function
  compiledBehaviors?: Map<string, BehavioralFunction>;

  // Module definitions for behavioral modules (needed for WASM compilation)
  // Maps module name -> module declaration AST
  behavioralModuleDefs?: Map<string, import('./ast.js').ModuleDecl>;
}

// Helper to create an empty netlist
export function createNetlist(name: string): Netlist {
  return {
    name,
    signals: [],
    signalMap: new Map(),
    primaryInputs: [],
    primaryOutputs: [],
    clockSignal: null,
    nandGates: [],
    dffs: [],
    intrinsics: [],
    behavioralModules: [],
    totalSignals: 0,
    totalNands: 0,
    totalDffs: 0,
  };
}
