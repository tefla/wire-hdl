// WASM Code Generator using Binaryen
// Generates circuit-specific WASM for maximum performance

import binaryen from 'binaryen';
import { LevelizedNetlist } from '../types/netlist.js';
import { generateInlinedBehavioral } from './behavioral-wasm-compiler.js';

export interface CompiledCircuit {
  wasmModule: WebAssembly.Module;
  wasmInstance: WebAssembly.Instance;
  memory: WebAssembly.Memory;
  evaluate: () => void;
  setSignal: (id: number, value: number) => void;
  getSignal: (id: number) => number;
  runCycles: (count: number) => void;
  // For hybrid behavioral/structural simulation
  evaluateBehavioral?: () => void;
  // Split evaluation for behavioral interleaving (if behavioral modules present)
  evaluateComb?: () => void;      // Evaluate combinational logic only
  evaluateDff?: () => void;       // Sample D, update Q
  hasBehavioral?: boolean;        // True if behavioral modules need evaluation
}

/**
 * Compile a levelized netlist to optimized WASM
 *
 * The generated WASM:
 * - Has all gate connections baked in as constants (no array lookups)
 * - Uses bit-packed signals (32 signals per i32 word)
 * - Evaluates gates in levelized order
 */
export function compileToWasm(netlist: LevelizedNetlist): CompiledCircuit {
  const mod = new binaryen.Module();

  // Calculate memory layout
  const numSignals = netlist.signals.length;
  const signalWords = Math.ceil(numSignals / 32);
  const memoryPages = Math.ceil((signalWords * 4 + 1024) / 65536); // 64KB pages

  // Import memory (shared with JS)
  // Note: Do NOT call setMemory after addMemoryImport - it overwrites the import!
  mod.addMemoryImport('0', 'env', 'memory');

  // Generate helper functions for bit manipulation
  generateHelperFunctions(mod);

  // Generate the main evaluate function
  generateEvaluateFunction(mod, netlist, signalWords);

  // Generate the cycle runner
  generateRunCyclesFunction(mod, netlist);

  // Optimize the module
  mod.optimize();

  // Validate
  if (!mod.validate()) {
    throw new Error('Generated WASM module is invalid');
  }

  // Compile to binary
  const binary = mod.emitBinary();
  mod.dispose();

  // Create memory
  const memory = new WebAssembly.Memory({
    initial: memoryPages,
    maximum: memoryPages * 2,
    shared: false,
  });

  // Instantiate
  const wasmModule = new WebAssembly.Module(binary);
  const wasmInstance = new WebAssembly.Instance(wasmModule, {
    env: { memory },
  });

  const exports = wasmInstance.exports as {
    evaluate: () => void;
    run_cycles: (n: number) => void;
  };

  // Create accessor functions
  const view = new Uint32Array(memory.buffer);

  // Initialize constant signals
  // const_0 signals are already 0 (memory is zeroed)
  // const_1 signals need to be set to 1
  for (const sig of netlist.signals) {
    if (sig.name === 'const_1') {
      const wordIdx = Math.floor(sig.id / 32);
      const bitIdx = sig.id % 32;
      view[wordIdx] |= 1 << bitIdx;
    }
  }

  return {
    wasmModule,
    wasmInstance,
    memory,
    evaluate: exports.evaluate,
    runCycles: exports.run_cycles,
    setSignal: (id: number, value: number) => {
      const wordIdx = Math.floor(id / 32);
      const bitIdx = id % 32;
      if (value) {
        view[wordIdx] |= 1 << bitIdx;
      } else {
        view[wordIdx] &= ~(1 << bitIdx);
      }
    },
    getSignal: (id: number) => {
      const wordIdx = Math.floor(id / 32);
      const bitIdx = id % 32;
      return (view[wordIdx] >> bitIdx) & 1;
    },
  };
}

