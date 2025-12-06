// Wire HDL - High-performance browser-based HDL simulator
// Built on NAND and DFF primitives

export { parse, tokenize, type Token, type TokenType } from './parser/index.js';
export { elaborate } from './elaborator/index.js';
export { levelize, detectLoops, getStats } from './circuit/index.js';
export {
  Simulator,
  SignalStore,
  JSKernel,
  type SimulatorOptions,
  type WaveformSample,
} from './simulator/index.js';
export {
  compileToWasm,
  compileToWasmOptimized,
  type CompiledCircuit,
} from './compiler/index.js';

export {
  optimize,
  estimateOptimization,
  type OptimizationResult,
  type OptimizationStats,
  type OptimizationOptions,
} from './optimizer/optimizer.js';

// Re-export types
export type {
  Program,
  ModuleDecl,
  Param,
  Output,
  Statement,
  Expr,
} from './types/ast.js';

export type {
  Netlist,
  LevelizedNetlist,
  Signal,
  NandGate,
  Dff,
  SignalId,
  GateId,
} from './types/netlist.js';

// System integration
export {
  Computer,
  Memory,
  Disk,
  MEM,
  DISK,
  DISK_STATUS,
  DISK_CMD,
  type ComputerConfig,
  type ComputerState,
  type MemoryConfig,
  type IOHandlers,
} from './system/index.js';

// Display
export {
  Display,
  DISPLAY_COLS,
  DISPLAY_ROWS,
  DISPLAY_WIDTH,
  DISPLAY_HEIGHT,
  CHAR_WIDTH,
  CHAR_HEIGHT,
  type DisplayConfig,
} from './display/index.js';

// Assembler
export {
  assemble,
  createRomImage,
  OPCODES,
  HELLO_WORLD,
  COUNTER,
  type AssemblerOutput,
} from './assembler/stage0.js';

// BIOS
export {
  assembleBios,
  getBiosRom,
  BIOS,
  BIOS_SOURCE,
} from './assembler/bios.js';

// Monitor/OS
export {
  assembleMonitor,
  getMonitorRom,
  MONITOR,
  MONITOR_SOURCE,
} from './assembler/monitor.js';
