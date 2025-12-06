// SOP to NAND Converter
// Converts a minimized sum-of-products to NAND gates

import { MinimizedFunction, Implicant } from './quine-mccluskey.js';
import { NandGate, SignalId } from '../types/netlist.js';

export interface NandImplementation {
  // New gates created
  gates: NandGate[];

  // Number of gates before optimization
  originalGateCount: number;

  // Temp signals created (for internal nodes)
  tempSignals: SignalId[];
}

/**
 * Convert a minimized SOP function to NAND gates.
 *
 * Uses the double-inversion property:
 * - AND(a,b) = NAND(NAND(a,b), NAND(a,b)) - but wasteful
 * - OR(a,b) = NAND(NAND(a,a), NAND(b,b)) = NAND(NOT(a), NOT(b))
 *
 * SOP = sum of products = OR(AND terms)
 *
 * Using NAND-NAND:
 * - Each product term: AND(literals) = NAND(NAND(literals))
 * - Final OR: OR(products) = NAND(NOT of each product)
 *
 * Actually, more efficient:
 * - NOT(x) = NAND(x, x)
 * - AND(a,b) = NOT(NAND(a,b)) = NAND(NAND(a,b), NAND(a,b))
 * - OR(a,b) = NAND(NOT(a), NOT(b))
 *
 * For SOP: output = OR(P1, P2, ..., Pn) where Pi = AND(literals)
 *
 * Using De Morgan: OR(P1,...,Pn) = NOT(AND(NOT(P1),...,NOT(Pn)))
 *                                = NAND(NOT(P1),...,NOT(Pn))
 *
 * And Pi = AND(L1,...,Lk) = NOT(NAND(L1,...,Lk))
 * So NOT(Pi) = NAND(L1,...,Lk)
 *
 * Therefore: output = NAND(NAND(L1_1,...,L1_k1), NAND(L2_1,...,L2_k2), ...)
 *
 * For multi-input NAND, decompose to 2-input:
 * NAND(a,b,c) = NAND(AND(a,b), c) = NAND(NAND(NAND(a,b), NAND(a,b)), c)
 *
 * Actually simpler: NAND(a,b,c,d) = NOT(a & b & c & d)
 *                                 = NAND(a, NAND(NOT(b & c & d), NOT(b & c & d)))
 * Hmm, this gets complex. Let me use a cleaner approach.
 *
 * Clean 2-level NAND-NAND implementation:
 * 1. For each product term with n literals: build n-input AND using tree of NANDs
 * 2. For the OR of products: use NAND(NOT(P1), NOT(P2), ...) = OR(P1, P2, ...)
 */

interface GateBuilder {
  gates: NandGate[];
  nextGateId: number;
  nextSignalId: SignalId;
  tempSignals: SignalId[];
}

/**
 * Convert minimized function to NAND gates.
 */