function generateHelperFunctions(mod: binaryen.Module): void {
  // read_bit(signal_id: i32) -> i32
  // Returns 0 or 1
  mod.addFunction(
    'read_bit',
    binaryen.createType([binaryen.i32]),
    binaryen.i32,
    [binaryen.i32], // local: word value
    mod.block(null, [
      // word_idx = signal_id >> 5 (divide by 32)
      // bit_idx = signal_id & 31
      // return (memory[word_idx * 4] >> bit_idx) & 1
      mod.return(
        mod.i32.and(
          mod.i32.shr_u(
            mod.i32.load(
              0, 4,
              mod.i32.shl(
                mod.i32.shr_u(mod.local.get(0, binaryen.i32), mod.i32.const(5)),
                mod.i32.const(2)
              )
            ),
            mod.i32.and(mod.local.get(0, binaryen.i32), mod.i32.const(31))
          ),
          mod.i32.const(1)
        )
      ),
    ])
  );

  // write_bit(signal_id: i32, value: i32)
  mod.addFunction(
    'write_bit',
    binaryen.createType([binaryen.i32, binaryen.i32]),
    binaryen.none,
    [binaryen.i32, binaryen.i32], // locals: byte_offset, current_word
    mod.block(null, [
      // byte_offset = (signal_id >> 5) << 2
      mod.local.set(2,
        mod.i32.shl(
          mod.i32.shr_u(mod.local.get(0, binaryen.i32), mod.i32.const(5)),
          mod.i32.const(2)
        )
      ),
      // current_word = memory[byte_offset]
      mod.local.set(3, mod.i32.load(0, 4, mod.local.get(2, binaryen.i32))),
      // bit_mask = 1 << (signal_id & 31)
      // if value: current_word |= bit_mask
      // else: current_word &= ~bit_mask
      // select(condition, ifTrue, ifFalse)
      mod.i32.store(
        0, 4,
        mod.local.get(2, binaryen.i32),
        mod.select(
          mod.local.get(1, binaryen.i32), // condition: value
          mod.i32.or(                     // ifTrue: set bit
            mod.local.get(3, binaryen.i32),
            mod.i32.shl(
              mod.i32.const(1),
              mod.i32.and(mod.local.get(0, binaryen.i32), mod.i32.const(31))
            )
          ),
          mod.i32.and(                    // ifFalse: clear bit
            mod.local.get(3, binaryen.i32),
            mod.i32.xor(
              mod.i32.shl(
                mod.i32.const(1),
                mod.i32.and(mod.local.get(0, binaryen.i32), mod.i32.const(31))
              ),
              mod.i32.const(-1)
            )
          )
        )
      ),
    ])
  );
}

function generateEvaluateFunction(
  mod: binaryen.Module,
  netlist: LevelizedNetlist,
  _signalWords: number
): void {
  const statements: binaryen.ExpressionRef[] = [];
  const numDffs = netlist.dffs.length;

  // Proper synchronous logic sequence:
  // 1. First, evaluate combinational logic with current inputs (so D values reflect current inputs)
  // 2. Sample all DFF D inputs
  // 3. Update all DFF Q outputs (clock edge)
  // 4. Re-evaluate combinational logic (so outputs reflect new Q values)
  //
  // This models:
  // - External code sets inputs
  // - Call evaluate() = clock edge
  // - Combinational settles with new inputs → D values ready
  // - DFFs sample D and update Q
  // - Combinational re-settles with new Q → outputs ready
  // - External code reads outputs

  // Helper to add combinational evaluation
  const addCombinationalEval = () => {
    for (const level of netlist.levels) {
      for (const gate of level) {
        statements.push(
          mod.call(
            'write_bit',
            [
              mod.i32.const(gate.out),
              mod.i32.xor(
                mod.i32.and(
                  mod.call('read_bit', [mod.i32.const(gate.in1)], binaryen.i32),
                  mod.call('read_bit', [mod.i32.const(gate.in2)], binaryen.i32)
                ),
                mod.i32.const(1)
              ),
            ],
            binaryen.none
          )
        );
      }
    }
  };

  // Step 1: Evaluate combinational logic with current inputs
  // This ensures D values reflect the current primary inputs
  addCombinationalEval();

  if (numDffs > 0) {
    // Step 2: Sample all DFF D inputs into locals
    for (let i = 0; i < numDffs; i++) {
      const dff = netlist.dffs[i];
      statements.push(
        mod.local.set(
          i,
          mod.call('read_bit', [mod.i32.const(dff.d)], binaryen.i32)
        )
      );
    }

    // Step 3: Update all DFF Q outputs (clock edge)
    for (let i = 0; i < numDffs; i++) {
      const dff = netlist.dffs[i];
      statements.push(
        mod.call(
          'write_bit',
          [mod.i32.const(dff.q), mod.local.get(i, binaryen.i32)],
          binaryen.none
        )
      );
    }
  }

  // Step 4: Re-evaluate combinational logic with new Q values
  // This ensures outputs reflect the new state
  addCombinationalEval();

  // Create locals for DFF D values
  const locals: binaryen.Type[] = [];
  for (let i = 0; i < numDffs; i++) {
    locals.push(binaryen.i32);
  }

  mod.addFunction(
    'evaluate',
    binaryen.none,
    binaryen.none,
    locals,
    mod.block(null, statements)
  );
  mod.addFunctionExport('evaluate', 'evaluate');
}

