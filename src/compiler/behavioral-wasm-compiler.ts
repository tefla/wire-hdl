// Behavioral WASM Compiler: Generates Binaryen IR for @behavior blocks
//
// This compiles behavioral code directly to WASM for maximum performance.
// Instead of interpreting the behavioral function in JS, we generate
// native WASM i32 operations.

import binaryen from 'binaryen';
import type {
  ModuleDecl,
  BehavioralStatement,
  BehavioralExpr,
  BinaryOp,
} from '../types/ast.js';
import type { BehavioralModule, SignalId } from '../types/netlist.js';

// Context for WASM code generation
interface WasmGenContext {
  mod: binaryen.Module;
  // Maps variable/param name -> local index
  locals: Map<string, number>;
  // Width info for masking
  inputWidths: Map<string, number>;
  outputWidths: Map<string, number>;
  localWidths: Map<string, number>;
  // Next available local index
  nextLocal: number;
}

/**
 * Generate WASM code for a behavioral module's evaluation.
 *
 * The generated code:
 * 1. Takes packed input values as parameters
 * 2. Executes the behavioral logic
 * 3. Returns packed output values
 *
 * For modules with multiple outputs, we use a convention where
 * outputs are packed into a single i32/i64 or stored to memory.
 */
export function generateBehavioralFunction(
  mod: binaryen.Module,
  module: ModuleDecl,
  funcName: string
): void {
  if (!module.behavior) {
    throw new Error(`Module ${module.name} has no @behavior block`);
  }

  const ctx: WasmGenContext = {
    mod,
    locals: new Map(),
    inputWidths: new Map(),
    outputWidths: new Map(),
    localWidths: new Map(),
    nextLocal: 0,
  };

  // Build width maps
  for (const param of module.params) {
    ctx.inputWidths.set(param.name, param.width);
  }
  for (const output of module.outputs) {
    ctx.outputWidths.set(output.name, output.width);
  }

  // Collect local variable declarations from let statements
  collectLocalVars(module.behavior.body, ctx.localWidths);

  // Create parameter list - one i32 per input
  const paramTypes: binaryen.Type[] = [];
  for (const param of module.params) {
    ctx.locals.set(param.name, ctx.nextLocal++);
    paramTypes.push(binaryen.i32);
  }

  // Create locals for outputs
  for (const output of module.outputs) {
    ctx.locals.set(output.name, ctx.nextLocal++);
  }

  // Create locals for let-declared variables
  for (const [name] of ctx.localWidths) {
    ctx.locals.set(name, ctx.nextLocal++);
  }

  // Total locals = params + outputs + local vars
  const numOutputs = module.outputs.length;
  const numLocalVars = ctx.localWidths.size;
  const localTypes: binaryen.Type[] = [];

  // Locals for outputs and local variables (params are already in the signature)
  for (let i = 0; i < numOutputs + numLocalVars; i++) {
    localTypes.push(binaryen.i32);
  }

  // Generate body statements
  const bodyStatements = generateStatements(ctx, module.behavior.body);

  // Pack outputs into return value
  // For simplicity, if there's one output return it directly
  // For multiple outputs, pack them (limited to 32 bits total for now)
  let returnExpr: binaryen.ExpressionRef;

  if (module.outputs.length === 1) {
    const outLocal = ctx.locals.get(module.outputs[0].name)!;
    returnExpr = mod.local.get(outLocal, binaryen.i32);
  } else {
    // Pack multiple outputs: out0 | (out1 << width0) | (out2 << (width0+width1)) | ...
    let packed = mod.i32.const(0);
    let shift = 0;
    for (const output of module.outputs) {
      const outLocal = ctx.locals.get(output.name)!;
      const outVal = mod.local.get(outLocal, binaryen.i32);
      if (shift === 0) {
        packed = outVal;
      } else {
        packed = mod.i32.or(
          packed,
          mod.i32.shl(outVal, mod.i32.const(shift))
        );
      }
      shift += output.width;
    }
    returnExpr = packed;
  }

  // Create the function body
  const body = mod.block(null, [
    ...bodyStatements,
    mod.return(returnExpr),
  ]);

  // Add the function
  mod.addFunction(
    funcName,
    binaryen.createType(paramTypes),
    binaryen.i32, // Return type
    localTypes,
    body
  );

  // Export the function
  mod.addFunctionExport(funcName, funcName);
}