export function sopToNand(
  mf: MinimizedFunction,
  inputSignals: SignalId[],
  outputSignal: SignalId,
  startGateId: number,
  startSignalId: SignalId,
  originalGateCount: number
): NandImplementation {
  const builder: GateBuilder = {
    gates: [],
    nextGateId: startGateId,
    nextSignalId: startSignalId,
    tempSignals: [],
  };

  // Handle special cases
  if (mf.implicants.length === 0) {
    // Output is always 0 - connect to constant 0
    // Create: out = NAND(1, 1) = 0... but we need a constant 1 first
    // Actually, for our purposes, we'll just return no gates
    // and let the signal stay unconnected (or handle externally)
    return {
      gates: [],
      originalGateCount,
      tempSignals: [],
    };
  }

  // Build NOT gates for negated literals (cache to avoid duplicates)
  const notCache = new Map<SignalId, SignalId>();

  function getNot(sig: SignalId): SignalId {
    let notSig = notCache.get(sig);
    if (notSig === undefined) {
      notSig = createTempSignal(builder);
      addGate(builder, sig, sig, notSig); // NOT = NAND(x, x)
      notCache.set(sig, notSig);
    }
    return notSig;
  }

  // Build each product term (AND of literals)
  // NOT(product) = NAND(literals)
  const productNots: SignalId[] = [];

  for (const imp of mf.implicants) {
    // Collect literals for this implicant
    const literals: SignalId[] = [];

    for (let i = 0; i < mf.numInputs; i++) {
      const bit = 1 << i;

      // Skip don't-care bits
      if (imp.mask & bit) continue;

      const inputSig = inputSignals[i];
      const isNegated = (imp.value & bit) === 0;

      if (isNegated) {
        literals.push(getNot(inputSig));
      } else {
        literals.push(inputSig);
      }
    }

    // Build NOT(product) = NAND(all literals)
    if (literals.length === 0) {
      // Implicant is constant 1 (all don't cares)
      // NOT(1) = 0, need a constant 0
      // For now, create NAND(any_input, NOT(any_input)) = NAND(x, ~x) = 1
      // Then NOT that... this is getting complex. Let's just use input[0]
      // Actually, if implicant is constant 1, the whole output is 1
      // So we just need output = 1 = NOT(0)
      // Create: temp = NAND(x, NOT(x)) where x is any signal
      // Actually simplest: if any implicant is all don't cares, output = 1
      // output = NAND(x, NAND(x, x)) for any input x
      const x = inputSignals[0];
      const notX = getNot(x);
      const one = createTempSignal(builder);
      addGate(builder, x, notX, one); // 1 = NAND(x, ~x)
      // But we need output = 1, so output = NAND(NAND(1,1), NAND(1,1))? No, that's 1
      // Just set output directly... but that requires special handling
      // For now, treat as productNot = 0
      const zero = createTempSignal(builder);
      addGate(builder, one, one, zero); // 0 = NOT(1)
      productNots.push(zero);
    } else if (literals.length === 1) {
      // Single literal: NOT(product) = NOT(literal)
      productNots.push(getNot(literals[0]));
    } else {
      // Multiple literals: build AND tree then negate
      // AND(a,b,c,...) using NANDs:
      // First compute NAND(a,b) = NOT(a AND b)
      // Then AND(a,b,c) = AND(AND(a,b), c) = NOT(NAND(AND(a,b), c))
      //                 = NOT(NAND(NOT(NAND(a,b)), c))
      // This gets complex. Let me use a simpler approach.

      // Build NAND tree: NAND(a, NAND(b, NAND(c, ...)))
      // No wait, that's not AND either.

      // Correct approach for AND:
      // AND(a,b) = NOT(NAND(a,b))
      // AND(a,b,c) = AND(AND(a,b), c) = NOT(NAND(NOT(NAND(a,b)), c))

      // Actually, for NOT(AND(a,b,c,...)) = NAND(a,b,c,...) decomposed to 2-input:
      // NAND(a,b,c) = NOT(a AND b AND c) = NOT(AND(AND(a,b), c))
      //            = NAND(AND(a,b), c)
      //            = NAND(NOT(NAND(a,b)), c)

      // So NOT(product) where product = AND(L1, L2, ..., Ln):
      // We want NAND(L1, L2, ..., Ln) decomposed to 2-input NANDs

      // Build: nand2(L1, L2) = NOT(L1 AND L2)
      //        and2 = NOT(nand2) = L1 AND L2
      //        nand3 = NAND(and2, L3) = NOT(L1 AND L2 AND L3)
      //        ... etc

      let result = literals[0];
      for (let i = 1; i < literals.length; i++) {
        if (i === literals.length - 1) {
          // Last iteration: we want NAND(accumulated_and, last_literal)
          // which gives us NOT(full product)
          const notProd = createTempSignal(builder);
          addGate(builder, result, literals[i], notProd);
          result = notProd;
        } else {
          // Intermediate: compute AND so far
          const nand = createTempSignal(builder);
          addGate(builder, result, literals[i], nand);
          // AND = NOT(NAND)
          const and = createTempSignal(builder);
          addGate(builder, nand, nand, and);
          result = and;
        }
      }
      productNots.push(result);
    }
  }

  // Final OR of products: OR(P1, P2, ...) = NAND(NOT(P1), NOT(P2), ...)
  // We already have NOT(Pi) in productNots
  // So output = NAND(productNots[0], NAND(productNots[1], ...))
  // Wait no, that's not right either.

  // NAND(a, b, c) = NOT(a AND b AND c)
  // But we want OR(P1, P2, P3) = NOT(AND(NOT(P1), NOT(P2), NOT(P3))) by De Morgan
  //                            = NAND(NOT(P1), NOT(P2), NOT(P3))
  // We have NOT(Pi) already, so we need NAND of all productNots

  if (productNots.length === 1) {
    // Single product: output = P1 = NOT(NOT(P1))
    addGate(builder, productNots[0], productNots[0], outputSignal);
  } else {
    // Build NAND tree for final OR
    // NAND(a, b, c, ...) decomposed:
    // NAND(a, NAND(NOT(b), NOT(c), ...)) = NOT(a AND NOT(NAND(NOT(b), NOT(c), ...)))
    // Hmm, this is getting confusing. Let me think again.

    // We have: productNots = [NOT(P1), NOT(P2), ...]
    // We want: output = OR(P1, P2, ...) = NAND(NOT(P1), NOT(P2), ...)

    // For 2 inputs: output = NAND(NOT(P1), NOT(P2))
    // For 3 inputs: output = NAND(NOT(P1), NOT(P2), NOT(P3))
    //             = NOT(NOT(P1) AND NOT(P2) AND NOT(P3))
    //             Using 2-input NANDs:
    //             temp1 = NAND(NOT(P1), NOT(P2)) = NOT(NOT(P1) AND NOT(P2)) = P1 OR P2
    //             We want P1 OR P2 OR P3 = temp1 OR P3
    //                                    = NAND(NOT(temp1), NOT(P3))

    // Wait, let me reconsider. If I have productNots = [~P1, ~P2, ~P3]:
    // output = P1 | P2 | P3 = ~(~P1 & ~P2 & ~P3) = NAND(~P1, ~P2, ~P3)
    //
    // To build NAND(~P1, ~P2, ~P3) with 2-input NANDs:
    // Let's compute AND(~P1, ~P2) first:
    //   nand12 = NAND(~P1, ~P2) = ~(~P1 & ~P2) = P1 | P2
    //   and12 = NOT(nand12) = ~P1 & ~P2
    // Then NAND(and12, ~P3) = ~(~P1 & ~P2 & ~P3) = P1 | P2 | P3

    // So the pattern: accumulate AND of productNots, then NAND with last one
    let accumulated = productNots[0];
    for (let i = 1; i < productNots.length; i++) {
      if (i === productNots.length - 1) {
        // Last one: NAND to get final OR
        addGate(builder, accumulated, productNots[i], outputSignal);
      } else {
        // Intermediate: AND then continue
        const nand = createTempSignal(builder);
        addGate(builder, accumulated, productNots[i], nand);
        const and = createTempSignal(builder);
        addGate(builder, nand, nand, and);
        accumulated = and;
      }
    }
  }

  return {
    gates: builder.gates,
    originalGateCount,
    tempSignals: builder.tempSignals,
  };
}

