// Simple netlist optimization: constant propagation and gate simplification
// This pass removes redundant gates and propagates constants

import { Netlist, NandGate, Signal, SignalId } from '../types/netlist.js';

interface OptimizedNetlist extends Netlist {
  removedGates: number;
  constantSignals: Map<SignalId, number>; // signal -> constant value (0 or 1)
}

/**
 * Optimize a netlist by:
 * 1. Constant propagation: If a signal is always 0 or 1, propagate it
 * 2. Gate simplification: Remove redundant gates
 *    - NAND(x, x) = NOT(x) - keep as is, but note for potential NOT optimization
 *    - NAND(0, x) = 1 (constant)
 *    - NAND(1, x) = NOT(x)
 *    - NAND(x, 0) = 1 (constant)
 *    - NAND(x, 1) = NOT(x)
 * 3. Dead gate elimination: Remove gates whose outputs aren't used
 */
export function simplifyNetlist(netlist: Netlist): OptimizedNetlist {
  const constants = new Map<SignalId, number>();
  const signalUsers = new Map<SignalId, Set<number>>(); // signal -> gate ids that use it
  let removedGates = 0;

  // Initialize signal users map
  for (const sig of netlist.signals) {
    signalUsers.set(sig.id, new Set());
  }

  // Build usage map
  for (const gate of netlist.nands) {
    signalUsers.get(gate.in1)?.add(gate.id);
    signalUsers.get(gate.in2)?.add(gate.id);
  }

  // Mark DFF inputs and outputs as used
  for (const dff of netlist.dffs) {
    signalUsers.get(dff.d)?.add(-1); // -1 = used by DFF
    signalUsers.get(dff.q)?.add(-1);
  }

  // Mark primary outputs as used
  for (const sig of netlist.signals) {
    if (sig.isPrimaryOutput) {
      signalUsers.get(sig.id)?.add(-1);
    }
  }

  // Constant propagation pass
  // Look for gates with constant inputs
  let changed = true;
  let iterations = 0;
  const maxIterations = 100;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    for (const gate of netlist.nands) {
      const in1Const = constants.get(gate.in1);
      const in2Const = constants.get(gate.in2);

      if (in1Const !== undefined && in2Const !== undefined) {
        // Both inputs constant: NAND(c1, c2) = ~(c1 & c2)
        const result = (in1Const & in2Const) ^ 1;
        if (!constants.has(gate.out)) {
          constants.set(gate.out, result);
          changed = true;
          removedGates++;
        }
      } else if (in1Const === 0 || in2Const === 0) {
        // NAND(0, x) = NAND(x, 0) = 1
        if (!constants.has(gate.out)) {
          constants.set(gate.out, 1);
          changed = true;
          removedGates++;
        }
      }
      // Note: NAND(1, x) = NOT(x) and NAND(x, 1) = NOT(x) don't propagate constants
      // but they could be simplified to a single-input NOT in a future optimization
    }
  }

  // Filter out gates that produce constant outputs
  const optimizedNands = netlist.nands.filter(gate => !constants.has(gate.out));

  // Create optimized netlist
  const optimized: OptimizedNetlist = {
    ...netlist,
    nands: optimizedNands,
    removedGates,
    constantSignals: constants,
  };

  return optimized;
}

/**
 * Find signals that are constants (always 0 or always 1) by analyzing the circuit
 */
export function findConstantSignals(netlist: Netlist): Map<SignalId, number> {
  const constants = new Map<SignalId, number>();

  // For now, we only know that primary inputs could be any value
  // DFF outputs start at 0 but can change

  // This is a simplified analysis - a full analysis would require
  // symbolic execution or SAT solving

  return constants;
}