/**
 * Generate WASM code to inline a behavioral module call.
 * This is called during main evaluate function generation.
 *
 * @param ctx Main WASM generation context
 * @param behavioralMod The behavioral module instance from netlist
 * @param module The module declaration with @behavior
 * @returns WASM statements to evaluate the behavioral module
 */
export function generateInlinedBehavioral(
  mod: binaryen.Module,
  behavioralMod: BehavioralModule,
  module: ModuleDecl,
  readBit: (signalId: number) => binaryen.ExpressionRef,
  writeBit: (signalId: number, value: binaryen.ExpressionRef) => binaryen.ExpressionRef
): binaryen.ExpressionRef[] {
  if (!module.behavior) {
    return [];
  }

  const statements: binaryen.ExpressionRef[] = [];

  // Create a fresh context for this behavioral block
  const ctx: WasmGenContext = {
    mod,
    locals: new Map(),
    inputWidths: new Map(),
    outputWidths: new Map(),
    localWidths: new Map(),
    nextLocal: 0,
  };

  // Build width maps
  for (const param of module.params) {
    ctx.inputWidths.set(param.name, param.width);
  }
  for (const output of module.outputs) {
    ctx.outputWidths.set(output.name, output.width);
  }
  collectLocalVars(module.behavior.body, ctx.localWidths);

  // We need to allocate scratch locals in the parent function
  // For now, we'll use a simpler approach: generate the behavioral code
  // using temporary variables, then use stack-based evaluation

  // Pack inputs from bit signals into i32 values
  const packedInputs = new Map<string, binaryen.ExpressionRef>();
  for (const [paramName, signalIds] of behavioralMod.inputs) {
    const width = behavioralMod.inputWidths.get(paramName) || 1;
    let packed: binaryen.ExpressionRef;

    if (width === 1) {
      packed = readBit(signalIds as SignalId);
    } else {
      const bits = signalIds as SignalId[];
      packed = mod.i32.const(0);
      for (let i = 0; i < bits.length; i++) {
        const bit = readBit(bits[i]);
        if (i === 0) {
          packed = bit;
        } else {
          packed = mod.i32.or(packed, mod.i32.shl(bit, mod.i32.const(i)));
        }
      }
    }
    packedInputs.set(paramName, packed);
  }

  // Generate the behavioral code with packed inputs
  // We need a different approach - generate expression tree that uses the packed inputs
  const outputValues = generateBehavioralInlined(ctx, module, packedInputs);

  // Unpack outputs to bit signals
  for (const [outputName, signalIds] of behavioralMod.outputs) {
    const width = behavioralMod.outputWidths.get(outputName) || 1;
    const outputValue = outputValues.get(outputName);

    if (!outputValue) continue;

    if (width === 1) {
      statements.push(writeBit(signalIds as SignalId, outputValue));
    } else {
      const bits = signalIds as SignalId[];
      for (let i = 0; i < bits.length; i++) {
        const bitValue = mod.i32.and(
          mod.i32.shr_u(outputValue, mod.i32.const(i)),
          mod.i32.const(1)
        );
        statements.push(writeBit(bits[i], bitValue));
      }
    }
  }

  return statements;
}

/**
 * Generate behavioral code as an expression tree, using packed inputs.
 * Returns a map of output name -> expression that computes that output.
 */
function generateBehavioralInlined(
  ctx: WasmGenContext,
  module: ModuleDecl,
  packedInputs: Map<string, binaryen.ExpressionRef>
): Map<string, binaryen.ExpressionRef> {
  // For complex behavioral code with if/match, we can't easily generate
  // pure expressions. Instead, use locals and generate statements.

  // For now, implement a simpler approach that works for common patterns
  // TODO: Full statement-based code generation with locals

  const outputs = new Map<string, binaryen.ExpressionRef>();

  // Process each statement and track assignments to outputs
  for (const stmt of module.behavior!.body) {
    if (stmt.type === 'AssignStatement') {
      if (stmt.target.type === 'IdentifierExpr') {
        const name = stmt.target.name;
        if (ctx.outputWidths.has(name)) {
          // This is an output assignment
          const width = ctx.outputWidths.get(name) || 32;
          const expr = generateExprInlined(ctx, stmt.value, packedInputs);
          outputs.set(name, maskToWidth(ctx.mod, expr, width));
        }
      }
    } else if (stmt.type === 'IfStatement') {
      // For if statements, we need to generate select/if-then-else
      // This is more complex - for now, generate conditional assignments
      processIfStatement(ctx, stmt, packedInputs, outputs);
    }
  }

  return outputs;
}

