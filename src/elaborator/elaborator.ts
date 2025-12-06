// Elaborator: converts AST to flattened netlist of NAND/DFF primitives

import {
  Program,
  ModuleDecl,
  Statement,
  Expr,
  isCallExpr,
  isIndexExpr,
  isSliceExpr,
  isMemberExpr,
  isIdentifierExpr,
  isNumberExpr,
  isConcatExpr,
} from '../types/ast.js';
import {
  Netlist,
  Signal,
  NandGate,
  Dff,
  SignalId,
  createNetlist,
} from '../types/netlist.js';

// Built-in primitives that don't get flattened
const PRIMITIVES = new Set(['nand', 'dff']);

interface ElaborationContext {
  // Module registry from parsed program
  modules: Map<string, ModuleDecl>;

  // Current netlist being built
  netlist: Netlist;

  // Signal name to ID mapping for current scope
  signals: Map<string, SignalId>;

  // Bus tracking: base name -> width (for multi-bit signals)
  buses: Map<string, number>;

  // Instance counter for unique naming
  instanceCounter: number;

  // Prefix for signal names (for nested modules)
  prefix: string;
}

export class Elaborator {
  private ctx: ElaborationContext;

  constructor() {
    this.ctx = {
      modules: new Map(),
      netlist: createNetlist(''),
      signals: new Map(),
      buses: new Map(),
      instanceCounter: 0,
      prefix: '',
    };
  }

  elaborate(program: Program, topModule: string): Netlist {
    // Build module registry
    for (const mod of program.modules) {
      this.ctx.modules.set(mod.name, mod);
    }

    const top = this.ctx.modules.get(topModule);
    if (!top) {
      throw new Error(`Top module '${topModule}' not found`);
    }

    this.ctx.netlist = createNetlist(topModule);
    this.ctx.signals = new Map();
    this.ctx.buses = new Map();
    this.ctx.prefix = '';

    // Create primary input signals
    for (const param of top.params) {
      if (param.width === 1) {
        const sig = this.createSignal(param.name, true, false, false);
        this.ctx.netlist.primaryInputs.push(sig);
        if (param.name === 'clk') {
          this.ctx.netlist.clockSignal = sig;
        }
      } else {
        // Multi-bit input: create individual bit signals AND track as bus
        this.ctx.buses.set(param.name, param.width);
        for (let i = 0; i < param.width; i++) {
          const sig = this.createSignal(`${param.name}[${i}]`, true, false, false);
          this.ctx.netlist.primaryInputs.push(sig);
        }
      }
    }

    // Create primary output signals (pre-declare so they can be referenced)
    for (const output of top.outputs) {
      if (output.width === 1) {
        const sig = this.createSignal(output.name, false, true, false);
        this.ctx.netlist.primaryOutputs.push(sig);
      } else {
        // Multi-bit output: track as bus
        this.ctx.buses.set(output.name, output.width);
        for (let i = 0; i < output.width; i++) {
          const sig = this.createSignal(`${output.name}[${i}]`, false, true, false);
          this.ctx.netlist.primaryOutputs.push(sig);
        }
      }
    }

    // Three-pass processing to handle forward references:
    // Pass 1: Create signals for all assignment targets
    for (const stmt of top.statements) {
      this.preCreateSignal(stmt.target);
    }

    // Pass 1.5: Pre-register buses for multi-bit outputs (needed for forward references)
    for (const stmt of top.statements) {
      this.preRegisterBuses(stmt.target, stmt.expr);
    }

    // Pass 2: Process statements and wire up connections
    for (const stmt of top.statements) {
      this.processStatement(stmt);
    }

    // Update totals
    this.ctx.netlist.totalSignals = this.ctx.netlist.signals.length;
    this.ctx.netlist.totalNands = this.ctx.netlist.nandGates.length;
    this.ctx.netlist.totalDffs = this.ctx.netlist.dffs.length;

    return this.ctx.netlist;
  }

  /**
   * Pre-create a signal for forward reference support.
   * This is pass 1 - just create the signal without processing the expression.
   */
  private preCreateSignal(target: string): void {
    const targetName = this.prefixed(target);
    // Skip if this is a bus that already has bit signals mapped
    // This allows module outputs to be properly wired to parent signals
    // Check both prefixed and unprefixed bus names
    if (this.ctx.buses.has(targetName) || this.ctx.buses.has(target)) {
      return;
    }
    // Also check if bit 0 of this as a bus already exists (signals were pre-created)
    if (this.ctx.signals.has(`${targetName}[0]`) || this.ctx.signals.has(`${target}[0]`)) {
      return;
    }
    if (this.ctx.signals.get(targetName) === undefined) {
      this.createSignal(targetName, false, false, false);
    }
  }