function generateRunCyclesFunction(
  mod: binaryen.Module,
  netlist: LevelizedNetlist
): void {
  // run_cycles(count: i32)
  // Simple loop that calls evaluate() count times
  mod.addFunction(
    'run_cycles',
    binaryen.createType([binaryen.i32]),
    binaryen.none,
    [binaryen.i32], // local: counter
    mod.block('outer', [
      mod.local.set(1, mod.i32.const(0)),
      mod.loop(
        'cycle_loop',
        mod.block(null, [
          // if (counter >= count) break
          mod.br_if(
            'outer',
            mod.i32.ge_u(
              mod.local.get(1, binaryen.i32),
              mod.local.get(0, binaryen.i32)
            )
          ),
          // evaluate()
          mod.call('evaluate', [], binaryen.none),
          // counter++
          mod.local.set(
            1,
            mod.i32.add(mod.local.get(1, binaryen.i32), mod.i32.const(1))
          ),
          // continue loop
          mod.br('cycle_loop'),
        ])
      ),
    ])
  );
  mod.addFunctionExport('run_cycles', 'run_cycles');
}

/**
 * Generate an inlined version of runCycles that doesn't call evaluate().
 * The entire circuit evaluation is inlined into the loop body.
 */
function generateInlinedRunCyclesFunction(
  mod: binaryen.Module,
  netlist: LevelizedNetlist,
  evaluateStatements: binaryen.ExpressionRef[],
  numLocals: number
): void {
  // run_cycles(count: i32)
  // Local 0 = count parameter
  // Local 1 = loop counter
  // Locals 2..numLocals+2 = evaluation locals
  mod.addFunction(
    'run_cycles',
    binaryen.createType([binaryen.i32]),
    binaryen.none,
    Array(numLocals + 1).fill(binaryen.i32), // counter + evaluation locals
    mod.block('outer', [
      mod.local.set(1, mod.i32.const(0)),
      mod.loop(
        'cycle_loop',
        mod.block(null, [
          // if (counter >= count) break
          mod.br_if(
            'outer',
            mod.i32.ge_u(
              mod.local.get(1, binaryen.i32),
              mod.local.get(0, binaryen.i32)
            )
          ),
          // Inline evaluate body
          ...evaluateStatements,
          // counter++
          mod.local.set(
            1,
            mod.i32.add(mod.local.get(1, binaryen.i32), mod.i32.const(1))
          ),
          // continue loop
          mod.br('cycle_loop'),
        ])
      ),
    ])
  );
  mod.addFunctionExport('run_cycles', 'run_cycles');
}

/**
 * Compile behavioral modules to a separate WASM module.
 * This module shares memory with the main module but is compiled with level 2
 * optimization to avoid the Binaryen LocalCSE bug.
 *
 * Returns a function that evaluates all behavioral modules by reading inputs
 * from shared memory and writing outputs back.
 */