/**
 * Process an if statement, generating conditional expressions for outputs.
 */
function processIfStatement(
  ctx: WasmGenContext,
  stmt: import('../types/ast.js').IfStatement,
  packedInputs: Map<string, binaryen.ExpressionRef>,
  outputs: Map<string, binaryen.ExpressionRef>
): void {
  const mod = ctx.mod;
  const condition = generateExprInlined(ctx, stmt.condition, packedInputs);

  // Collect assignments from then branch
  const thenOutputs = new Map<string, binaryen.ExpressionRef>();
  for (const thenStmt of stmt.thenBranch) {
    if (thenStmt.type === 'AssignStatement' && thenStmt.target.type === 'IdentifierExpr') {
      const name = thenStmt.target.name;
      if (ctx.outputWidths.has(name)) {
        const width = ctx.outputWidths.get(name) || 32;
        const expr = generateExprInlined(ctx, thenStmt.value, packedInputs);
        thenOutputs.set(name, maskToWidth(mod, expr, width));
      }
    } else if (thenStmt.type === 'IfStatement') {
      // Nested if - recurse
      processIfStatement(ctx, thenStmt, packedInputs, thenOutputs);
    }
  }

  // Collect assignments from else branch (if any)
  const elseOutputs = new Map<string, binaryen.ExpressionRef>();
  if (stmt.elseBranch) {
    if (Array.isArray(stmt.elseBranch)) {
      for (const elseStmt of stmt.elseBranch) {
        if (elseStmt.type === 'AssignStatement' && elseStmt.target.type === 'IdentifierExpr') {
          const name = elseStmt.target.name;
          if (ctx.outputWidths.has(name)) {
            const width = ctx.outputWidths.get(name) || 32;
            const expr = generateExprInlined(ctx, elseStmt.value, packedInputs);
            elseOutputs.set(name, maskToWidth(mod, expr, width));
          }
        } else if (elseStmt.type === 'IfStatement') {
          processIfStatement(ctx, elseStmt, packedInputs, elseOutputs);
        }
      }
    } else {
      // else if - it's another IfStatement
      processIfStatement(ctx, stmt.elseBranch, packedInputs, elseOutputs);
    }
  }

  // Generate select expressions for each output that appears in either branch
  const allOutputNames = new Set([...thenOutputs.keys(), ...elseOutputs.keys()]);
  for (const name of allOutputNames) {
    const thenVal = thenOutputs.get(name);
    const elseVal = elseOutputs.get(name) || outputs.get(name) || mod.i32.const(0);
    const prevVal = outputs.get(name) || mod.i32.const(0);

    if (thenVal) {
      // condition ? thenVal : (elseVal or prevVal)
      outputs.set(name, mod.select(condition, thenVal, elseVal || prevVal));
    } else if (elseOutputs.has(name)) {
      // Only in else branch: !condition ? elseVal : prevVal
      outputs.set(name, mod.select(condition, prevVal, elseVal));
    }
  }
}

/**
 * Generate WASM expression for a behavioral expression, using packed inputs.
 */