function createTempSignal(builder: GateBuilder): SignalId {
  const id = builder.nextSignalId++;
  builder.tempSignals.push(id);
  return id;
}

function addGate(builder: GateBuilder, in1: SignalId, in2: SignalId, out: SignalId): void {
  builder.gates.push({
    id: builder.nextGateId++,
    in1,
    in2,
    out,
    level: -1, // Will be recomputed during levelization
  });
}

/**
 * Estimate gate count for a minimized function before actually building.
 */
export function estimateGateCount(mf: MinimizedFunction): number {
  if (mf.implicants.length === 0) return 0;

  let count = 0;

  // NOT gates for negated literals (worst case: all inputs)
  const negatedInputs = new Set<number>();
  for (const imp of mf.implicants) {
    for (let i = 0; i < mf.numInputs; i++) {
      const bit = 1 << i;
      if (!(imp.mask & bit) && !(imp.value & bit)) {
        negatedInputs.add(i);
      }
    }
  }
  count += negatedInputs.size; // One NOT per negated input

  // Product terms
  for (const imp of mf.implicants) {
    const numLiterals = imp.numLiterals;
    if (numLiterals <= 1) {
      count += 1; // Just a NOT for single literal
    } else {
      // AND tree: (n-1) NANDs + (n-2) NOTs for intermediate ANDs + 1 final NAND
      // Actually: for n literals, we need (n-1) 2-input operations
      // Each builds AND except last which gives NAND
      // Intermediate ANDs: (n-2) pairs of NAND+NOT = 2*(n-2) gates
      // Plus 1 final NAND = 1 gate
      // Total per product: 2*(n-2) + 1 = 2n - 3 gates
      count += Math.max(1, 2 * numLiterals - 3);
    }
  }

  // Final OR
  const numProducts = mf.implicants.length;
  if (numProducts === 1) {
    count += 1; // Just NOT of the product's NOT
  } else {
    // Similar to product: 2*(n-1) - 1 for n products
    count += Math.max(1, 2 * numProducts - 3);
  }

  return count;
}
