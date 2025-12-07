// Levelizer: topological sort and level assignment for levelized simulation

import {
  Netlist,
  LevelizedNetlist,
  NandGate,
  SignalId,
  BehavioralFunction,
} from '../types/netlist.js';
import { BehavioralCompiler } from '../compiler/behavioral-compiler.js';
import type { Program } from '../types/ast.js';

/**
 * Levelize a netlist for efficient simulation.
 *
 * The algorithm:
 * 1. Identify level 0 signals: primary inputs and DFF outputs
 * 2. Build dependency graph (signal -> gates that use it)
 * 3. Topological sort with level assignment
 * 4. Group gates by level
 *
 * @param netlist The netlist to levelize
 * @param program Optional AST program for compiling behavioral functions
 */
export function levelize(netlist: Netlist, program?: Program): LevelizedNetlist {
  // Track which signals are at level 0 (inputs to combinational logic)
  const level0Signals = new Set<SignalId>();

  // Primary inputs are level 0
  for (const sig of netlist.primaryInputs) {
    level0Signals.add(sig);
  }

  // DFF outputs are level 0 (they're inputs to the next cycle's combinational logic)
  for (const dff of netlist.dffs) {
    level0Signals.add(dff.q);
  }

  // Constant signals are level 0
  for (const sig of netlist.signals) {
    if (sig.name.startsWith('const_')) {
      level0Signals.add(sig.id);
    }
  }

  // Build a map of signals that are driven by behavioral modules
  // These signals will be assigned levels based on their inputs
  const behavioralOutputSignals = new Set<SignalId>();
  const behavioralInputSignals = new Map<SignalId, SignalId[]>(); // output -> inputs that determine its level
  for (const mod of netlist.behavioralModules) {
    // Collect all input signals
    const allInputs: SignalId[] = [];
    for (const [_, signals] of mod.inputs) {
      if (Array.isArray(signals)) {
        allInputs.push(...signals);
      } else {
        allInputs.push(signals);
      }
    }

    // Mark all outputs and associate them with inputs
    for (const [_, signals] of mod.outputs) {
      if (Array.isArray(signals)) {
        for (const sig of signals) {
          behavioralOutputSignals.add(sig);
          behavioralInputSignals.set(sig, allInputs);
        }
      } else {
        behavioralOutputSignals.add(signals);
        behavioralInputSignals.set(signals, allInputs);
      }
    }
  }

  // Build signal level map
  const signalLevel = new Map<SignalId, number>();

  // Initialize level 0 signals
  for (const sig of level0Signals) {
    signalLevel.set(sig, 0);
  }

  // Compute levels for all NAND gates and behavioral outputs using iterative approach
  // A gate's output level = max(input levels) + 1
  // A behavioral output level = max(behavioral input levels) + 1
  let changed = true;
  let iterations = 0;
  const maxIterations = netlist.nandGates.length + behavioralOutputSignals.size + 10; // Safety margin

  while (changed) {
    changed = false;
    iterations++;

    if (iterations > maxIterations) {
      throw new Error(
        'Levelization failed: possible combinational loop detected'
      );
    }

    // Process NAND gates
    for (const gate of netlist.nandGates) {
      const level1 = signalLevel.get(gate.in1);
      const level2 = signalLevel.get(gate.in2);

      if (level1 !== undefined && level2 !== undefined) {
        const newLevel = Math.max(level1, level2) + 1;
        const currentLevel = signalLevel.get(gate.out);

        if (currentLevel === undefined) {
          signalLevel.set(gate.out, newLevel);
          gate.level = newLevel;
          changed = true;
        }
      }
    }

    // Process behavioral module output signals
    // Their level is max(input signal levels) + 1
    for (const outSig of behavioralOutputSignals) {
      if (signalLevel.has(outSig)) continue; // Already assigned

      const inputSignals = behavioralInputSignals.get(outSig);
      if (!inputSignals) continue;

      // Check if all inputs have levels
      let maxInputLevel = -1;
      let allInputsHaveLevels = true;
      for (const inSig of inputSignals) {
        const level = signalLevel.get(inSig);
        if (level === undefined) {
          allInputsHaveLevels = false;
          break;
        }
        if (level > maxInputLevel) maxInputLevel = level;
      }

      if (allInputsHaveLevels) {
        signalLevel.set(outSig, maxInputLevel + 1);
        changed = true;
      }
    }
  }

  // Find maximum level
  let maxLevel = 0;
  for (const gate of netlist.nandGates) {
    if (gate.level > maxLevel) {
      maxLevel = gate.level;
    }
  }

  // Group gates by level
  const levels: NandGate[][] = [];
  for (let i = 0; i <= maxLevel; i++) {
    levels.push([]);
  }

  for (const gate of netlist.nandGates) {
    if (gate.level >= 0) {
      levels[gate.level].push(gate);
    }
  }

  // Calculate signal buffer size (1 bit per signal, packed into uint32)
  const totalSignals = netlist.signals.length;
  const signalBufferSize = Math.ceil(totalSignals / 32);

  // Compile behavioral functions if program is provided
  // Use compileAll() to support composable behaviors (modules calling each other)
  let compiledBehaviors: Map<string, BehavioralFunction> | undefined;
  let behavioralModuleDefs: Map<string, import('../types/ast.js').ModuleDecl> | undefined;

  if (program && netlist.behavioralModules.length > 0) {
    behavioralModuleDefs = new Map();
    const compiler = new BehavioralCompiler();

    // Compile ALL behavioral modules so they can call each other
    compiledBehaviors = compiler.compileAll(program);

    // Store module definitions for WASM compilation
    for (const mod of program.modules) {
      if (mod.behavior) {
        behavioralModuleDefs.set(mod.name, mod);
      }
    }
  }

  return {
    ...netlist,
    levels,
    maxLevel,
    signalBufferSize,
    compiledBehaviors,
    behavioralModuleDefs,
  };
}