  /**
   * Get expression width during pre-registration (before all signals are created).
   * Uses buses map for known widths, falls back to AST analysis.
   */
  private getExprWidthForPreRegister(expr: Expr): number {
    if (isNumberExpr(expr)) {
      return 1;
    }

    if (isIdentifierExpr(expr)) {
      // Check if it's already known as a bus
      const baseName = this.prefixed(expr.name);
      const busWidth = this.ctx.buses.get(baseName);
      return busWidth !== undefined ? busWidth : 1;
    }

    if (isIndexExpr(expr)) {
      return 1;
    }

    if (isSliceExpr(expr)) {
      return expr.end - expr.start + 1;
    }

    if (isMemberExpr(expr)) {
      const baseName = this.exprToName(expr.object);
      const fullName = `${baseName}.${expr.field}`;
      const prefixedName = this.prefixed(fullName);
      const busWidth = this.ctx.buses.get(prefixedName);
      return busWidth !== undefined ? busWidth : 1;
    }

    if (isConcatExpr(expr)) {
      let total = 0;
      for (const part of expr.parts) {
        total += this.getExprWidthForPreRegister(part);
      }
      return total;
    }

    if (isCallExpr(expr)) {
      const mod = this.ctx.modules.get(expr.callee);
      if (mod && mod.outputs.length > 0) {
        return mod.outputs[0].width;
      }
      return 1;
    }

    return 1;
  }

  /**
   * Pre-register buses for multi-bit outputs (pass 1.5).
   * Analyzes expressions to identify which targets will produce multi-bit outputs.
   */
  private preRegisterBuses(target: string, expr: Expr): void {
    const targetName = this.prefixed(target);

    // Handle concat expressions - they create multi-bit buses
    // The width is the SUM of all parts' widths, not the count of parts
    if (isConcatExpr(expr)) {
      const width = this.getExprWidthForPreRegister(expr);
      this.ctx.buses.set(targetName, width);
      // Pre-create bit signals
      for (let bit = 0; bit < width; bit++) {
        const bitName = `${targetName}[${bit}]`;
        if (this.ctx.signals.get(bitName) === undefined) {
          this.createSignal(bitName, false, false, false);
        }
      }
      return;
    }

    // Handle identifier expressions that are buses
    if (isIdentifierExpr(expr)) {
      const exprName = this.prefixed(expr.name);
      const busWidth = this.ctx.buses.get(exprName);
      if (busWidth !== undefined && busWidth > 1) {
        this.ctx.buses.set(targetName, busWidth);
        for (let bit = 0; bit < busWidth; bit++) {
          const bitName = `${targetName}[${bit}]`;
          if (this.ctx.signals.get(bitName) === undefined) {
            this.createSignal(bitName, false, false, false);
          }
        }
      }
      return;
    }

    // Handle member expressions that access multi-bit outputs (e.g., result.sum)
    if (isMemberExpr(expr)) {
      const baseName = this.exprToName(expr.object);
      const fullName = `${baseName}.${expr.field}`;
      const prefixedName = this.prefixed(fullName);
      const busWidth = this.ctx.buses.get(prefixedName);
      if (busWidth !== undefined && busWidth > 1) {
        this.ctx.buses.set(targetName, busWidth);
        for (let bit = 0; bit < busWidth; bit++) {
          const bitName = `${targetName}[${bit}]`;
          if (this.ctx.signals.get(bitName) === undefined) {
            this.createSignal(bitName, false, false, false);
          }
        }
      }
      return;
    }

    // Handle slice expressions
    if (isSliceExpr(expr)) {
      const width = expr.end - expr.start + 1;
      if (width > 1) {
        this.ctx.buses.set(targetName, width);
        for (let bit = 0; bit < width; bit++) {
          const bitName = `${targetName}[${bit}]`;
          if (this.ctx.signals.get(bitName) === undefined) {
            this.createSignal(bitName, false, false, false);
          }
        }
      }
      return;
    }

    if (!isCallExpr(expr)) return;

    const callee = expr.callee;
    if (callee === 'nand' || callee === 'dff') return;

    const mod = this.ctx.modules.get(callee);
    if (!mod) return;

    // Register buses for all multi-bit outputs
    const hasSingleOutput = mod.outputs.length === 1;

    for (const output of mod.outputs) {
      if (output.width > 1) {
        const isFirstOutput = output === mod.outputs[0];

        // For single-output modules, use targetName directly (e.g., ir[0])
        // For multi-output modules, use member access (e.g., ir.result[0])
        if (hasSingleOutput && isFirstOutput) {
          // Single output module - just use targetName[bit]
          this.ctx.buses.set(targetName, output.width);
          for (let bit = 0; bit < output.width; bit++) {
            const bitName = `${targetName}[${bit}]`;
            if (this.ctx.signals.get(bitName) === undefined) {
              this.createSignal(bitName, false, false, false);
            }
          }
        } else {
          // Multi-output module - use member access form: target.outputName
          const busName = `${targetName}.${output.name}`;
          this.ctx.buses.set(busName, output.width);

          for (let bit = 0; bit < output.width; bit++) {
            const bitName = `${busName}[${bit}]`;
            if (this.ctx.signals.get(bitName) === undefined) {
              this.createSignal(bitName, false, false, false);
            }
          }

          // For first output, also register just targetName as a bus for direct access
          if (isFirstOutput) {
            this.ctx.buses.set(targetName, output.width);
            for (let bit = 0; bit < output.width; bit++) {
              const bitName = `${targetName}[${bit}]`;
              if (this.ctx.signals.get(bitName) === undefined) {
                this.createSignal(bitName, false, false, false);
              }
            }
          }
        }
      } else if (output !== mod.outputs[0]) {
        // Single-bit non-first outputs need signal creation too
        const sigName = `${targetName}.${output.name}`;
        if (this.ctx.signals.get(sigName) === undefined) {
          this.createSignal(sigName, false, false, false);
        }
      }
    }
  }

