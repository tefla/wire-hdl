// Quine-McCluskey Algorithm: Two-level logic minimization
//
// This implements the classic Q-M algorithm to find a minimal
// sum-of-products (SOP) representation of a boolean function.

import { TruthTable } from './truth-table.js';

export interface Implicant {
  // Binary value (where mask bits are 0)
  value: number;

  // Mask indicating don't-care bits (1 = don't care)
  mask: number;

  // Minterms covered by this implicant
  coveredMinterms: Set<number>;

  // Number of literals (numInputs - popcount(mask))
  numLiterals: number;
}

export interface MinimizedFunction {
  // Number of input variables
  numInputs: number;

  // Prime implicants that cover all minterms
  implicants: Implicant[];

  // Original minterm count
  originalMinterms: number;
}

/**
 * Run Quine-McCluskey minimization on a truth table.
 */
export function quineMcCluskey(tt: TruthTable): MinimizedFunction {
  const { numInputs, minterms, dontCares } = tt;

  // Handle trivial cases
  if (minterms.length === 0) {
    return { numInputs, implicants: [], originalMinterms: 0 };
  }

  const numCombinations = 1 << numInputs;
  if (minterms.length === numCombinations) {
    // Always 1 - single implicant with all don't cares
    return {
      numInputs,
      implicants: [{
        value: 0,
        mask: numCombinations - 1,
        coveredMinterms: new Set(minterms),
        numLiterals: 0,
      }],
      originalMinterms: minterms.length,
    };
  }

  // Combine minterms and don't-cares for prime implicant generation
  const allTerms = new Set([...minterms, ...dontCares]);

  // Step 1: Find all prime implicants
  const primeImplicants = findPrimeImplicants(allTerms, numInputs);

  // Step 2: Find minimum cover (only need to cover actual minterms, not don't-cares)
  const mintermSet = new Set(minterms);
  const cover = findMinimumCover(primeImplicants, mintermSet);

  return {
    numInputs,
    implicants: cover,
    originalMinterms: minterms.length,
  };
}

/**
 * Find all prime implicants using iterative combination.
 */
function findPrimeImplicants(terms: Set<number>, numInputs: number): Implicant[] {
  // Group terms by number of 1s
  type ImplicantWithUsed = Implicant & { used: boolean };

  let currentImplicants: ImplicantWithUsed[] = [];

  // Initialize with minterms
  for (const term of terms) {
    currentImplicants.push({
      value: term,
      mask: 0,
      coveredMinterms: new Set([term]),
      numLiterals: numInputs,
      used: false,
    });
  }

  const primeImplicants: Implicant[] = [];

  // Iteratively combine implicants
  while (currentImplicants.length > 0) {
    // Group by number of 1s in value (excluding masked bits)
    const groups = new Map<number, ImplicantWithUsed[]>();

    for (const imp of currentImplicants) {
      const ones = countOnes(imp.value & ~imp.mask);
      if (!groups.has(ones)) {
        groups.set(ones, []);
      }
      groups.get(ones)!.push(imp);
    }

    const nextImplicants: ImplicantWithUsed[] = [];
    const seen = new Set<string>(); // To avoid duplicates

    // Try to combine adjacent groups
    const sortedGroups = Array.from(groups.keys()).sort((a, b) => a - b);

    for (let i = 0; i < sortedGroups.length - 1; i++) {
      const group1 = groups.get(sortedGroups[i])!;
      const group2 = groups.get(sortedGroups[i + 1])!;

      for (const imp1 of group1) {
        for (const imp2 of group2) {
          // Can only combine if masks match
          if (imp1.mask !== imp2.mask) continue;

          // Check if they differ in exactly one bit
          const diff = imp1.value ^ imp2.value;
          if (countOnes(diff) === 1 && (diff & imp1.mask) === 0) {
            // Combine them
            const newMask = imp1.mask | diff;
            const newValue = imp1.value & ~diff;

            const key = `${newValue}:${newMask}`;
            if (!seen.has(key)) {
              seen.add(key);

              const combined: ImplicantWithUsed = {
                value: newValue,
                mask: newMask,
                coveredMinterms: new Set([...imp1.coveredMinterms, ...imp2.coveredMinterms]),
                numLiterals: numInputs - countOnes(newMask),
                used: false,
              };
              nextImplicants.push(combined);
            }

            imp1.used = true;
            imp2.used = true;
          }
        }
      }
    }

    // Implicants that weren't combined are prime
    for (const imp of currentImplicants) {
      if (!imp.used) {
        primeImplicants.push({
          value: imp.value,
          mask: imp.mask,
          coveredMinterms: imp.coveredMinterms,
          numLiterals: imp.numLiterals,
        });
      }
    }

    currentImplicants = nextImplicants;
  }

  return primeImplicants;
}