function compileBehavioralWasm(
  netlist: LevelizedNetlist,
  memory: WebAssembly.Memory
): (() => void) | undefined {
  if (netlist.behavioralModules.length === 0 || !netlist.behavioralModuleDefs) {
    return undefined;
  }

  const behavioralMod = new binaryen.Module();

  // Import the shared memory
  behavioralMod.addMemoryImport('0', 'env', 'memory');

  // Helper to generate inlined read_bit (direct memory access)
  function readBit(signalId: number): binaryen.ExpressionRef {
    const wordOffset = Math.floor(signalId / 32) * 4;
    const bitIdx = signalId % 32;
    return behavioralMod.i32.and(
      behavioralMod.i32.shr_u(
        behavioralMod.i32.load(0, 4, behavioralMod.i32.const(wordOffset)),
        behavioralMod.i32.const(bitIdx)
      ),
      behavioralMod.i32.const(1)
    );
  }

  // Helper to generate inlined write_bit (direct memory access)
  function writeBit(signalId: number, valueExpr: binaryen.ExpressionRef): binaryen.ExpressionRef {
    const wordOffset = Math.floor(signalId / 32) * 4;
    const bitIdx = signalId % 32;
    const bitMask = 1 << bitIdx;
    return behavioralMod.i32.store(
      0, 4,
      behavioralMod.i32.const(wordOffset),
      behavioralMod.i32.or(
        behavioralMod.i32.and(
          behavioralMod.i32.load(0, 4, behavioralMod.i32.const(wordOffset)),
          behavioralMod.i32.const(~bitMask)
        ),
        behavioralMod.i32.shl(
          behavioralMod.i32.and(valueExpr, behavioralMod.i32.const(1)),
          behavioralMod.i32.const(bitIdx)
        )
      )
    );
  }

  // Generate behavioral evaluation statements
  const statements: binaryen.ExpressionRef[] = [];

  for (const behavioralInstance of netlist.behavioralModules) {
    const moduleDef = netlist.behavioralModuleDefs.get(behavioralInstance.moduleName);
    if (moduleDef) {
      const behavioralStmts = generateInlinedBehavioral(
        behavioralMod,
        behavioralInstance,
        moduleDef,
        readBit,
        writeBit
      );
      statements.push(...behavioralStmts);
    }
  }

  // Create the evaluate_behavioral function
  behavioralMod.addFunction(
    'evaluate_behavioral',
    binaryen.none,
    binaryen.none,
    [],
    behavioralMod.block(null, statements)
  );
  behavioralMod.addFunctionExport('evaluate_behavioral', 'evaluate_behavioral');

  // Use level 2 optimization to avoid LocalCSE bug
  binaryen.setOptimizeLevel(2);
  binaryen.setShrinkLevel(0);
  behavioralMod.optimize();

  if (!behavioralMod.validate()) {
    console.warn('Behavioral WASM module invalid, falling back to JS');
    behavioralMod.dispose();
    return undefined;
  }

  const binary = behavioralMod.emitBinary();
  behavioralMod.dispose();

  // Instantiate with the shared memory
  const wasmModule = new WebAssembly.Module(binary);
  const wasmInstance = new WebAssembly.Instance(wasmModule, {
    env: { memory },
  });

  const exports = wasmInstance.exports as {
    evaluate_behavioral: () => void;
  };

  return exports.evaluate_behavioral;
}

/**
 * More aggressive optimization: inline everything and use direct memory access
 * This version generates a single function with all operations inlined
 */