  private processStatement(stmt: Statement): void {
    const targetName = this.prefixed(stmt.target);

    // Check if target is a multi-bit bus - if so, handle bitwise
    // BUT not for module calls - those are handled by evaluateExprToTarget -> inlineModuleToTarget
    // First check both prefixed and unprefixed bus names
    const busWidth = this.ctx.buses.get(targetName) ?? this.ctx.buses.get(stmt.target);
    // Check if this is a call expression that needs special handling (module, intrinsic, or primitive)
    const isSpecialCall = isCallExpr(stmt.expr) &&
                          (stmt.expr.callee === 'nand' ||
                           stmt.expr.callee === 'dff' ||
                           stmt.expr.callee === 'ram' ||
                           stmt.expr.callee === 'rom' ||
                           this.ctx.modules.has(stmt.expr.callee));
    if (busWidth !== undefined && busWidth > 1 && !isSpecialCall) {
      // Multi-bit bus target - evaluate expression and wire each bit
      this.evaluateExprToBus(stmt.expr, stmt.target, busWidth);
      return;
    }

    // Get the target signal (already created in pass 1)
    let targetSig = this.ctx.signals.get(targetName);
    if (targetSig === undefined) {
      // Fallback: create if not pre-created (shouldn't happen)
      targetSig = this.createSignal(targetName, false, false, false);
    }

    // Evaluate the expression and connect to target
    this.evaluateExprToTarget(stmt.expr, targetSig);
  }

  /**
   * Evaluate an expression and wire each bit to a bus target.
   * Used when the target is a multi-bit bus (like module output).
   */
  private evaluateExprToBus(expr: Expr, targetBase: string, width: number): void {
    const prefixedTargetBase = this.prefixed(targetBase);

    for (let bit = 0; bit < width; bit++) {
      // Get source bit
      const sourceSig = this.evaluateExprBit(expr, bit);

      // Get target bit - try both prefixed and unprefixed names
      const prefixedBitName = `${prefixedTargetBase}[${bit}]`;
      const unprefixedBitName = `${targetBase}[${bit}]`;
      const targetBitSig = this.ctx.signals.get(prefixedBitName) ?? this.ctx.signals.get(unprefixedBitName);

      if (targetBitSig !== undefined && targetBitSig !== sourceSig) {
        // Create identity buffer: double-NOT to copy signal value
        const tempSig = this.createSignal(
          `_buf_${this.ctx.instanceCounter++}`,
          false,
          false,
          false
        );
        // First NOT: temp = NAND(source, source)
        const gate1: NandGate = {
          id: this.ctx.netlist.nandGates.length,
          in1: sourceSig,
          in2: sourceSig,
          out: tempSig,
          level: -1,
        };
        this.ctx.netlist.nandGates.push(gate1);
        // Second NOT: target = NAND(temp, temp)
        const gate2: NandGate = {
          id: this.ctx.netlist.nandGates.length,
          in1: tempSig,
          in2: tempSig,
          out: targetBitSig,
          level: -1,
        };
        this.ctx.netlist.nandGates.push(gate2);
      } else if (targetBitSig === sourceSig) {
        // Same signal - no wiring needed (already connected)
      }
    }
  }