/**
 * Find minimum cover using greedy algorithm with essential prime implicants.
 */
function findMinimumCover(primeImplicants: Implicant[], minterms: Set<number>): Implicant[] {
  const cover: Implicant[] = [];
  const uncovered = new Set(minterms);

  // First, find essential prime implicants
  // An essential PI is the only one covering some minterm
  while (uncovered.size > 0) {
    // Find essential PIs
    let foundEssential = false;

    for (const minterm of uncovered) {
      const coveringPIs = primeImplicants.filter(pi =>
        pi.coveredMinterms.has(minterm) &&
        !cover.includes(pi)
      );

      if (coveringPIs.length === 1) {
        // Essential PI
        const pi = coveringPIs[0];
        cover.push(pi);

        // Remove covered minterms
        for (const m of pi.coveredMinterms) {
          uncovered.delete(m);
        }

        foundEssential = true;
        break;
      }
    }

    if (!foundEssential && uncovered.size > 0) {
      // No essential PI found - use greedy selection
      // Pick the PI that covers the most uncovered minterms
      let bestPI: Implicant | null = null;
      let bestCover = 0;

      for (const pi of primeImplicants) {
        if (cover.includes(pi)) continue;

        let coverCount = 0;
        for (const m of pi.coveredMinterms) {
          if (uncovered.has(m)) coverCount++;
        }

        // Prefer PIs that cover more minterms, then fewer literals
        if (coverCount > bestCover || (coverCount === bestCover && bestPI && pi.numLiterals < bestPI.numLiterals)) {
          bestCover = coverCount;
          bestPI = pi;
        }
      }

      if (bestPI) {
        cover.push(bestPI);
        for (const m of bestPI.coveredMinterms) {
          uncovered.delete(m);
        }
      } else {
        // Should not happen if primeImplicants cover all minterms
        throw new Error('Cannot cover all minterms');
      }
    }
  }

  return cover;
}

/**
 * Count number of 1 bits in a number.
 */
function countOnes(n: number): number {
  let count = 0;
  while (n) {
    count += n & 1;
    n >>>= 1;
  }
  return count;
}

/**
 * Convert an implicant to a human-readable string for debugging.
 */
export function implicantToString(imp: Implicant, numInputs: number, varNames?: string[]): string {
  const terms: string[] = [];

  for (let i = 0; i < numInputs; i++) {
    const bit = 1 << i;

    // Skip don't-care bits
    if (imp.mask & bit) continue;

    const varName = varNames ? varNames[i] : `x${i}`;
    const isNegated = (imp.value & bit) === 0;

    terms.push(isNegated ? `~${varName}` : varName);
  }

  if (terms.length === 0) return '1'; // Constant 1
  return terms.join(' & ');
}

/**
 * Convert minimized function to SOP string for debugging.
 */
export function minimizedToString(mf: MinimizedFunction, varNames?: string[]): string {
  if (mf.implicants.length === 0) return '0';

  const terms = mf.implicants.map(imp => implicantToString(imp, mf.numInputs, varNames));
  return terms.join(' | ');
}
