import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse, elaborate, levelize, type LevelizedNetlist } from '../src/index.js';
import { compileToWasm, compileToWasmOptimized, type CompiledCircuit } from '../src/compiler/index.js';

const CPU_SOURCES = [
  'gates.wire', 'arithmetic.wire', 'registers.wire', 'mux8.wire',
  'mux4way8.wire', 'mux8way8.wire', 'mux16.wire', 'adder16.wire',
  'inc16.wire', 'register16.wire', 'decoder.wire', 'alu8.wire',
  'pc.wire', 'cpu_minimal.wire',
];

describe('Debug Address Bus', () => {
  it('should trace address bus during reset', () => {
    // Load CPU
    const wireDir = './wire';
    const sources = CPU_SOURCES.map(file => readFileSync(join(wireDir, file), 'utf-8'));
    const program = parse(sources.join('\n'));
    const netlist = elaborate(program, 'cpu_minimal');
    const levelized = levelize(netlist);
    // Try non-optimized compiler
    const circuit = compileToWasm(levelized);
    console.log('Using non-optimized compiler');

    // Find signal IDs
    const getSignalId = (name: string): number => {
      const id = levelized.signalMap.get(name);
      if (id === undefined) throw new Error(`Signal not found: ${name}`);
      return id;
    };

    const clkId = getSignalId('clk');
    const resetId = getSignalId('reset');
    const dataInIds = Array.from({length: 8}, (_, i) => getSignalId(`data_in[${i}]`));

    console.log('\nPrimary inputs:');
    console.log(`  clk = ${clkId}`);
    console.log(`  reset = ${resetId}`);
    console.log(`  data_in = ${dataInIds.join(', ')}`);
    console.log(`  data_in[6] = ${dataInIds[6]}`);
    const addrIds = Array.from({length: 16}, (_, i) => getSignalId(`addr[${i}]`));
    const stateIds = Array.from({length: 5}, (_, i) => getSignalId(`state_out[${i}]`));

    // Check for debug signals
    let debugIsState20Id: number | undefined;
    let debugIsState21Id: number | undefined;
    let debugResetTargetIds: number[] = [];
    try {
      debugIsState20Id = getSignalId('debug_is_state_20');
      debugIsState21Id = getSignalId('debug_is_state_21');
      for (let i = 0; i < 16; i++) {
        debugResetTargetIds.push(getSignalId(`debug_reset_target[${i}]`));
      }
      console.log('Found debug signals');
    } catch (e) {
      console.log('Debug signals not found:', e);
    }

    // Check all signal names to find reset_vec_lo
    console.log('\nLooking for reset_vec signals:');
    const resetVecLoIds: number[] = [];
    const resetVecAddrIds: number[] = [];
    let isResetStateId: number | undefined;
    for (const [name, id] of levelized.signalMap) {
      if (name.includes('reset_vec') || name.includes('is_reset')) {
        console.log(`  ${name} = ${id}`);
      }
      // Collect reset_vec_lo and reset_vec_addr bit IDs
      const loMatch = name.match(/^reset_vec_lo\[(\d+)\]$/);
      if (loMatch) resetVecLoIds[parseInt(loMatch[1])] = id;
      const addrMatch = name.match(/^reset_vec_addr\[(\d+)\]$/);
      if (addrMatch) resetVecAddrIds[parseInt(addrMatch[1])] = id;
      if (name === 'is_reset_state') isResetStateId = id;
    }

    const readBits = (ids: number[]): number => {
      let value = 0;
      for (let i = 0; i < ids.length; i++) {
        value |= circuit.getSignal(ids[i]) << i;
      }
      return value;
    };

    const writeBits = (ids: number[], value: number): void => {
      for (let i = 0; i < ids.length; i++) {
        circuit.setSignal(ids[i], (value >> i) & 1);
      }
    };

    // Provide data_in = 0 initially
    writeBits(dataInIds, 0);

    // Assert reset
    circuit.setSignal(resetId, 1);
    circuit.setSignal(clkId, 1);

    console.log('\n=== Reset phase ===');
    for (let i = 0; i < 5; i++) {
      // Read state BEFORE evaluate
      const state = readBits(stateIds);
      const addr = readBits(addrIds);

      // Provide data_in based on address BEFORE evaluate
      let dataIn = 0;
      if (addr === 0xFFFC) dataIn = 0x00;  // Low byte of reset vector
      else if (addr === 0xFFFD) dataIn = 0xC0;  // High byte -> $C000
      writeBits(dataInIds, dataIn);

      let debugInfo = '';
      if (debugIsState20Id !== undefined) {
        debugInfo += ` is_state_20=${circuit.getSignal(debugIsState20Id)}`;
      }
      if (debugIsState21Id !== undefined) {
        debugInfo += ` is_state_21=${circuit.getSignal(debugIsState21Id)}`;
      }

      // Check individual addr bits
      const addrBits = addrIds.map(id => circuit.getSignal(id));

      // Read reset vector constants
      const resetVecLo = resetVecLoIds.length > 0 ? readBits(resetVecLoIds) : -1;
      const resetVecAddr = resetVecAddrIds.length > 0 ? readBits(resetVecAddrIds) : -1;
      const isResetState = isResetStateId !== undefined ? circuit.getSignal(isResetStateId) : -1;

      console.log(`Cycle ${i}: state=${state}, addr=$${addr.toString(16).padStart(4,'0')}, data_in=$${dataIn.toString(16)}${debugInfo}`);
      console.log(`  addr bits: ${addrBits.join('')}`);
      console.log(`  reset_vec_lo=$${resetVecLo.toString(16)}, reset_vec_addr=$${resetVecAddr.toString(16)}, is_reset_state=${isResetState}`);

      circuit.evaluate();
    }

    // Release reset
    circuit.setSignal(resetId, 0);
    console.log('\n=== Post-reset phase ===');

    // Find reset_hi DFFs and their D inputs
    console.log('\n=== reset_hi DFFs ===');
    const resetHiBits: number[] = [];
    for (const [name, id] of levelized.signalMap) {
      const match = name.match(/^reset_hi\[(\d+)\]$/);
      if (match) {
        resetHiBits[parseInt(match[1])] = id;
        console.log(`  Found signal reset_hi[${match[1]}] = ${id}`);
      }
    }
    console.log(`  Total reset_hi bits: ${resetHiBits.length}`);
    console.log(`  Total DFFs: ${levelized.dffs.length}`);

    // Check all DFFs
    for (const dff of levelized.dffs) {
      for (let bit = 0; bit < resetHiBits.length; bit++) {
        if (dff.q === resetHiBits[bit]) {
          // Find the name of the D input signal
          const dName = Array.from(levelized.signalMap).find(([n, id]) => id === dff.d)?.[0] || `unknown(${dff.d})`;
          console.log(`  MATCH: reset_hi[${bit}]: q=${dff.q}, d=${dff.d} (${dName})`);
        }
      }
    }

    // Check first few DFFs
    console.log('\nFirst 10 DFFs:');
    for (let i = 0; i < Math.min(10, levelized.dffs.length); i++) {
      const dff = levelized.dffs[i];
      const qName = Array.from(levelized.signalMap).find(([n, id]) => id === dff.q)?.[0] || `unknown`;
      const dName = Array.from(levelized.signalMap).find(([n, id]) => id === dff.d)?.[0] || `unknown`;
      console.log(`  DFF ${i}: q=${dff.q}(${qName}), d=${dff.d}(${dName})`);
    }

    // Find DFFs with reset_hi in their name
    console.log('\nDFFs with reset_hi in name:');
    for (const dff of levelized.dffs) {
      const qName = Array.from(levelized.signalMap).find(([n, id]) => id === dff.q)?.[0] || `unknown`;
      const dName = Array.from(levelized.signalMap).find(([n, id]) => id === dff.d)?.[0] || `unknown`;
      if (qName.includes('reset_hi') || dName.includes('reset_hi')) {
        console.log(`  DFF: q=${dff.q}(${qName}), d=${dff.d}(${dName})`);
      }
    }

    // Find signals that output to reset_hi
    console.log('\nSignals related to reset_hi:');
    for (const [name, id] of levelized.signalMap) {
      if (name.includes('reset_hi')) {
        console.log(`  ${name} = ${id}`);
      }
    }

    // For reset_hi signal IDs, find their drivers
    console.log('\nWhat drives reset_hi signals?');
    for (let bit = 0; bit < 8; bit++) {
      const sigId = resetHiBits[bit];
      console.log(`\n  reset_hi[${bit}] (signal ${sigId}):`);

      // Check if driven by a DFF
      for (const dff of levelized.dffs) {
        if (dff.q === sigId) {
          console.log(`    -> DFF output`);
        }
      }

      // Check if driven by a NAND
      for (const level of levelized.levels) {
        for (const gate of level) {
          if (gate.out === sigId) {
            const in1Name = Array.from(levelized.signalMap).find(([n, id]) => id === gate.in1)?.[0] || `?`;
            const in2Name = Array.from(levelized.signalMap).find(([n, id]) => id === gate.in2)?.[0] || `?`;
            console.log(`    -> NAND(${gate.in1}=${in1Name}, ${gate.in2}=${in2Name})`);
          }
        }
      }

      // Check if it's a primary input
      if (levelized.inputs && levelized.inputs.includes && levelized.inputs.includes(sigId)) {
        console.log(`    -> Primary input`);
      }

      // Trace back the buffer chain
      let traceId = sigId;
      for (let depth = 0; depth < 5; depth++) {
        let found = false;
        for (const level of levelized.levels) {
          for (const gate of level) {
            if (gate.out === traceId && gate.in1 === gate.in2) {
              // This is a buffer - trace further back
              const inName = Array.from(levelized.signalMap).find(([n, id]) => id === gate.in1)?.[0] || `?`;
              console.log(`    buffer from ${gate.in1}(${inName})`);
              traceId = gate.in1;
              found = true;
              break;
            }
          }
          if (found) break;
        }
        if (!found) break;
      }

      // Now check if the final traced signal is a DFF output
      for (const dff of levelized.dffs) {
        if (dff.q === traceId) {
          const dName = Array.from(levelized.signalMap).find(([n, id]) => id === dff.d)?.[0] || `?`;
          console.log(`    -> DFF: d=${dff.d}(${dName}), q=${dff.q}`);

          // Store the feedback signal ID for bit 6
          if (bit === 6) {
            (globalThis as any).resetHi6FeedbackId = dff.d;
            (globalThis as any).resetHi6QId = dff.q;
          }
        }
      }
    }

    // Get the feedback signal for reset_hi[6]
    const resetHi6FeedbackId = (globalThis as any).resetHi6FeedbackId;
    const resetHi6QId = (globalThis as any).resetHi6QId;
    console.log(`\nTracking reset_hi[6]: feedback=${resetHi6FeedbackId}, q=${resetHi6QId}`);

    // Trace what feeds into feedback (signal 3948)
    console.log('\nTracing feedback signal (mux output):');
    for (const level of levelized.levels) {
      for (const gate of level) {
        if (gate.out === resetHi6FeedbackId) {
          const in1Name = Array.from(levelized.signalMap).find(([n, id]) => id === gate.in1)?.[0] || `?`;
          const in2Name = Array.from(levelized.signalMap).find(([n, id]) => id === gate.in2)?.[0] || `?`;
          console.log(`  feedback driven by NAND(${gate.in1}=${in1Name}, ${gate.in2}=${in2Name})`);

          // Store these for runtime checking
          (globalThis as any).feedbackIn1 = gate.in1;
          (globalThis as any).feedbackIn2 = gate.in2;
        }
      }
    }

    // Trace full mux chain with levels
    console.log('\nFull mux chain for feedback (with levels):');
    let toTrace = [resetHi6FeedbackId];
    const traced = new Set<number>();
    for (let depth = 0; depth < 10 && toTrace.length > 0; depth++) {
      const current = toTrace.shift()!;
      if (traced.has(current)) continue;
      traced.add(current);

      for (let levelIdx = 0; levelIdx < levelized.levels.length; levelIdx++) {
        const level = levelized.levels[levelIdx];
        for (const gate of level) {
          if (gate.out === current) {
            const in1Name = Array.from(levelized.signalMap).find(([n, id]) => id === gate.in1)?.[0] || `?`;
            const in2Name = Array.from(levelized.signalMap).find(([n, id]) => id === gate.in2)?.[0] || `?`;
            const outName = Array.from(levelized.signalMap).find(([n, id]) => id === gate.out)?.[0] || `?`;
            console.log(`  [L${levelIdx}] ${outName}(${gate.out}) = NAND(${in1Name}(${gate.in1}), ${in2Name}(${gate.in2}))`);
            toTrace.push(gate.in1, gate.in2);
          }
        }
      }
    }

    // Also find the level of is_state_21 computation and its inputs
    console.log('\nLevel of is_state_21:');
    for (let levelIdx = 0; levelIdx < levelized.levels.length; levelIdx++) {
      const level = levelized.levels[levelIdx];
      for (const gate of level) {
        if (gate.out === 169) { // is_state_21
          const in1Name = Array.from(levelized.signalMap).find(([n, id]) => id === gate.in1)?.[0] || `?`;
          const in2Name = Array.from(levelized.signalMap).find(([n, id]) => id === gate.in2)?.[0] || `?`;
          console.log(`  [L${levelIdx}] is_state_21(169) = NAND(${in1Name}(${gate.in1}), ${in2Name}(${gate.in2}))`);
          // Store for tracing
          (globalThis as any).is_state_21_in1 = gate.in1;
          (globalThis as any).is_state_21_in2 = gate.in2;
        }
      }
    }

    // Trace the full chain that computes is_state_21
    console.log('\nFull chain computing is_state_21:');
    let is21Trace = [169];
    const is21Traced = new Set<number>();
    for (let depth = 0; depth < 20 && is21Trace.length > 0; depth++) {
      const current = is21Trace.shift()!;
      if (is21Traced.has(current)) continue;
      is21Traced.add(current);

      for (let levelIdx = 0; levelIdx < levelized.levels.length; levelIdx++) {
        const level = levelized.levels[levelIdx];
        for (const gate of level) {
          if (gate.out === current) {
            const in1Name = Array.from(levelized.signalMap).find(([n, id]) => id === gate.in1)?.[0] || `?`;
            const in2Name = Array.from(levelized.signalMap).find(([n, id]) => id === gate.in2)?.[0] || `?`;
            const outName = Array.from(levelized.signalMap).find(([n, id]) => id === gate.out)?.[0] || `?`;
            console.log(`  [L${levelIdx}] ${outName}(${gate.out}) = NAND(${in1Name}(${gate.in1}), ${in2Name}(${gate.in2}))`);
            is21Trace.push(gate.in1, gate.in2);
          }
        }
      }
    }

    // Check for multiple writers to signal 3953 (and_1034_n)
    console.log('\nAll gates writing to signal 3953:');
    for (let levelIdx = 0; levelIdx < levelized.levels.length; levelIdx++) {
      const level = levelized.levels[levelIdx];
      for (const gate of level) {
        if (gate.out === 3953) {
          const in1Name = Array.from(levelized.signalMap).find(([n, id]) => id === gate.in1)?.[0] || `?`;
          const in2Name = Array.from(levelized.signalMap).find(([n, id]) => id === gate.in2)?.[0] || `?`;
          console.log(`  [L${levelIdx}] signal 3953 = NAND(${in1Name}(${gate.in1}), ${in2Name}(${gate.in2}))`);
        }
      }
    }

    // Check DFFs for state bits
    console.log('\nDFFs for state bits:');
    const stateBitIds = [138, 139, 140, 141, 142]; // state0-4 from the trace
    for (const dff of levelized.dffs) {
      for (let i = 0; i < stateBitIds.length; i++) {
        if (dff.q === stateBitIds[i]) {
          const dName = Array.from(levelized.signalMap).find(([n, id]) => id === dff.d)?.[0] || `?`;
          const qName = Array.from(levelized.signalMap).find(([n, id]) => id === dff.q)?.[0] || `?`;
          console.log(`  state${i}: DFF q=${dff.q}(${qName}), d=${dff.d}(${dName})`);
        }
      }
    }

    // Check if anything writes to data_in signals (should be primary inputs only)
    console.log('\nGates writing to data_in signals:');
    for (let levelIdx = 0; levelIdx < levelized.levels.length; levelIdx++) {
      const level = levelized.levels[levelIdx];
      for (const gate of level) {
        if (gate.out >= 2 && gate.out <= 9) {
          const in1Name = Array.from(levelized.signalMap).find(([n, id]) => id === gate.in1)?.[0] || `?`;
          const in2Name = Array.from(levelized.signalMap).find(([n, id]) => id === gate.in2)?.[0] || `?`;
          const outName = Array.from(levelized.signalMap).find(([n, id]) => id === gate.out)?.[0] || `?`;
          console.log(`  [L${levelIdx}] ${outName}(${gate.out}) = NAND(${in1Name}(${gate.in1}), ${in2Name}(${gate.in2}))`);
        }
      }
    }

    // Check if any DFFs write to data_in signals
    console.log('\nDFFs writing to data_in signals:');
    for (const dff of levelized.dffs) {
      if (dff.q >= 2 && dff.q <= 9) {
        const qName = Array.from(levelized.signalMap).find(([n, id]) => id === dff.q)?.[0] || `?`;
        console.log(`  DFF writes to ${qName}(${dff.q})`);
      }
    }

    // Check which levels read from word 0 (signals 0-31)
    console.log('\nLevels that read from word 0 (signals 0-31):');
    for (let levelIdx = 0; levelIdx < levelized.levels.length && levelIdx < 15; levelIdx++) {
      const level = levelized.levels[levelIdx];
      const readsWord0 = level.some(gate => gate.in1 < 32 || gate.in2 < 32);
      if (readsWord0) {
        const gates = level.filter(gate => gate.in1 < 32 || gate.in2 < 32);
        console.log(`  Level ${levelIdx}: ${gates.length} gates read from word 0`);
        // Show first few
        for (let i = 0; i < Math.min(3, gates.length); i++) {
          const g = gates[i];
          const in1Name = Array.from(levelized.signalMap).find(([n, id]) => id === g.in1)?.[0] || `?`;
          const in2Name = Array.from(levelized.signalMap).find(([n, id]) => id === g.in2)?.[0] || `?`;
          console.log(`    NAND(${in1Name}(${g.in1}), ${in2Name}(${g.in2}))`);
        }
      }
    }

    // Find PC and reset_target signals
    const pcIds = Array.from({length: 16}, (_, i) => {
      try { return getSignalId(`pc_out[${i}]`); } catch { return -1; }
    }).filter(id => id !== -1);
    const resetTargetIds = Array.from({length: 16}, (_, i) => {
      try { return getSignalId(`debug_reset_target[${i}]`); } catch { return -1; }
    }).filter(id => id !== -1);
    const debugAddrLoIds = Array.from({length: 8}, (_, i) => {
      try { return getSignalId(`debug_addr_lo[${i}]`); } catch { return -1; }
    }).filter(id => id !== -1);
    const debugResetHiIds = Array.from({length: 8}, (_, i) => {
      try { return getSignalId(`debug_reset_hi[${i}]`); } catch { return -1; }
    }).filter(id => id !== -1);
    const debugDataInIds = Array.from({length: 8}, (_, i) => {
      try { return getSignalId(`debug_data_in[${i}]`); } catch { return -1; }
    }).filter(id => id !== -1);
    let pcLoadId: number | undefined;
    let addrLoLoadId: number | undefined;
    let isState21Id: number | undefined;
    try { pcLoadId = getSignalId('debug_pc_load'); } catch {}
    try { addrLoLoadId = getSignalId('debug_addr_lo_load'); } catch {}
    try { isState21Id = getSignalId('is_state_21'); } catch {}

    for (let i = 0; i < 10; i++) {
      const state = readBits(stateIds);
      const addr = readBits(addrIds);
      const pc = pcIds.length > 0 ? readBits(pcIds) : -1;
      const resetTarget = resetTargetIds.length > 0 ? readBits(resetTargetIds) : -1;
      const debugAddrLo = debugAddrLoIds.length > 0 ? readBits(debugAddrLoIds) : -1;
      const debugResetHi = debugResetHiIds.length > 0 ? readBits(debugResetHiIds) : -1;
      const debugDataIn = debugDataInIds.length > 0 ? readBits(debugDataInIds) : -1;
      const pcLoad = pcLoadId !== undefined ? circuit.getSignal(pcLoadId) : -1;
      const addrLoLoad = addrLoLoadId !== undefined ? circuit.getSignal(addrLoLoadId) : -1;
      const isState21 = isState21Id !== undefined ? circuit.getSignal(isState21Id) : -1;

      // Simulate memory read
      let dataIn = 0;
      if (addr === 0xFFFC) dataIn = 0x00;  // Low byte of reset vector
      else if (addr === 0xFFFD) dataIn = 0xC0;  // High byte -> $C000
      writeBits(dataInIds, dataIn);

      // Verify write worked
      const verifyDataIn = readBits(dataInIds);

      // Read feedback and q values for reset_hi[6]
      const feedback6 = resetHi6FeedbackId !== undefined ? circuit.getSignal(resetHi6FeedbackId) : -1;
      const q6 = resetHi6QId !== undefined ? circuit.getSignal(resetHi6QId) : -1;

      // Check both is_state_21 signal IDs
      const isState21_169 = circuit.getSignal(169);
      const dataIn6 = circuit.getSignal(8);

      console.log(`Cycle ${i}: state=${state}, addr=$${addr.toString(16).padStart(4,'0')}, pc=$${pc.toString(16).padStart(4,'0')}, reset_target=$${resetTarget.toString(16).padStart(4,'0')}`);
      console.log(`  debug: addr_lo=$${debugAddrLo.toString(16)}, reset_hi=$${debugResetHi.toString(16)}, data_in=$${dataIn.toString(16)}`);
      console.log(`  is_state_21 from id: ${isState21}, is_state_21(169): ${isState21_169}, data_in[6](8): ${dataIn6}`);
      console.log(`  reset_hi[6]: feedback_before=${feedback6}, q_before=${q6}`);

      circuit.evaluate();

      // Read after evaluate - check both output signals and DFF Q
      const feedback6After = resetHi6FeedbackId !== undefined ? circuit.getSignal(resetHi6FeedbackId) : -1;
      const q6After = resetHi6QId !== undefined ? circuit.getSignal(resetHi6QId) : -1;
      const stateAfterDff = [138, 139, 140, 141, 142].map(id => circuit.getSignal(id)).reduce((acc, v, i) => acc | (v << i), 0);
      const stateAfterOut = stateIds.map(id => circuit.getSignal(id)).reduce((acc, v, i) => acc | (v << i), 0);
      console.log(`  reset_hi[6]: feedback_after=${feedback6After}, q_after=${q6After}`);
      console.log(`  TIMING CHECK: state_out=${stateAfterOut}, DFF Q=${stateAfterDff}`);

      // For cycle 2 (is_state_21=1), trace state bits
      if (i === 2) {
        console.log('  === State bits comparison ===');

        // Find all signals named state0, state1, etc.
        console.log('    All "state" signals:');
        for (const [name, id] of levelized.signalMap) {
          if (name.match(/^state[0-4]$/) || name === 'state_out' || name.match(/^state_out\[\d\]$/)) {
            console.log(`      ${name} = ${id}, value = ${circuit.getSignal(id)}`);
          }
        }

        // State bits from stateIds (state_out[0-4])
        console.log(`    state_out[0-4]: ${stateIds.join(', ')}`);
        const stateOutVals = stateIds.map(id => circuit.getSignal(id));
        console.log(`    state_out values: ${stateOutVals.join(', ')} -> ${readBits(stateIds)}`);

        // State bits from DFFs (state0-4 = 138-142)
        const stateDffVals = [138, 139, 140, 141, 142].map(id => circuit.getSignal(id));
        const stateDffVal = stateDffVals[0] + (stateDffVals[1] << 1) + (stateDffVals[2] << 2) + (stateDffVals[3] << 3) + (stateDffVals[4] << 4);
        console.log(`    state0-4 (DFF 138-142) values: ${stateDffVals.join(', ')} -> ${stateDffVal}`);

        console.log(`    is_state_21(169)=${circuit.getSignal(169)}, data_in[6](8)=${circuit.getSignal(8)}`);

        // Also trace what drives state_out[0] vs state0
        console.log('    What drives state_out[0] (signal 88)?');
        let traceSignal = 88;
        for (let depth = 0; depth < 5; depth++) {
          let found = false;
          for (let levelIdx = 0; levelIdx < levelized.levels.length; levelIdx++) {
            const level = levelized.levels[levelIdx];
            for (const gate of level) {
              if (gate.out === traceSignal) {
                const in1Name = Array.from(levelized.signalMap).find(([n, id]) => id === gate.in1)?.[0] || `?`;
                const in2Name = Array.from(levelized.signalMap).find(([n, id]) => id === gate.in2)?.[0] || `?`;
                console.log(`      [L${levelIdx}] sig ${traceSignal} = NAND(${in1Name}(${gate.in1}), ${in2Name}(${gate.in2}))`);
                console.log(`      Values: in1=${circuit.getSignal(gate.in1)}, in2=${circuit.getSignal(gate.in2)}`);
                if (gate.in1 === gate.in2) {
                  // Buffer - trace further
                  traceSignal = gate.in1;
                  found = true;
                }
                break;
              }
            }
            if (found) break;
          }
          if (!found) break;
        }
        // Check if traced signal is a DFF output
        console.log(`      Traced to signal ${traceSignal}`);
        for (const dff of levelized.dffs) {
          if (dff.q === traceSignal) {
            const dName = Array.from(levelized.signalMap).find(([n, id]) => id === dff.d)?.[0] || `?`;
            console.log(`      DFF: d=${dName}(${dff.d}), q=${traceSignal}, D value=${circuit.getSignal(dff.d)}`);
          }
        }
        // Check if state_out[0] is a DFF output
        for (const dff of levelized.dffs) {
          if (dff.q === 88) {
            const dName = Array.from(levelized.signalMap).find(([n, id]) => id === dff.d)?.[0] || `?`;
            console.log(`      DFF: d=${dName}(${dff.d}), q=88`);
          }
        }

        // Trace state_out[1] too
        console.log('    What drives state_out[1] (signal 89)?');
        let traceSignal1 = 89;
        for (let depth = 0; depth < 5; depth++) {
          let found = false;
          for (let levelIdx = 0; levelIdx < levelized.levels.length; levelIdx++) {
            const level = levelized.levels[levelIdx];
            for (const gate of level) {
              if (gate.out === traceSignal1) {
                const in1Name = Array.from(levelized.signalMap).find(([n, id]) => id === gate.in1)?.[0] || `?`;
                const in2Name = Array.from(levelized.signalMap).find(([n, id]) => id === gate.in2)?.[0] || `?`;
                console.log(`      [L${levelIdx}] sig ${traceSignal1} = NAND(${in1Name}(${gate.in1}), ${in2Name}(${gate.in2}))`);
                console.log(`      Values: in1=${circuit.getSignal(gate.in1)}, in2=${circuit.getSignal(gate.in2)}`);
                if (gate.in1 === gate.in2) {
                  // Buffer - trace further
                  traceSignal1 = gate.in1;
                  found = true;
                }
                break;
              }
            }
            if (found) break;
          }
          if (!found) break;
        }
        console.log(`      Traced to signal ${traceSignal1}`);

        console.log('    What drives state0 (signal 138)?');
        for (let levelIdx = 0; levelIdx < levelized.levels.length; levelIdx++) {
          const level = levelized.levels[levelIdx];
          for (const gate of level) {
            if (gate.out === 138) {
              const in1Name = Array.from(levelized.signalMap).find(([n, id]) => id === gate.in1)?.[0] || `?`;
              const in2Name = Array.from(levelized.signalMap).find(([n, id]) => id === gate.in2)?.[0] || `?`;
              console.log(`      [L${levelIdx}] NAND(${in1Name}(${gate.in1}), ${in2Name}(${gate.in2}))`);
              console.log(`      Values: in1=${circuit.getSignal(gate.in1)}, in2=${circuit.getSignal(gate.in2)}`);
            }
          }
        }
        // Check if state0 is a DFF output
        for (const dff of levelized.dffs) {
          if (dff.q === 138) {
            const dName = Array.from(levelized.signalMap).find(([n, id]) => id === dff.d)?.[0] || `?`;
            console.log(`      DFF: d=${dName}(${dff.d}), q=138, D value=${circuit.getSignal(dff.d)}`);
          }
        }
        console.log('  === End state bits comparison ===');
      }

      // For cycle 2 (is_state_21=1), trace intermediate mux signals
      if (i === 222222) { // Disable the detailed trace
        console.log('  Mux chain values after evaluate:');
        // register8_993_register_1030_mux_1031_and_1034_n(3953) = NAND(data_in[6](8), is_state_21(169))
        const and1034_n = circuit.getSignal(3953);
        // register8_993_register_1030_mux_1031_t1(3951) = NAND(and_1034_n, and_1034_n) = NOT(and_1034_n)
        const t1 = circuit.getSignal(3951);
        // register8_993_register_1030_mux_1031_or_1035_nb(3955) = NAND(t1, t1) = NOT(t1)
        const or_nb = circuit.getSignal(3955);
        // register8_993_register_1030_mux_1031_and_1033_n(3952) = NAND(q6, nsel)
        const and1033_n = circuit.getSignal(3952);
        // register8_993_register_1030_mux_1031_t0(3950) = NAND(and1033_n, and1033_n)
        const t0 = circuit.getSignal(3950);
        // register8_993_register_1030_mux_1031_or_1035_na(3954) = NAND(t0, t0)
        const or_na = circuit.getSignal(3954);
        // feedback = NAND(or_na, or_nb)
        const feedback = circuit.getSignal(3948);
        // nsel
        const nsel = circuit.getSignal(3949);

        console.log(`    nsel=${nsel}, q6=${circuit.getSignal(3898)}, data_in[6]=${circuit.getSignal(8)}, is_state_21=${circuit.getSignal(169)}`);
        console.log(`    and1034_n=NAND(d[6],en)=${and1034_n} (expect 0 since d=1,en=1 -> NAND=0)`);
        console.log(`    t1=NOT(and1034_n)=${t1} (expect 1 since and=0)`);
        console.log(`    and1033_n=NAND(q6,nsel)=${and1033_n} (q=0,nsel=0 -> NAND=1)`);
        console.log(`    t0=NOT(and1033_n)=${t0} (expect 0 since and=1)`);
        console.log(`    or_na=NOT(t0)=${or_na}, or_nb=NOT(t1)=${or_nb}`);
        console.log(`    feedback=NAND(or_na,or_nb)=${feedback}`);
      }
    }

    // The address should have been $FFFC and $FFFD during states 20 and 21
    // If it wasn't, something is wrong with signal propagation
  });
});