export function compileToWasmOptimized(netlist: LevelizedNetlist): CompiledCircuit {
  const mod = new binaryen.Module();

  const numSignals = netlist.signals.length;
  const signalWords = Math.ceil(numSignals / 32);
  const memoryPages = Math.ceil((signalWords * 4 + 1024) / 65536);

  // Import memory (shared with JS)
  // Note: Do NOT call setMemory after addMemoryImport - it overwrites the import!
  mod.addMemoryImport('0', 'env', 'memory');

  // Generate fully inlined evaluate function
  generateInlinedEvaluateFunction(mod, netlist);
  generateRunCyclesFunction(mod, netlist);

  // Use aggressive optimization (level 4)
  // Note: Behavioral modules use JS fallback, so LocalCSE bug doesn't apply
  // The NAND gate code pattern is safe with high optimization levels
  binaryen.setOptimizeLevel(4);
  binaryen.setShrinkLevel(0);
  mod.optimize();

  if (!mod.validate()) {
    throw new Error('Generated WASM module is invalid');
  }

  const binary = mod.emitBinary();
  mod.dispose();

  const memory = new WebAssembly.Memory({
    initial: memoryPages,
    maximum: memoryPages * 2,
    shared: false,
  });

  const wasmModule = new WebAssembly.Module(binary);
  const wasmInstance = new WebAssembly.Instance(wasmModule, {
    env: { memory },
  });

  const hasBehavioral = netlist.behavioralModules.length > 0;

  const exports = wasmInstance.exports as {
    evaluate: () => void;
    run_cycles: (n: number) => void;
    evaluate_comb?: () => void;
    evaluate_dff?: () => void;
  };

  const view = new Uint32Array(memory.buffer);

  // Initialize constant signals
  // const_0 signals are already 0 (memory is zeroed)
  // const_1 signals need to be set to 1
  for (const sig of netlist.signals) {
    if (sig.name === 'const_1') {
      const wordIdx = Math.floor(sig.id / 32);
      const bitIdx = sig.id % 32;
      view[wordIdx] |= 1 << bitIdx;
    }
  }

  // Create signal accessors for behavioral JS fallback
  const getSignal = (id: number) => {
    const wordIdx = Math.floor(id / 32);
    const bitIdx = id % 32;
    return (view[wordIdx] >> bitIdx) & 1;
  };

  const setSignal = (id: number, value: number) => {
    const wordIdx = Math.floor(id / 32);
    const bitIdx = id % 32;
    if (value) {
      view[wordIdx] |= 1 << bitIdx;
    } else {
      view[wordIdx] &= ~(1 << bitIdx);
    }
  };

  // Use JS fallback for behavioral modules
  // NOTE: WASM behavioral compilation (compileBehavioralWasm) is disabled because
  // the generateInlinedBehavioral function doesn't properly handle local variables.
  // The JS fallback works correctly and provides good performance (~24-39k cycles/sec).
  let evaluateBehavioral: (() => void) | undefined;
  if (netlist.behavioralModules.length > 0) {
    // Use JS fallback for behavioral modules
    if (netlist.compiledBehaviors) {
      const behaviors = netlist.compiledBehaviors;
      const modules = netlist.behavioralModules;

      evaluateBehavioral = () => {
        for (const mod of modules) {
          const func = behaviors.get(mod.moduleName);
          if (!func) continue;

          // Pack input signals into numbers
          const inputs: Record<string, number> = {};
          for (const [name, signalIds] of mod.inputs) {
            if (Array.isArray(signalIds)) {
              let value = 0;
              for (let i = 0; i < signalIds.length; i++) {
                value |= getSignal(signalIds[i]) << i;
              }
              inputs[name] = value;
            } else {
              inputs[name] = getSignal(signalIds);
            }
          }

          // Call the compiled behavior function
          const outputs = func(inputs);

          // Unpack output numbers back to signals
          for (const [name, signalIds] of mod.outputs) {
            const value = outputs[name] ?? 0;
            if (Array.isArray(signalIds)) {
              for (let i = 0; i < signalIds.length; i++) {
                setSignal(signalIds[i], (value >> i) & 1);
              }
            } else {
              setSignal(signalIds, value & 1);
            }
          }
        }
      };
    }
  }

  return {
    wasmModule,
    wasmInstance,
    memory,
    evaluate: exports.evaluate,
    runCycles: exports.run_cycles,
    setSignal,
    getSignal,
    evaluateBehavioral,
    // Split functions for behavioral interleaving
    evaluateComb: exports.evaluate_comb,
    evaluateDff: exports.evaluate_dff,
    hasBehavioral,
  };
}