  /**
   * Evaluate an expression and connect its output to the target signal.
   * This is the key function that handles signal routing.
   */
  private evaluateExprToTarget(expr: Expr, targetSig: SignalId): void {
    if (isCallExpr(expr)) {
      const callee = expr.callee;

      if (callee === 'nand') {
        if (expr.args.length !== 2) {
          throw new Error('nand requires exactly 2 arguments');
        }
        const in1 = this.evaluateExpr(expr.args[0]);
        const in2 = this.evaluateExpr(expr.args[1]);

        // Create NAND gate with targetSig as output
        const gate: NandGate = {
          id: this.ctx.netlist.nandGates.length,
          in1,
          in2,
          out: targetSig,
          level: -1,
        };
        this.ctx.netlist.nandGates.push(gate);
        return;
      }

      if (callee === 'dff') {
        if (expr.args.length !== 2) {
          throw new Error('dff requires exactly 2 arguments (d, clk)');
        }
        const d = this.evaluateExpr(expr.args[0]);
        const clk = this.evaluateExpr(expr.args[1]);

        // Mark target as DFF output
        this.ctx.netlist.signals[targetSig].isDffOutput = true;

        // Create DFF with targetSig as Q output
        const dff: Dff = {
          id: this.ctx.netlist.dffs.length,
          d,
          clk,
          q: targetSig,
          initialValue: 0,
        };
        this.ctx.netlist.dffs.push(dff);
        return;
      }

      // User-defined module - inline it
      const mod = this.ctx.modules.get(callee);
      if (mod) {
        this.inlineModuleToTarget(mod, expr.args, targetSig);
        return;
      }

      throw new Error(`Unknown module: ${callee}`);
    }

    // Handle concat expressions specially for multi-bit targets
    if (isConcatExpr(expr)) {
      // Get the target name to find corresponding bit signals
      const targetName = this.ctx.netlist.signals[targetSig]?.name;
      if (targetName) {
        // Wire each bit from the concat parts to the target bits
        // The width is the SUM of all parts' widths (not just the count of parts)
        const width = this.getExprWidth(expr);
        for (let bit = 0; bit < width; bit++) {
          // Use evaluateExprBit which properly handles multi-bit concat parts
          const sourceSig = this.evaluateExprBit(expr, bit);

          // Get the target bit signal
          const targetBitName = `${targetName}[${bit}]`;
          const targetBitSig = this.ctx.signals.get(targetBitName);
          if (targetBitSig !== undefined && targetBitSig !== sourceSig) {
            // Create an identity buffer: double-NOT to copy signal value
            // NOT(NOT(x)) = x, using NAND(x,x) = NOT(x)
            const tempSig = this.createSignal(
              `_buf_${this.ctx.instanceCounter++}`,
              false,
              false,
              false
            );
            // First NOT: temp = NAND(source, source)
            const gate1: NandGate = {
              id: this.ctx.netlist.nandGates.length,
              in1: sourceSig,
              in2: sourceSig,
              out: tempSig,
              level: -1,
            };
            this.ctx.netlist.nandGates.push(gate1);
            // Second NOT: target = NAND(temp, temp)
            const gate2: NandGate = {
              id: this.ctx.netlist.nandGates.length,
              in1: tempSig,
              in2: tempSig,
              out: targetBitSig,
              level: -1,
            };
            this.ctx.netlist.nandGates.push(gate2);
          }
        }
      }
      return;
    }

    // Handle multi-bit bus expressions (member access to multi-bit outputs, identifiers that are buses)
    const exprWidth = this.getExprWidth(expr);
    if (exprWidth > 1) {
      // Multi-bit expression - need to wire each bit
      const targetName = this.ctx.netlist.signals[targetSig]?.name;
      if (targetName) {
        for (let bit = 0; bit < exprWidth; bit++) {
          const sourceSig = this.evaluateExprBit(expr, bit);
          const targetBitName = `${targetName}[${bit}]`;
          const targetBitSig = this.ctx.signals.get(targetBitName);
          if (targetBitSig !== undefined && targetBitSig !== sourceSig) {
            // Create identity buffer: double-NOT
            const tempSig = this.createSignal(
              `_buf_${this.ctx.instanceCounter++}`,
              false,
              false,
              false
            );
            const gate1: NandGate = {
              id: this.ctx.netlist.nandGates.length,
              in1: sourceSig,
              in2: sourceSig,
              out: tempSig,
              level: -1,
            };
            this.ctx.netlist.nandGates.push(gate1);
            const gate2: NandGate = {
              id: this.ctx.netlist.nandGates.length,
              in1: tempSig,
              in2: tempSig,
              out: targetBitSig,
              level: -1,
            };
            this.ctx.netlist.nandGates.push(gate2);
          }
        }
      }
      return;
    }

    // For single-bit expression types (identifiers, indexed, etc.), evaluate and copy
    const sourceSig = this.evaluateExpr(expr);

    // Create identity buffer: double-NOT to copy signal value
    // This handles single-bit assignments like "goto_4 = from_3_to_4"
    if (targetSig !== sourceSig) {
      const tempSig = this.createSignal(
        `_buf_${this.ctx.instanceCounter++}`,
        false,
        false,
        false
      );
      // First NOT: temp = NAND(source, source)
      const gate1: NandGate = {
        id: this.ctx.netlist.nandGates.length,
        in1: sourceSig,
        in2: sourceSig,
        out: tempSig,
        level: -1,
      };
      this.ctx.netlist.nandGates.push(gate1);
      // Second NOT: target = NAND(temp, temp)
      const gate2: NandGate = {
        id: this.ctx.netlist.nandGates.length,
        in1: tempSig,
        in2: tempSig,
        out: targetSig,
        level: -1,
      };
      this.ctx.netlist.nandGates.push(gate2);
    }
    // If targetSig === sourceSig, they share the signal ID (aliased), no buffering needed
  }