function generateExprInlined(
  ctx: WasmGenContext,
  expr: BehavioralExpr,
  packedInputs: Map<string, binaryen.ExpressionRef>
): binaryen.ExpressionRef {
  const mod = ctx.mod;

  switch (expr.type) {
    case 'BehavioralNumberExpr':
      return mod.i32.const(expr.value);

    case 'BehavioralIdentifierExpr': {
      // Look up in packed inputs
      const packed = packedInputs.get(expr.name);
      if (packed) {
        return packed;
      }
      // Might be a local variable - return 0 for now
      // TODO: Track local variable values
      return mod.i32.const(0);
    }

    case 'BinaryExpr': {
      const left = generateExprInlined(ctx, expr.left, packedInputs);
      const right = generateExprInlined(ctx, expr.right, packedInputs);
      return generateBinaryOp(mod, expr.op, left, right);
    }

    case 'UnaryExpr': {
      const operand = generateExprInlined(ctx, expr.operand, packedInputs);
      if (expr.op === '~') {
        return mod.i32.xor(operand, mod.i32.const(-1));
      } else if (expr.op === '!') {
        return mod.i32.eqz(operand);
      }
      return operand;
    }

    case 'TernaryExpr': {
      const cond = generateExprInlined(ctx, expr.condition, packedInputs);
      const thenVal = generateExprInlined(ctx, expr.thenExpr, packedInputs);
      const elseVal = generateExprInlined(ctx, expr.elseExpr, packedInputs);
      return mod.select(cond, thenVal, elseVal);
    }

    case 'BehavioralIndexExpr': {
      const obj = generateExprInlined(ctx, expr.object, packedInputs);
      const idx = generateExprInlined(ctx, expr.index, packedInputs);
      // (obj >> idx) & 1
      return mod.i32.and(
        mod.i32.shr_u(obj, idx),
        mod.i32.const(1)
      );
    }

    case 'BehavioralSliceExpr': {
      const obj = generateExprInlined(ctx, expr.object, packedInputs);
      const lo = expr.end;
      const hi = expr.start;
      const width = hi - lo + 1;
      const mask = (1 << width) - 1;
      // (obj >> lo) & mask
      return mod.i32.and(
        mod.i32.shr_u(obj, mod.i32.const(lo)),
        mod.i32.const(mask)
      );
    }

    case 'BehavioralConcatExpr': {
      // Concatenate parts - assume 1-bit each for simplicity
      // TODO: Track widths properly
      let result = mod.i32.const(0);
      let shift = 0;
      for (const part of expr.parts.reverse()) {
        const val = generateExprInlined(ctx, part, packedInputs);
        if (shift === 0) {
          result = val;
        } else {
          result = mod.i32.or(result, mod.i32.shl(val, mod.i32.const(shift)));
        }
        shift += 1; // Assume 1-bit parts
      }
      return result;
    }

    default:
      return mod.i32.const(0);
  }
}

/**
 * Generate WASM for a binary operation.
 */
function generateBinaryOp(
  mod: binaryen.Module,
  op: BinaryOp,
  left: binaryen.ExpressionRef,
  right: binaryen.ExpressionRef
): binaryen.ExpressionRef {
  switch (op) {
    case '+': return mod.i32.add(left, right);
    case '-': return mod.i32.sub(left, right);
    case '*': return mod.i32.mul(left, right);
    case '&': return mod.i32.and(left, right);
    case '|': return mod.i32.or(left, right);
    case '^': return mod.i32.xor(left, right);
    case '<<': return mod.i32.shl(left, right);
    case '>>': return mod.i32.shr_u(left, right); // Unsigned shift
    case '==': return mod.i32.eq(left, right);
    case '!=': return mod.i32.ne(left, right);
    case '<': return mod.i32.lt_u(left, right);
    case '>': return mod.i32.gt_u(left, right);
    case '<=': return mod.i32.le_u(left, right);
    case '>=': return mod.i32.ge_u(left, right);
    default: return mod.i32.const(0);
  }
}

/**
 * Mask a value to the specified bit width.
 */
function maskToWidth(
  mod: binaryen.Module,
  value: binaryen.ExpressionRef,
  width: number
): binaryen.ExpressionRef {
  if (width >= 32) return value;
  const mask = (1 << width) - 1;
  return mod.i32.and(value, mod.i32.const(mask));
}

/**
 * Collect local variable declarations from behavioral statements.
 */
