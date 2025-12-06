import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parse, elaborate, levelize, optimize, compileToWasmOptimized } from '../src/index.js';
import { extractCones } from '../src/optimizer/cone-extractor.js';

describe('CPU Optimizer Debug', () => {
  it('should analyze CPU optimization', () => {
    // Load the actual CPU wire files
    const wireDir = './wire';
    const wireFiles = fs.readdirSync(wireDir).filter(f => f.endsWith('.wire')).sort();
    
    const sources = wireFiles.map(f => {
      return fs.readFileSync(path.join(wireDir, f), 'utf-8');
    });

    const allSource = sources.join('\n');
    const program = parse(allSource);
    const netlist = elaborate(program, 'cpu_minimal');
    console.log(`Original: ${netlist.nandGates.length} gates, ${netlist.dffs.length} DFFs`);

    // Extract cones
    const cones = extractCones(netlist);
    console.log(`Cones extracted: ${cones.length}`);

    // Check for shared gates
    const gateIdToConesUsed = new Map<number, number[]>();
    cones.forEach((cone, coneIdx) => {
      for (const gate of cone.gates) {
        if (!gateIdToConesUsed.has(gate.id)) {
          gateIdToConesUsed.set(gate.id, []);
        }
        gateIdToConesUsed.get(gate.id)!.push(coneIdx);
      }
    });

    let sharedGates = 0;
    for (const [gateId, conesUsed] of gateIdToConesUsed) {
      if (conesUsed.length > 1) {
        sharedGates++;
      }
    }
    console.log(`Shared gates: ${sharedGates}`);

    // Count gates per cone
    let totalConeGates = 0;
    let optimizableCones = 0;
    for (const cone of cones) {
      totalConeGates += cone.gates.length;
      if (cone.inputs.length <= 10 && cone.gates.length >= 3) {
        optimizableCones++;
      }
    }
    console.log(`Total cone gates (with overlap): ${totalConeGates}`);
    console.log(`Optimizable cones: ${optimizableCones}`);

    // Now optimize and compare
    const optimized = optimize(netlist, { maxConeInputs: 10, minSavingsPercent: 5, verbose: false });
    console.log(`\nOptimization stats:`, optimized.stats);
    console.log(`Gate change: ${netlist.nandGates.length} -> ${optimized.netlist.nandGates.length}`);

    if (optimized.netlist.nandGates.length > netlist.nandGates.length) {
      console.log(`\nWARNING: Optimization increased gates!`);
    }
  });
});