  /**
   * Evaluate an expression and return the signal ID of its result.
   * Used for reading signal values (inputs to gates).
   */
  private evaluateExpr(expr: Expr): SignalId {
    if (isNumberExpr(expr)) {
      return this.createConstant(expr.value);
    }

    if (isIdentifierExpr(expr)) {
      const name = this.prefixed(expr.name);
      const sig = this.ctx.signals.get(name);
      if (sig === undefined) {
        throw new Error(`Unknown signal: ${expr.name}`);
      }
      return sig;
    }

    if (isIndexExpr(expr)) {
      // Get the base object name (handles chained access)
      const baseName = this.exprToName(expr.object);
      const bitName = this.prefixed(`${baseName}[${expr.index}]`);
      const sig = this.ctx.signals.get(bitName);
      if (sig === undefined) {
        throw new Error(`Unknown signal: ${baseName}[${expr.index}]`);
      }
      return sig;
    }

    if (isSliceExpr(expr)) {
      // Slices expand to multiple signals - for now return first bit
      // TODO: proper multi-bit handling
      const baseName = this.exprToName(expr.object);
      const bitName = this.prefixed(`${baseName}[${expr.start}]`);
      const sig = this.ctx.signals.get(bitName);
      if (sig === undefined) {
        throw new Error(`Unknown signal: ${baseName}[${expr.start}:${expr.end}]`);
      }
      return sig;
    }

    if (isMemberExpr(expr)) {
      // Get the base object name (handles chained access)
      const baseName = this.exprToName(expr.object);
      const fieldName = this.prefixed(`${baseName}.${expr.field}`);
      const sig = this.ctx.signals.get(fieldName);
      if (sig === undefined) {
        throw new Error(`Unknown signal: ${baseName}.${expr.field}`);
      }
      return sig;
    }

    if (isConcatExpr(expr)) {
      // For now, just return first part
      return this.evaluateExpr(expr.parts[0]);
    }

    if (isCallExpr(expr)) {
      // Create a temporary signal for the result
      const tempSig = this.createSignal(
        `_temp_${this.ctx.instanceCounter++}`,
        false,
        false,
        false
      );
      this.evaluateExprToTarget(expr, tempSig);
      return tempSig;
    }

    throw new Error(`Unknown expression type: ${(expr as Expr).type}`);
  }

  /**
   * Convert an expression to its string name for signal lookup.
   * Handles chained access like foo.bar[0]
   */
  private exprToName(expr: Expr): string {
    if (isIdentifierExpr(expr)) {
      return expr.name;
    }
    if (isIndexExpr(expr)) {
      return `${this.exprToName(expr.object)}[${expr.index}]`;
    }
    if (isSliceExpr(expr)) {
      return `${this.exprToName(expr.object)}[${expr.start}:${expr.end}]`;
    }
    if (isMemberExpr(expr)) {
      return `${this.exprToName(expr.object)}.${expr.field}`;
    }
    if (isCallExpr(expr)) {
      // For call expressions, we can't easily make a name
      // This would need temp signal handling
      return `_call_${expr.callee}`;
    }
    throw new Error(`Cannot convert expression to name: ${expr.type}`);
  }