function generateInlinedEvaluateFunction(
  mod: binaryen.Module,
  netlist: LevelizedNetlist
): void {
  const statements: binaryen.ExpressionRef[] = [];
  const numDffs = netlist.dffs.length;

  // Simpler approach: directly read/write memory without complex caching
  // This avoids the local reuse bug while still being faster than function calls

  // Helper to generate inlined read_bit (direct memory access)
  function readBit(signalId: number): binaryen.ExpressionRef {
    const wordOffset = Math.floor(signalId / 32) * 4;
    const bitIdx = signalId % 32;
    return mod.i32.and(
      mod.i32.shr_u(
        mod.i32.load(0, 4, mod.i32.const(wordOffset)),
        mod.i32.const(bitIdx)
      ),
      mod.i32.const(1)
    );
  }

  // Helper to generate inlined write_bit (direct memory access)
  function writeBit(signalId: number, valueExpr: binaryen.ExpressionRef): binaryen.ExpressionRef {
    const wordOffset = Math.floor(signalId / 32) * 4;
    const bitIdx = signalId % 32;
    const bitMask = 1 << bitIdx;
    // Read-modify-write: (word & ~mask) | ((value & 1) << bit)
    return mod.i32.store(
      0, 4,
      mod.i32.const(wordOffset),
      mod.i32.or(
        mod.i32.and(
          mod.i32.load(0, 4, mod.i32.const(wordOffset)),
          mod.i32.const(~bitMask)
        ),
        mod.i32.shl(
          mod.i32.and(valueExpr, mod.i32.const(1)),
          mod.i32.const(bitIdx)
        )
      )
    );
  }

  // Proper synchronous logic sequence:
  // 1. First, evaluate combinational logic with current inputs (so D values reflect current inputs)
  // 2. Sample all DFF D inputs
  // 3. Update all DFF Q outputs (clock edge)
  // 4. Re-evaluate combinational logic (so outputs reflect new Q values)

  // Helper to add behavioral module evaluation
  const addBehavioralEval = () => {
    // NOTE: WASM behavioral is disabled due to Binaryen LocalCSE bug
    // The bug (GitHub issue #6066) requires optimization level 2 which hurts overall performance
    // JS fallback at level 4 optimization gives better performance (~39k vs ~21k cycles/sec)
    //
    // TODO: Consider these alternatives to re-enable WASM behavioral:
    // 1. Generate WAT directly (bypass Binaryen) - https://github.com/btzy/wasm-codegen
    // 2. Generate behavioral as separate WASM module with level 2, main module with level 4
    // 3. Wait for Binaryen fix upstream
    if (false && netlist.behavioralModules.length > 0 && netlist.behavioralModuleDefs) {
      for (const behavioralMod of netlist.behavioralModules) {
        const moduleDef = netlist.behavioralModuleDefs.get(behavioralMod.moduleName);
        if (moduleDef) {
          const behavioralStmts = generateInlinedBehavioral(
            mod,
            behavioralMod,
            moduleDef,
            readBit,
            writeBit
          );
          statements.push(...behavioralStmts);
        }
      }
    }
  };

  // Find the level at which behavioral modules should be evaluated
  // This is based on the max level of their input signals
  let behavioralLevel = -1;
  if (netlist.behavioralModules.length > 0) {
    // Find the maximum level of any signal that feeds into behavioral modules
    // Behavioral outputs should be evaluated at (max input level + 1)
    const signalLevelMap = new Map<number, number>();

    // Build signal level map from gates
    for (let levelIdx = 0; levelIdx < netlist.levels.length; levelIdx++) {
      for (const gate of netlist.levels[levelIdx]) {
        signalLevelMap.set(gate.out, levelIdx + 1); // Gate output level = gate level + 1 (0-indexed vs 1-indexed)
      }
    }

    // Check behavioral module inputs
    for (const mod of netlist.behavioralModules) {
      for (const [_, signals] of mod.inputs) {
        const sigArray = Array.isArray(signals) ? signals : [signals];
        for (const sig of sigArray) {
          const level = signalLevelMap.get(sig);
          if (level !== undefined && level > behavioralLevel) {
            behavioralLevel = level;
          }
        }
      }
    }
    // Behavioral evaluation happens after inputs are ready
    behavioralLevel += 1;
  }

  // Helper to add combinational evaluation
  // Note: When using JS fallback for behavioral, we insert a marker at the right level
  // and the actual behavioral eval is done separately. The marker is just to track where it should go.
  const addCombinationalEval = () => {
    // Evaluate NAND gates in level order
    for (let levelIdx = 0; levelIdx < netlist.levels.length; levelIdx++) {
      const level = netlist.levels[levelIdx];
      for (const gate of level) {
        const nandResult = mod.i32.xor(
          mod.i32.and(readBit(gate.in1), readBit(gate.in2)),
          mod.i32.const(1)
        );
        statements.push(writeBit(gate.out, nandResult));
      }

      // Insert behavioral evaluation at the correct level (if using WASM behavioral)
      if (levelIdx === behavioralLevel - 1) {
        addBehavioralEval();
      }
    }

    // If behavioral level is beyond all NAND levels, evaluate at the end
    if (behavioralLevel >= netlist.levels.length) {
      addBehavioralEval();
    }
  };

  // If behavioral modules present, generate split functions for proper interleaving
  const hasBehavioral = netlist.behavioralModules.length > 0;

  if (hasBehavioral) {
    // Generate split functions for behavioral interleaving:
    // - evaluate_comb: just combinational logic
    // - evaluate_dff: sample D, update Q
    // - evaluate: combined (for backwards compatibility and non-behavioral use)

    // evaluate_comb: combinational logic only
    const combStatements: binaryen.ExpressionRef[] = [];
    for (let levelIdx = 0; levelIdx < netlist.levels.length; levelIdx++) {
      const level = netlist.levels[levelIdx];
      for (const gate of level) {
        const nandResult = mod.i32.xor(
          mod.i32.and(readBit(gate.in1), readBit(gate.in2)),
          mod.i32.const(1)
        );
        combStatements.push(writeBit(gate.out, nandResult));
      }
    }
    mod.addFunction('evaluate_comb', binaryen.none, binaryen.none, [], mod.block(null, combStatements));
    mod.addFunctionExport('evaluate_comb', 'evaluate_comb');

    // evaluate_dff: sample D values, then update Q values
    if (numDffs > 0) {
      const dffStatements: binaryen.ExpressionRef[] = [];
      const dffLocals: binaryen.Type[] = [];

      // Read D values into locals
      for (let i = 0; i < numDffs; i++) {
        const dff = netlist.dffs[i];
        dffStatements.push(mod.local.set(i, readBit(dff.d)));
        dffLocals.push(binaryen.i32);
      }

      // Write Q values from locals
      for (let i = 0; i < numDffs; i++) {
        const dff = netlist.dffs[i];
        dffStatements.push(writeBit(dff.q, mod.local.get(i, binaryen.i32)));
      }

      mod.addFunction('evaluate_dff', binaryen.none, binaryen.none, dffLocals, mod.block(null, dffStatements));
    } else {
      // No DFFs - empty function
      mod.addFunction('evaluate_dff', binaryen.none, binaryen.none, [], mod.nop());
    }
    mod.addFunctionExport('evaluate_dff', 'evaluate_dff');
  }

  // Generate main evaluate function (full cycle for non-behavioral or backwards compat)
  // Step 1: Evaluate combinational logic with current inputs
  addCombinationalEval();

  // Step 2 & 3: DFF updates
  if (numDffs > 0) {
    // Read D values into DFF locals (sample D inputs)
    for (let i = 0; i < numDffs; i++) {
      const dff = netlist.dffs[i];
      statements.push(mod.local.set(i, readBit(dff.d)));
    }

    // Write Q values from locals (clock edge)
    for (let i = 0; i < numDffs; i++) {
      const dff = netlist.dffs[i];
      statements.push(writeBit(dff.q, mod.local.get(i, binaryen.i32)));
    }
  }

  // Step 4: Re-evaluate combinational logic with new Q values
  addCombinationalEval();

  // Create locals array for DFFs
  const locals: binaryen.Type[] = [];
  for (let i = 0; i < numDffs; i++) {
    locals.push(binaryen.i32);
  }

  mod.addFunction('evaluate', binaryen.none, binaryen.none, locals, mod.block(null, statements));
  mod.addFunctionExport('evaluate', 'evaluate');
}