function collectLocalVars(
  statements: BehavioralStatement[],
  vars: Map<string, number>
): void {
  for (const stmt of statements) {
    if (stmt.type === 'LetStatement') {
      vars.set(stmt.name, stmt.width);
    } else if (stmt.type === 'IfStatement') {
      collectLocalVars(stmt.thenBranch, vars);
      if (stmt.elseBranch) {
        if (Array.isArray(stmt.elseBranch)) {
          collectLocalVars(stmt.elseBranch, vars);
        } else {
          collectLocalVars([stmt.elseBranch], vars);
        }
      }
    } else if (stmt.type === 'MatchStatement') {
      for (const arm of stmt.arms) {
        collectLocalVars(arm.body, vars);
      }
    }
  }
}

/**
 * Generate WASM statements for behavioral code.
 * Used when generating standalone behavioral functions.
 */
function generateStatements(
  ctx: WasmGenContext,
  statements: BehavioralStatement[]
): binaryen.ExpressionRef[] {
  const result: binaryen.ExpressionRef[] = [];
  const mod = ctx.mod;

  for (const stmt of statements) {
    switch (stmt.type) {
      case 'LetStatement': {
        const localIdx = ctx.locals.get(stmt.name)!;
        const init = generateExpr(ctx, stmt.init);
        const masked = maskToWidth(mod, init, stmt.width);
        result.push(mod.local.set(localIdx, masked));
        break;
      }

      case 'AssignStatement': {
        if (stmt.target.type === 'IdentifierExpr') {
          const localIdx = ctx.locals.get(stmt.target.name);
          if (localIdx !== undefined) {
            const value = generateExpr(ctx, stmt.value);
            const width = ctx.outputWidths.get(stmt.target.name) ||
                          ctx.localWidths.get(stmt.target.name) || 32;
            const masked = maskToWidth(mod, value, width);
            result.push(mod.local.set(localIdx, masked));
          }
        } else if (stmt.target.type === 'BehavioralIndexExpr') {
          // Bit assignment: result[3] = 1
          // result = (result & ~(1 << idx)) | ((value & 1) << idx)
          const objName = getIdentifierName(stmt.target.object);
          const localIdx = ctx.locals.get(objName);
          if (localIdx !== undefined) {
            const idx = generateExpr(ctx, stmt.target.index);
            const value = generateExpr(ctx, stmt.value);
            const current = mod.local.get(localIdx, binaryen.i32);
            const mask = mod.i32.xor(mod.i32.shl(mod.i32.const(1), idx), mod.i32.const(-1));
            const cleared = mod.i32.and(current, mask);
            const newBit = mod.i32.shl(mod.i32.and(value, mod.i32.const(1)), idx);
            result.push(mod.local.set(localIdx, mod.i32.or(cleared, newBit)));
          }
        } else if (stmt.target.type === 'BehavioralSliceExpr') {
          // Slice assignment: result[7:4] = value
          const objName = getIdentifierName(stmt.target.object);
          const localIdx = ctx.locals.get(objName);
          if (localIdx !== undefined) {
            const lo = stmt.target.end;
            const hi = stmt.target.start;
            const width = hi - lo + 1;
            const sliceMask = (1 << width) - 1;
            const value = generateExpr(ctx, stmt.value);
            const current = mod.local.get(localIdx, binaryen.i32);
            const mask = mod.i32.xor(mod.i32.shl(mod.i32.const(sliceMask), mod.i32.const(lo)), mod.i32.const(-1));
            const cleared = mod.i32.and(current, mask);
            const newBits = mod.i32.shl(mod.i32.and(value, mod.i32.const(sliceMask)), mod.i32.const(lo));
            result.push(mod.local.set(localIdx, mod.i32.or(cleared, newBits)));
          }
        }
        break;
      }

      case 'IfStatement': {
        const cond = generateExpr(ctx, stmt.condition);
        const thenStmts = generateStatements(ctx, stmt.thenBranch);

        let elseStmts: binaryen.ExpressionRef[] = [];
        if (stmt.elseBranch) {
          if (Array.isArray(stmt.elseBranch)) {
            elseStmts = generateStatements(ctx, stmt.elseBranch);
          } else {
            elseStmts = generateStatements(ctx, [stmt.elseBranch]);
          }
        }

        const thenBlock = mod.block(null, thenStmts);
        const elseBlock = elseStmts.length > 0 ? mod.block(null, elseStmts) : undefined;

        result.push(mod.if(cond, thenBlock, elseBlock));
        break;
      }

      case 'MatchStatement': {
        // Convert match to if-else chain
        // Note: We re-evaluate stmt.value in each arm for simplicity
        // TODO: Store value in a local for efficiency
        let current: binaryen.ExpressionRef | undefined;

        for (let i = stmt.arms.length - 1; i >= 0; i--) {
          const arm = stmt.arms[i];
          const armStmts = generateStatements(ctx, arm.body);
          const armBlock = mod.block(null, armStmts);

          if (arm.pattern.type === 'WildcardPattern') {
            current = armBlock;
          } else {
            const matchValue = generateExpr(ctx, stmt.value);
            let cond: binaryen.ExpressionRef;

            if (arm.pattern.type === 'NumberPattern') {
              cond = mod.i32.eq(matchValue, mod.i32.const(arm.pattern.value));
            } else {
              // Range pattern
              const start = arm.pattern.start;
              const end = arm.pattern.end;
              cond = mod.i32.and(
                mod.i32.ge_u(matchValue, mod.i32.const(start)),
                mod.i32.le_u(matchValue, mod.i32.const(end))
              );
            }

            current = mod.if(cond, armBlock, current);
          }
        }

        if (current) {
          result.push(current);
        }
        break;
      }
    }
  }

  return result;
}