  private inlineModuleToTarget(
    mod: ModuleDecl,
    args: Expr[],
    targetSig: SignalId
  ): void {
    const instanceId = this.ctx.instanceCounter++;
    const oldPrefix = this.ctx.prefix;
    const savedSignals = new Map(this.ctx.signals);
    const savedBuses = new Map(this.ctx.buses);

    // Map arguments to parameters
    if (args.length !== mod.params.length) {
      throw new Error(
        `Module ${mod.name} expects ${mod.params.length} arguments, got ${args.length}`
      );
    }

    const newPrefix = `${oldPrefix}${mod.name}_${instanceId}_`;

    // First, evaluate all arguments in the parent scope
    // Store results as arrays of signal IDs (for multi-bit) or single signal IDs
    const argSignals: (SignalId | SignalId[])[] = [];
    for (let i = 0; i < mod.params.length; i++) {
      const param = mod.params[i];
      const arg = args[i];

      if (param.width === 1) {
        // Single-bit parameter: evaluate to single signal
        argSignals.push(this.evaluateExpr(arg));
      } else {
        // Multi-bit parameter: evaluate each bit
        const bits: SignalId[] = [];
        for (let bit = 0; bit < param.width; bit++) {
          bits.push(this.evaluateExprBit(arg, bit));
        }
        argSignals.push(bits);
      }
    }

    // Now switch to child scope
    this.ctx.prefix = newPrefix;
    this.ctx.signals = new Map(savedSignals);
    this.ctx.buses = new Map(savedBuses);

    // Map arguments to parameters using the pre-evaluated signals
    for (let i = 0; i < mod.params.length; i++) {
      const param = mod.params[i];
      const argSig = argSignals[i];

      if (param.width === 1) {
        const paramName = this.prefixed(param.name);
        this.ctx.signals.set(paramName, argSig as SignalId);
      } else {
        // Multi-bit parameter
        this.ctx.buses.set(this.prefixed(param.name), param.width);
        const bits = argSig as SignalId[];
        for (let bit = 0; bit < param.width; bit++) {
          const paramBitName = this.prefixed(`${param.name}[${bit}]`);
          this.ctx.signals.set(paramBitName, bits[bit]);
        }
      }
    }

    // Pre-declare output signals
    // First, handle the first output specially if it's multi-bit - we need to
    // expand the target signal in the parent scope to a bus
    // BUT only if preRegisterBuses hasn't already done this (check for ir[0])
    const firstOutput = mod.outputs[0];
    if (firstOutput && firstOutput.width > 1) {
      const targetName = this.ctx.netlist.signals[targetSig]?.name;
      // Only expand if bit signals don't already exist
      const bitSignalsExist = targetName && (
        savedSignals.has(`${targetName}[0]`) ||
        savedSignals.has(`${targetName}.${firstOutput.name}[0]`)
      );
      if (targetName && !targetName.includes('[') && !bitSignalsExist) {
        // The target was created as single-bit, expand to bus in parent scope
        savedBuses.set(targetName, firstOutput.width);
        // Rename the existing signal to be bit 0
        // (we can't actually rename, so just track the mapping)
        savedSignals.set(`${targetName}[0]`, targetSig);
        // Create additional bit signals in parent scope for bits 1+
        for (let bit = 1; bit < firstOutput.width; bit++) {
          const bitName = `${targetName}[${bit}]`;
          // Use oldPrefix to stay in parent scope when creating
          const savedPrefix = this.ctx.prefix;
          this.ctx.prefix = oldPrefix;
          const sig = this.createSignal(bitName, false, false, false);
          this.ctx.prefix = savedPrefix;
          savedSignals.set(bitName, sig);
        }
      }
    }

    // Get the target variable name for member access (e.g., 'dec' from 'dec = decoder(...)')
    const targetVarName = this.ctx.netlist.signals[targetSig]?.name;

    for (const output of mod.outputs) {
      if (output.width === 1) {
        const outputName = this.prefixed(output.name);
        // First output maps to targetSig, others get new signals
        if (output === mod.outputs[0]) {
          this.ctx.signals.set(outputName, targetSig);
          // ALSO store for member access - e.g., 'dec.is_lda' maps to targetSig
          if (targetVarName) {
            savedSignals.set(`${targetVarName}.${output.name}`, targetSig);
          }
        } else {
          const sig = this.createSignal(outputName, false, false, false);
          // Store for member access in parent scope using target variable name
          // e.g., 'dec.is_beq' when target is 'dec' and output is 'is_beq'
          if (targetVarName) {
            savedSignals.set(`${targetVarName}.${output.name}`, sig);
          }
        }
      } else {
        // Multi-bit output: track as bus and create bit signals inside module scope
        this.ctx.buses.set(this.prefixed(output.name), output.width);
        // Also track without prefix so assignments inside the module work correctly
        this.ctx.buses.set(output.name, output.width);

        const isFirstOutput = output === mod.outputs[0];
        const hasSingleOutput = mod.outputs.length === 1;

        for (let bit = 0; bit < output.width; bit++) {
          const outputBitName = this.prefixed(`${output.name}[${bit}]`);

          if (isFirstOutput && targetVarName) {
            // Map to the parent's bus bit signals
            // For single-output modules: prefer targetVarName[bit] (e.g., ir[0])
            // For multi-output modules: prefer targetVarName.outputName[bit] (e.g., alu.result[0])
            const parentMemberBitName = `${targetVarName}.${output.name}[${bit}]`;
            const parentBitName = targetVarName.includes('[')
              ? targetVarName  // Target was already a bit
              : `${targetVarName}[${bit}]`;

            // Single-output modules prefer direct access (ir[0]), multi-output prefer member (alu.result[0])
            const parentSig = hasSingleOutput
              ? (savedSignals.get(parentBitName) ?? savedSignals.get(parentMemberBitName))
              : (savedSignals.get(parentMemberBitName) ?? savedSignals.get(parentBitName));
            if (parentSig !== undefined) {
              // Map the prefixed output bit name to the parent's signal
              // This is crucial for making module output wiring work
              this.ctx.signals.set(outputBitName, parentSig);
              // Also store the unprefixed mapping for assignments inside the module like "result = a"
              const unprefixedBitName = `${output.name}[${bit}]`;
              this.ctx.signals.set(unprefixedBitName, parentSig);
            } else {
              // Create new signal
              const sig = this.createSignal(outputBitName, false, false, false);
              if (targetVarName) {
                savedSignals.set(`${targetVarName}.${output.name}[${bit}]`, sig);
              }
            }
          } else {
            // For non-first outputs, check if parent already has this signal pre-created
            const parentMemberName = targetVarName ? `${targetVarName}.${output.name}[${bit}]` : null;
            const existingParentSig = parentMemberName ? savedSignals.get(parentMemberName) : undefined;

            if (existingParentSig !== undefined) {
              // Use the existing parent signal - this is the key fix!
              this.ctx.signals.set(outputBitName, existingParentSig);
            } else {
              const sig = this.createSignal(outputBitName, false, false, false);
              // Store for member access in parent scope (like result.sum[0])
              if (targetVarName) {
                savedSignals.set(`${targetVarName}.${output.name}[${bit}]`, sig);
              }
            }
          }
        }
        // Also store the output as a bus in parent scope for member access
        if (targetVarName) {
          savedBuses.set(`${targetVarName}.${output.name}`, output.width);
        }
      }
    }

    // Three-pass processing for forward references within module:
    // Pass 1: Pre-create all signal targets
    for (const stmt of mod.statements) {
      this.preCreateSignal(stmt.target);
    }

    // Pass 1.5: Pre-register buses for multi-bit outputs
    for (const stmt of mod.statements) {
      this.preRegisterBuses(stmt.target, stmt.expr);
    }

    // Pass 2: Process module statements
    for (const stmt of mod.statements) {
      this.processStatement(stmt);
    }

    // Restore parent scope
    this.ctx.prefix = oldPrefix;
    this.ctx.signals = savedSignals;
    this.ctx.buses = savedBuses;
  }

