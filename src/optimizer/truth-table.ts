// Truth Table Generator: Build truth tables from logic cones

import { LogicCone } from './cone-extractor.js';
import { SignalId } from '../types/netlist.js';

export interface TruthTable {
  // Number of input variables
  numInputs: number;

  // Input signal IDs (in order, bit 0 = first signal)
  inputSignals: SignalId[];

  // Output signal ID
  outputSignal: SignalId;

  // Minterms: input combinations where output is 1
  // Each minterm is a number where bit i corresponds to inputSignals[i]
  minterms: number[];

  // Don't-care terms (if any)
  dontCares: number[];
}

/**
 * Build a truth table for a logic cone by simulating all input combinations.
 */
export function buildTruthTable(cone: LogicCone): TruthTable {
  const numInputs = cone.inputs.length;
  const numCombinations = 1 << numInputs;

  // Map inputs to bit positions
  const inputToBit = new Map<SignalId, number>();
  for (let i = 0; i < cone.inputs.length; i++) {
    inputToBit.set(cone.inputs[i], i);
  }

  const minterms: number[] = [];

  // Simulate each input combination
  for (let inputValue = 0; inputValue < numCombinations; inputValue++) {
    const result = simulateCone(cone, inputValue, inputToBit);
    if (result === 1) {
      minterms.push(inputValue);
    }
  }

  return {
    numInputs,
    inputSignals: [...cone.inputs],
    outputSignal: cone.output,
    minterms,
    dontCares: [], // No don't-cares in our current model
  };
}

/**
 * Simulate a cone with a specific input combination.
 * Returns 0 or 1.
 */
function simulateCone(
  cone: LogicCone,
  inputValue: number,
  inputToBit: Map<SignalId, number>
): number {
  const signalValues = new Map<SignalId, number>();

  // Set input values
  for (const [sig, bit] of inputToBit) {
    signalValues.set(sig, (inputValue >> bit) & 1);
  }

  // Evaluate gates in topological order
  for (const gate of cone.gates) {
    const in1 = signalValues.get(gate.in1);
    const in2 = signalValues.get(gate.in2);

    if (in1 === undefined || in2 === undefined) {
      throw new Error(`Gate input not found: ${gate.in1} or ${gate.in2}`);
    }

    // NAND: output = ~(in1 & in2)
    const out = (in1 & in2) ^ 1;
    signalValues.set(gate.out, out);
  }

  const result = signalValues.get(cone.output);
  if (result === undefined) {
    // Output is directly connected to an input
    const bit = inputToBit.get(cone.output);
    if (bit !== undefined) {
      return (inputValue >> bit) & 1;
    }
    throw new Error(`Cone output not found: ${cone.output}`);
  }

  return result;
}

/**
 * Check if a truth table is trivial (always 0, always 1, or single variable).
 */
export function isTrivialTruthTable(tt: TruthTable): boolean {
  const numCombinations = 1 << tt.numInputs;

  // Always 0
  if (tt.minterms.length === 0) return true;

  // Always 1
  if (tt.minterms.length === numCombinations) return true;

  // Single variable or its complement
  if (tt.numInputs === 1) return true;

  return false;
}

/**
 * Estimate the cost of implementing a truth table directly vs keeping original.
 * Returns true if optimization is likely beneficial.
 */
export function shouldOptimize(tt: TruthTable, originalGateCount: number): boolean {
  // If very few minterms, likely to compress well
  if (tt.minterms.length <= 4) return true;

  // If almost all minterms, complement might compress well
  const numCombinations = 1 << tt.numInputs;
  if (tt.minterms.length >= numCombinations - 4) return true;

  // For larger truth tables, use heuristic
  // Roughly: Q-M can often reduce to ~50% of original gates
  return tt.minterms.length < numCombinations / 2;
}