/**
 * Generate WASM expression for a behavioral expression.
 * Used in standalone behavioral functions.
 */
function generateExpr(
  ctx: WasmGenContext,
  expr: BehavioralExpr
): binaryen.ExpressionRef {
  const mod = ctx.mod;

  switch (expr.type) {
    case 'BehavioralNumberExpr':
      return mod.i32.const(expr.value);

    case 'BehavioralIdentifierExpr': {
      const localIdx = ctx.locals.get(expr.name);
      if (localIdx !== undefined) {
        return mod.local.get(localIdx, binaryen.i32);
      }
      return mod.i32.const(0);
    }

    case 'BinaryExpr': {
      const left = generateExpr(ctx, expr.left);
      const right = generateExpr(ctx, expr.right);
      return generateBinaryOp(mod, expr.op, left, right);
    }

    case 'UnaryExpr': {
      const operand = generateExpr(ctx, expr.operand);
      if (expr.op === '~') {
        return mod.i32.xor(operand, mod.i32.const(-1));
      } else if (expr.op === '!') {
        return mod.i32.eqz(operand);
      }
      return operand;
    }

    case 'TernaryExpr': {
      const cond = generateExpr(ctx, expr.condition);
      const thenVal = generateExpr(ctx, expr.thenExpr);
      const elseVal = generateExpr(ctx, expr.elseExpr);
      return mod.select(cond, thenVal, elseVal);
    }

    case 'BehavioralIndexExpr': {
      const obj = generateExpr(ctx, expr.object);
      const idx = generateExpr(ctx, expr.index);
      return mod.i32.and(
        mod.i32.shr_u(obj, idx),
        mod.i32.const(1)
      );
    }

    case 'BehavioralSliceExpr': {
      const obj = generateExpr(ctx, expr.object);
      const lo = expr.end;
      const hi = expr.start;
      const width = hi - lo + 1;
      const mask = (1 << width) - 1;
      return mod.i32.and(
        mod.i32.shr_u(obj, mod.i32.const(lo)),
        mod.i32.const(mask)
      );
    }

    case 'BehavioralConcatExpr': {
      let result = mod.i32.const(0);
      let shift = 0;
      for (const part of expr.parts.reverse()) {
        const val = generateExpr(ctx, part);
        if (shift === 0) {
          result = val;
        } else {
          result = mod.i32.or(result, mod.i32.shl(val, mod.i32.const(shift)));
        }
        shift += 1;
      }
      return result;
    }

    default:
      return mod.i32.const(0);
  }
}

/**
 * Extract identifier name from a behavioral expression.
 */
function getIdentifierName(expr: BehavioralExpr): string {
  if (expr.type === 'BehavioralIdentifierExpr') {
    return expr.name;
  }
  throw new Error(`Expected identifier, got ${expr.type}`);
}