  /**
   * Get the width (in bits) of an expression.
   * Used for proper multi-bit handling in concat and other operations.
   */
  private getExprWidth(expr: Expr): number {
    if (isNumberExpr(expr)) {
      // Numbers are treated as 1-bit unless used in a wider context
      return 1;
    }

    if (isIdentifierExpr(expr)) {
      const baseName = this.prefixed(expr.name);
      const busWidth = this.ctx.buses.get(baseName);
      return busWidth !== undefined ? busWidth : 1;
    }

    if (isIndexExpr(expr)) {
      // Indexing a single bit
      return 1;
    }

    if (isSliceExpr(expr)) {
      return expr.end - expr.start + 1;
    }

    if (isMemberExpr(expr)) {
      const baseName = this.exprToName(expr.object);
      const fullName = `${baseName}.${expr.field}`;
      const prefixedName = this.prefixed(fullName);
      const busWidth = this.ctx.buses.get(prefixedName);
      return busWidth !== undefined ? busWidth : 1;
    }

    if (isConcatExpr(expr)) {
      // Sum of all parts' widths
      let total = 0;
      for (const part of expr.parts) {
        total += this.getExprWidth(part);
      }
      return total;
    }

    if (isCallExpr(expr)) {
      // Would need to look up the module's first output width
      const mod = this.ctx.modules.get(expr.callee);
      if (mod && mod.outputs.length > 0) {
        return mod.outputs[0].width;
      }
      return 1;
    }

    return 1;
  }

