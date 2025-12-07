// Main Optimizer: Orchestrates the optimization pipeline
//
// Pipeline:
// 1. Extract combinational logic cones
// 2. For small cones: build truth table, run Q-M, convert back to NANDs
// 3. Rebuild netlist with optimized cones

import { Netlist, NandGate, Signal, SignalId, Dff } from '../types/netlist.js';
import { extractCones, LogicCone, isConeOptimizable } from './cone-extractor.js';
import { buildTruthTable, TruthTable } from './truth-table.js';
import { quineMcCluskey, MinimizedFunction, minimizedToString } from './quine-mccluskey.js';
import { sopToNand, estimateGateCount } from './sop-to-nand.js';

export interface OptimizationResult {
  netlist: Netlist;
  stats: OptimizationStats;
}

export interface OptimizationStats {
  originalGates: number;
  optimizedGates: number;
  conesExtracted: number;
  conesOptimized: number;
  conesSkipped: number;
  gatesSaved: number;
  optimizationTimeMs: number;
}

export interface OptimizationOptions {
  // Maximum number of inputs for a cone to be optimized
  maxConeInputs: number;

  // Minimum gates saved to apply optimization (percentage)
  minSavingsPercent: number;

  // Enable verbose logging
  verbose: boolean;
}

const DEFAULT_OPTIONS: OptimizationOptions = {
  maxConeInputs: 10, // Q-M is O(3^n), so limit inputs
  minSavingsPercent: 10,
  verbose: false,
};

/**
 * Optimize a netlist using Quine-McCluskey minimization.
 */
export function optimize(
  netlist: Netlist,
  options: Partial<OptimizationOptions> = {}
): OptimizationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = performance.now();

  const stats: OptimizationStats = {
    originalGates: netlist.nandGates.length,
    optimizedGates: 0,
    conesExtracted: 0,
    conesOptimized: 0,
    conesSkipped: 0,
    gatesSaved: 0,
    optimizationTimeMs: 0,
  };

  // Extract cones
  const cones = extractCones(netlist);
  stats.conesExtracted = cones.length;

  if (opts.verbose) {
    console.log(`Extracted ${cones.length} logic cones`);
  }

  // Find gates that are shared between cones - we won't optimize cones with shared gates
  // to avoid duplicating logic
  const gateUsageCount = new Map<number, number>();
  for (const cone of cones) {
    for (const gate of cone.gates) {
      gateUsageCount.set(gate.id, (gateUsageCount.get(gate.id) || 0) + 1);
    }
  }
  const sharedGates = new Set<number>();
  for (const [gateId, count] of gateUsageCount) {
    if (count > 1) {
      sharedGates.add(gateId);
    }
  }

  if (opts.verbose && sharedGates.size > 0) {
    console.log(`Found ${sharedGates.size} shared gates between cones`);
  }

  // Track which gates are replaced
  const replacedGates = new Set<number>();
  const newGates: NandGate[] = [];
  const newSignals: Signal[] = [...netlist.signals];
  let nextSignalId = newSignals.length;
  let nextGateId = netlist.nandGates.length;

  // Process each cone
  for (const cone of cones) {
    if (!isConeOptimizable(cone, opts.maxConeInputs)) {
      stats.conesSkipped++;
      if (opts.verbose && cone.inputs.length > opts.maxConeInputs) {
        console.log(`  Skipping cone ${cone.output}: ${cone.inputs.length} inputs > ${opts.maxConeInputs}`);
      }
      continue;
    }

    // Skip tiny cones
    if (cone.gates.length < 3) {
      stats.conesSkipped++;
      continue;
    }

    // Skip cones that have gates shared with other cones to avoid duplication
    const hasSharedGates = cone.gates.some(g => sharedGates.has(g.id));
    if (hasSharedGates) {
      stats.conesSkipped++;
      if (opts.verbose) {
        console.log(`  Skipping cone ${cone.output}: has shared gates`);
      }
      continue;
    }

    try {
      // Build truth table
      const tt = buildTruthTable(cone);

      // Run Q-M minimization
      const minimized = quineMcCluskey(tt);

      // Estimate new gate count
      const estimatedGates = estimateGateCount(minimized);
      const savings = cone.gates.length - estimatedGates;
      const savingsPercent = (savings / cone.gates.length) * 100;

      if (savingsPercent < opts.minSavingsPercent) {
        stats.conesSkipped++;
        if (opts.verbose) {
          console.log(`  Skipping cone ${cone.output}: only ${savingsPercent.toFixed(1)}% savings`);
        }
        continue;
      }

      // Convert back to NANDs
      const impl = sopToNand(
        minimized,
        cone.inputs,
        cone.output,
        nextGateId,
        nextSignalId,
        cone.gates.length
      );

      // Create temp signals
      for (const tempId of impl.tempSignals) {
        newSignals.push({
          id: tempId,
          name: `_opt_${tempId}`,
          width: 1,
          isPrimaryInput: false,
          isPrimaryOutput: false,
          isDffOutput: false,
        });
      }
      nextSignalId += impl.tempSignals.length;
      nextGateId += impl.gates.length;

      // Mark old gates as replaced
      for (const gate of cone.gates) {
        replacedGates.add(gate.id);
      }

      // Add new gates
      newGates.push(...impl.gates);

      stats.conesOptimized++;
      stats.gatesSaved += savings;

      if (opts.verbose) {
        console.log(`  Optimized cone ${cone.output}: ${cone.gates.length} -> ${impl.gates.length} gates (${savingsPercent.toFixed(1)}% savings)`);
      }
    } catch (e) {
      stats.conesSkipped++;
      if (opts.verbose) {
        console.log(`  Error optimizing cone ${cone.output}: ${e}`);
      }
    }
  }

  // Build optimized netlist
  const keptGates = netlist.nandGates.filter(g => !replacedGates.has(g.id));
  const allGates = [...keptGates, ...newGates];

  // Renumber gates
  for (let i = 0; i < allGates.length; i++) {
    allGates[i].id = i;
  }

  stats.optimizedGates = allGates.length;
  stats.optimizationTimeMs = performance.now() - startTime;

  const optimizedNetlist: Netlist = {
    name: netlist.name,
    signals: newSignals,
    nandGates: allGates,
    dffs: netlist.dffs,
    primaryInputs: netlist.primaryInputs,
    primaryOutputs: netlist.primaryOutputs,
    clockSignal: netlist.clockSignal,
    totalSignals: newSignals.length,
    totalNands: allGates.length,
    totalDffs: netlist.dffs.length,
    signalMap: new Map(),
    intrinsics: netlist.intrinsics || [],
    behavioralModules: netlist.behavioralModules || [],
  };

  // Rebuild signal map
  for (const sig of newSignals) {
    optimizedNetlist.signalMap.set(sig.name, sig.id);
  }

  return {
    netlist: optimizedNetlist,
    stats,
  };
}

/**
 * Quick estimate of potential optimization benefit without full optimization.
 */
export function estimateOptimization(netlist: Netlist): { potentialSavings: number; conesAnalyzable: number } {
  const cones = extractCones(netlist);
  let potentialSavings = 0;
  let conesAnalyzable = 0;

  for (const cone of cones) {
    if (isConeOptimizable(cone, 10) && cone.gates.length >= 3) {
      conesAnalyzable++;
      // Rough estimate: Q-M can often reduce gates by 30-50%
      potentialSavings += Math.floor(cone.gates.length * 0.3);
    }
  }

  return { potentialSavings, conesAnalyzable };
}