/**
 * Detect combinational loops in the netlist.
 * Returns a list of signal IDs involved in loops.
 */
export function detectLoops(netlist: Netlist): SignalId[][] {
  // Build adjacency list: signal -> signals it feeds into
  const adj = new Map<SignalId, SignalId[]>();

  for (const gate of netlist.nandGates) {
    // in1 -> out, in2 -> out
    if (!adj.has(gate.in1)) adj.set(gate.in1, []);
    if (!adj.has(gate.in2)) adj.set(gate.in2, []);
    adj.get(gate.in1)!.push(gate.out);
    adj.get(gate.in2)!.push(gate.out);
  }

  // Tarjan's SCC algorithm
  const sccs: SignalId[][] = [];
  const index = new Map<SignalId, number>();
  const lowlink = new Map<SignalId, number>();
  const onStack = new Set<SignalId>();
  const stack: SignalId[] = [];
  let currentIndex = 0;

  function strongConnect(v: SignalId): void {
    index.set(v, currentIndex);
    lowlink.set(v, currentIndex);
    currentIndex++;
    stack.push(v);
    onStack.add(v);

    const neighbors = adj.get(v) || [];
    for (const w of neighbors) {
      if (!index.has(w)) {
        strongConnect(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, index.get(w)!));
      }
    }

    if (lowlink.get(v) === index.get(v)) {
      const scc: SignalId[] = [];
      let w: SignalId;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);

      // Only report SCCs with more than 1 node (actual loops)
      if (scc.length > 1) {
        sccs.push(scc);
      }
    }
  }

  // Run Tarjan's for all unvisited nodes
  for (const sig of netlist.signals) {
    if (!index.has(sig.id)) {
      strongConnect(sig.id);
    }
  }

  return sccs;
}

/**
 * Get evaluation statistics for the levelized netlist.
 */
export function getStats(netlist: LevelizedNetlist): {
  totalGates: number;
  totalDffs: number;
  maxLevel: number;
  gatesPerLevel: number[];
  avgFanout: number;
} {
  // Calculate average fanout
  const fanoutCount = new Map<SignalId, number>();
  for (const gate of netlist.nandGates) {
    fanoutCount.set(gate.in1, (fanoutCount.get(gate.in1) || 0) + 1);
    fanoutCount.set(gate.in2, (fanoutCount.get(gate.in2) || 0) + 1);
  }

  let totalFanout = 0;
  for (const count of fanoutCount.values()) {
    totalFanout += count;
  }
  const avgFanout = fanoutCount.size > 0 ? totalFanout / fanoutCount.size : 0;

  return {
    totalGates: netlist.nandGates.length,
    totalDffs: netlist.dffs.length,
    maxLevel: netlist.maxLevel,
    gatesPerLevel: netlist.levels.map((l) => l.length),
    avgFanout,
  };
}
