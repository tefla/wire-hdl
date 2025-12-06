// Cone Extractor: Extract combinational logic cones from a netlist
// A cone is the set of gates that contribute to a single output

import { Netlist, NandGate, SignalId } from '../types/netlist.js';

export interface LogicCone {
  // The output signal of this cone
  output: SignalId;

  // Input signals (primary inputs or DFF outputs)
  inputs: SignalId[];

  // Gates in this cone (in topological order)
  gates: NandGate[];

  // Map from signal to the gate that produces it (within this cone)
  signalProducer: Map<SignalId, NandGate>;
}

/**
 * Extract all combinational logic cones from a netlist.
 * Each cone represents the logic driving one DFF input or primary output.
 */
export function extractCones(netlist: Netlist): LogicCone[] {
  const cones: LogicCone[] = [];

  // Build a map of signal -> gate that produces it
  const gateByOutput = new Map<SignalId, NandGate>();
  for (const gate of netlist.nandGates) {
    gateByOutput.set(gate.out, gate);
  }

  // Identify cone roots: DFF inputs and primary outputs
  const coneRoots: SignalId[] = [];

  // DFF inputs
  for (const dff of netlist.dffs) {
    coneRoots.push(dff.d);
  }

  // Primary outputs
  for (const sig of netlist.signals) {
    if (sig.isPrimaryOutput) {
      coneRoots.push(sig.id);
    }
  }

  // Identify cone leaves: primary inputs and DFF outputs
  const coneLeaves = new Set<SignalId>();
  for (const sig of netlist.signals) {
    if (sig.isPrimaryInput || sig.isDffOutput) {
      coneLeaves.add(sig.id);
    }
  }

  // Extract cone for each root
  for (const root of coneRoots) {
    const cone = extractSingleCone(root, gateByOutput, coneLeaves);
    if (cone.gates.length > 0) {
      cones.push(cone);
    }
  }

  return cones;
}

/**
 * Extract a single logic cone by tracing back from the output.
 */
function extractSingleCone(
  output: SignalId,
  gateByOutput: Map<SignalId, NandGate>,
  coneLeaves: Set<SignalId>
): LogicCone {
  const gates: NandGate[] = [];
  const inputs = new Set<SignalId>();
  const signalProducer = new Map<SignalId, NandGate>();
  const visited = new Set<SignalId>();

  // DFS to collect all gates in the cone
  function visit(sig: SignalId): void {
    if (visited.has(sig)) return;
    visited.add(sig);

    // If this is a cone leaf, it's an input
    if (coneLeaves.has(sig)) {
      inputs.add(sig);
      return;
    }

    // Find the gate that produces this signal
    const gate = gateByOutput.get(sig);
    if (!gate) {
      // Signal not produced by a gate - treat as input
      inputs.add(sig);
      return;
    }

    // Visit inputs first (for topological order)
    visit(gate.in1);
    visit(gate.in2);

    // Add this gate
    gates.push(gate);
    signalProducer.set(sig, gate);
  }

  visit(output);

  return {
    output,
    inputs: Array.from(inputs),
    gates,
    signalProducer,
  };
}

/**
 * Check if a cone is small enough to optimize with Quine-McCluskey.
 * Q-M has exponential complexity in the number of inputs.
 */
export function isConeOptimizable(cone: LogicCone, maxInputs: number = 12): boolean {
  return cone.inputs.length <= maxInputs && cone.gates.length > 0;
}