  /**
   * Evaluate an expression to get a specific bit's signal.
   * Used for multi-bit argument mapping.
   */
  private evaluateExprBit(expr: Expr, bitIndex: number): SignalId {
    if (isIdentifierExpr(expr)) {
      // Check if it's a bus
      const baseName = this.prefixed(expr.name);
      const busWidth = this.ctx.buses.get(baseName);
      if (busWidth !== undefined) {
        // It's a bus - return the specific bit signal
        const bitName = this.prefixed(`${expr.name}[${bitIndex}]`);
        const sig = this.ctx.signals.get(bitName);
        if (sig === undefined) {
          throw new Error(`Unknown signal: ${expr.name}[${bitIndex}]`);
        }
        return sig;
      }
      // Not a bus - for single-bit signals:
      // - bit 0: return the signal itself
      // - bit 1+: zero-extend (return constant 0)
      // This handles cases like `one = 1` being used as a 16-bit value
      if (bitIndex === 0) {
        return this.evaluateExpr(expr);
      }
      // Zero-extend: higher bits are 0
      return this.createConstant(0);
    }

    if (isConcatExpr(expr)) {
      // Concat concatenates from MSB to LSB: concat(hi, lo) means hi is high bits, lo is low bits
      // So for concat(data_in:8, ret_lo:8):
      //   - ret_lo (rightmost) contributes bits [0:7]
      //   - data_in (leftmost) contributes bits [8:15]
      // We need to find which part contains the requested bitIndex and what offset within it

      // Calculate cumulative widths starting from the rightmost part (LSB)
      const parts = expr.parts;
      let cumulativeWidth = 0;

      // Traverse from rightmost (LSB) to leftmost (MSB)
      for (let i = parts.length - 1; i >= 0; i--) {
        const partWidth = this.getExprWidth(parts[i]);
        const nextCumulativeWidth = cumulativeWidth + partWidth;

        if (bitIndex < nextCumulativeWidth) {
          // This part contains the requested bit
          const offsetInPart = bitIndex - cumulativeWidth;
          return this.evaluateExprBit(parts[i], offsetInPart);
        }

        cumulativeWidth = nextCumulativeWidth;
      }

      throw new Error(`Concat index out of range: bit ${bitIndex} (total width: ${cumulativeWidth})`);
    }

    if (isIndexExpr(expr)) {
      // Indexing returns a single bit, so only bitIndex 0 is valid
      if (bitIndex !== 0) {
        throw new Error(`Cannot access bit ${bitIndex} of indexed expression`);
      }
      return this.evaluateExpr(expr);
    }

    if (isSliceExpr(expr)) {
      // Slice like a[2:5] represents bits start..end of the original signal
      // Bit N of the slice maps to bit (start + N) of the original
      const actualBitIndex = expr.start + bitIndex;
      if (actualBitIndex > expr.end) {
        throw new Error(`Slice bit index out of range: bit ${bitIndex} of [${expr.start}:${expr.end}]`);
      }
      // Get the base signal and access the actual bit
      const baseName = this.exprToName(expr.object);
      const bitName = this.prefixed(`${baseName}[${actualBitIndex}]`);
      const sig = this.ctx.signals.get(bitName);
      if (sig === undefined) {
        throw new Error(`Unknown signal: ${baseName}[${actualBitIndex}]`);
      }
      return sig;
    }

    if (isMemberExpr(expr)) {
      // Check if the member expression refers to a bus (like alu.result)
      const baseName = this.exprToName(expr.object);
      const fullName = `${baseName}.${expr.field}`;
      const prefixedName = this.prefixed(fullName);
      const busWidth = this.ctx.buses.get(prefixedName);
      if (busWidth !== undefined) {
        // It's a bus - return the specific bit signal
        const bitName = this.prefixed(`${fullName}[${bitIndex}]`);
        const sig = this.ctx.signals.get(bitName);
        if (sig === undefined) {
          throw new Error(`Unknown signal: ${fullName}[${bitIndex}]`);
        }
        return sig;
      }
      // Not a bus - can only be used if bitIndex is 0
      if (bitIndex !== 0) {
        throw new Error(`${fullName} is not a bus, cannot access bit ${bitIndex}`);
      }
      return this.evaluateExpr(expr);
    }

    if (isNumberExpr(expr)) {
      // Extract the specific bit from the number constant
      const bitValue = (expr.value >> bitIndex) & 1;
      return this.createConstant(bitValue);
    }

    // For other expressions, evaluate normally (only works for bitIndex 0)
    if (bitIndex !== 0) {
      throw new Error(`Cannot access bit ${bitIndex} of expression type ${expr.type}`);
    }
    return this.evaluateExpr(expr);
  }

  private createSignal(
    name: string,
    isPrimaryInput: boolean,
    isPrimaryOutput: boolean,
    isDffOutput: boolean
  ): SignalId {
    const id = this.ctx.netlist.signals.length;
    const signal: Signal = {
      id,
      name,
      width: 1,
      isPrimaryInput,
      isPrimaryOutput,
      isDffOutput,
    };
    this.ctx.netlist.signals.push(signal);
    this.ctx.netlist.signalMap.set(name, id);
    this.ctx.signals.set(name, id);
    return id;
  }

  private createConstant(value: number): SignalId {
    const name = `const_${value}`;
    const existing = this.ctx.signals.get(name);
    if (existing !== undefined) return existing;

    // Create constant signal
    const sig = this.createSignal(name, true, false, false);
    return sig;
  }

  private prefixed(name: string): string {
    return this.ctx.prefix + name;
  }
}

export function elaborate(program: Program, topModule: string): Netlist {
  return new Elaborator().elaborate(program, topModule);
}
