// Behavioral Compiler: Transforms @behavior blocks to native TypeScript functions
//
// Supports composable behaviors - behavioral blocks can call other modules
// that have behavioral implementations.
//
// Example transformation:
//   @behavior { result = alu8(a, b, op, cin) }
//   ->
//   function module_name(inputs, state, modules) {
//     const a = inputs.a;
//     // ... calls modules.alu8({a, b, op, cin})
//     return { result };
//   }

import type {
  ModuleDecl,
  BehaviorBlock,
  BehavioralStatement,
  BehavioralExpr,
  BinaryOp,
  MatchArm,
  MatchPattern,
  Param,
  Output,
  Program,
} from '../types/ast.js';

// Compiled behavioral function signature
// Now takes a third argument: modules registry for calling other behaviors
export type BehavioralFunction = (
  inputs: Record<string, number>,
  state?: Record<string, number>,
  modules?: BehavioralModules
) => Record<string, number>;

// Registry of compiled behavioral modules
export type BehavioralModules = Map<string, BehavioralFunction>;

// Compile and cache behavioral functions for multiple modules
export class BehavioralCompiler {
  private cache = new Map<string, BehavioralFunction>();
  private moduleRegistry: BehavioralModules = new Map();
  private moduleDecls = new Map<string, ModuleDecl>();

  // Compile all modules from a program
  compileAll(program: Program): BehavioralModules {
    // First pass: collect all module declarations
    for (const mod of program.modules) {
      this.moduleDecls.set(mod.name, mod);
    }

    // Second pass: compile all behavioral modules
    for (const mod of program.modules) {
      if (mod.behavior) {
        this.compile(mod);
      }
    }

    return this.moduleRegistry;
  }

  compile(module: ModuleDecl): BehavioralFunction | null {
    const cached = this.cache.get(module.name);
    if (cached) return cached;

    const func = this.compileBehavior(module);
    if (func) {
      this.cache.set(module.name, func);
      this.moduleRegistry.set(module.name, func);
    }
    return func;
  }

  has(moduleName: string): boolean {
    return this.cache.has(moduleName);
  }

  get(moduleName: string): BehavioralFunction | undefined {
    return this.cache.get(moduleName);
  }

  getModules(): BehavioralModules {
    return this.moduleRegistry;
  }

  clear(): void {
    this.cache.clear();
    this.moduleRegistry.clear();
    this.moduleDecls.clear();
  }

  // Compile a module's @behavior block to a JavaScript function
  private compileBehavior(module: ModuleDecl): BehavioralFunction | null {
    if (!module.behavior) {
      return null;
    }

    const inputNames = module.params.map(p => p.name);
    const outputNames = module.outputs.map(o => o.name);
    const outputWidths = new Map(module.outputs.map(o => [o.name, o.width]));
    const inputWidths = new Map(module.params.map(p => [p.name, p.width]));

    // Collect local variables from let statements
    const localVars = new Map<string, number>();
    collectLocalVars(module.behavior.body, localVars);

    // Find all module calls in the behavior
    const moduleCalls = new Set<string>();
    findModuleCalls(module.behavior.body, moduleCalls);

    // Generate the function body
    const ctx: GenContext = {
      outputWidths,
      inputWidths,
      localVars,
      moduleCalls,
      moduleDecls: this.moduleDecls,
    };
    const bodyCode = generateStatements(module.behavior.body, ctx);

    // Build the function
    const funcCode = `
    return function ${sanitizeName(module.name)}_behavior(inputs, state, modules) {
      // Extract inputs
      ${inputNames.map(name => `const ${sanitizeName(name)} = inputs["${name}"] || 0;`).join('\n      ')}

      // Declare outputs
      ${outputNames.map(name => `let ${sanitizeName(name)} = 0;`).join('\n      ')}

      // Declare local variables
      ${Array.from(localVars.entries()).map(([name, _width]) => `let ${sanitizeName(name)} = 0;`).join('\n      ')}

      // Behavioral code
      ${bodyCode}

      // Return outputs
      return {
        ${outputNames.map(name => `"${name}": ${sanitizeName(name)}`).join(',\n        ')}
      };
    };
  `;

    try {
      // Use Function constructor to create the function dynamically
      const factory = new Function(funcCode);
      return factory() as BehavioralFunction;
    } catch (e) {
      console.error('Failed to compile behavioral function:', e);
      console.error('Generated code:', funcCode);
      throw e;
    }
  }
}

// Legacy function for backward compatibility
export function compileBehavior(module: ModuleDecl): BehavioralFunction | null {
  const compiler = new BehavioralCompiler();
  return compiler.compile(module);
}

// Context for code generation
interface GenContext {
  outputWidths: Map<string, number>;
  inputWidths: Map<string, number>;
  localVars: Map<string, number>;
  moduleCalls: Set<string>;
  moduleDecls: Map<string, ModuleDecl>;
}

// Collect local variable declarations
function collectLocalVars(statements: BehavioralStatement[], vars: Map<string, number>): void {
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

// Find all module calls in behavioral statements
function findModuleCalls(statements: BehavioralStatement[], calls: Set<string>): void {
  for (const stmt of statements) {
    if (stmt.type === 'LetStatement') {
      findModuleCallsInExpr(stmt.init, calls);
    } else if (stmt.type === 'AssignStatement') {
      findModuleCallsInExpr(stmt.value, calls);
    } else if (stmt.type === 'IfStatement') {
      findModuleCallsInExpr(stmt.condition, calls);
      findModuleCalls(stmt.thenBranch, calls);
      if (stmt.elseBranch) {
        if (Array.isArray(stmt.elseBranch)) {
          findModuleCalls(stmt.elseBranch, calls);
        } else {
          findModuleCalls([stmt.elseBranch], calls);
        }
      }
    } else if (stmt.type === 'MatchStatement') {
      findModuleCallsInExpr(stmt.value, calls);
      for (const arm of stmt.arms) {
        findModuleCalls(arm.body, calls);
      }
    }
  }
}

function findModuleCallsInExpr(expr: BehavioralExpr, calls: Set<string>): void {
  switch (expr.type) {
    case 'BehavioralCallExpr':
      calls.add(expr.moduleName);
      for (const arg of expr.args) {
        findModuleCallsInExpr(arg, calls);
      }
      break;
    case 'BinaryExpr':
      findModuleCallsInExpr(expr.left, calls);
      findModuleCallsInExpr(expr.right, calls);
      break;
    case 'UnaryExpr':
      findModuleCallsInExpr(expr.operand, calls);
      break;
    case 'TernaryExpr':
      findModuleCallsInExpr(expr.condition, calls);
      findModuleCallsInExpr(expr.thenExpr, calls);
      findModuleCallsInExpr(expr.elseExpr, calls);
      break;
    case 'BehavioralIndexExpr':
      findModuleCallsInExpr(expr.object, calls);
      findModuleCallsInExpr(expr.index, calls);
      break;
    case 'BehavioralSliceExpr':
      findModuleCallsInExpr(expr.object, calls);
      break;
    case 'BehavioralConcatExpr':
      for (const part of expr.parts) {
        findModuleCallsInExpr(part, calls);
      }
      break;
  }
}

// Generate JavaScript code for statements
function generateStatements(statements: BehavioralStatement[], ctx: GenContext): string {
  return statements.map(stmt => generateStatement(stmt, ctx)).join('\n      ');
}

function generateStatement(stmt: BehavioralStatement, ctx: GenContext): string {
  switch (stmt.type) {
    case 'LetStatement': {
      const init = generateExpr(stmt.init, ctx);
      const mask = getMask(stmt.width);
      return `${sanitizeName(stmt.name)} = (${init}) & ${mask};`;
    }

    case 'AssignStatement': {
      const value = generateExpr(stmt.value, ctx);
      const target = stmt.target;

      if (target.type === 'IdentifierExpr') {
        const width = ctx.outputWidths.get(target.name) || ctx.localVars.get(target.name) || 32;
        const mask = getMask(width);
        return `${sanitizeName(target.name)} = (${value}) & ${mask};`;
      } else if (target.type === 'BehavioralIndexExpr') {
        // Single bit assignment: result[3] = 1
        const objName = getIdentifierName(target.object);
        const index = generateExpr(target.index, ctx);
        return `${sanitizeName(objName)} = (${sanitizeName(objName)} & ~(1 << (${index}))) | (((${value}) & 1) << (${index}));`;
      } else if (target.type === 'BehavioralSliceExpr') {
        // Slice assignment: result[7:4] = value
        const objName = getIdentifierName(target.object);
        const hi = target.start;
        const lo = target.end;
        const sliceWidth = hi - lo + 1;
        const sliceMask = getMask(sliceWidth);
        return `${sanitizeName(objName)} = (${sanitizeName(objName)} & ~(${sliceMask} << ${lo})) | (((${value}) & ${sliceMask}) << ${lo});`;
      }
      return `// Unknown assignment target: ${target.type}`;
    }

    case 'IfStatement': {
      const cond = generateExpr(stmt.condition, ctx);
      const thenCode = generateStatements(stmt.thenBranch, ctx);

      let elseCode = '';
      if (stmt.elseBranch) {
        if (Array.isArray(stmt.elseBranch)) {
          elseCode = ` else {\n        ${generateStatements(stmt.elseBranch, ctx)}\n      }`;
        } else {
          // else if - chain it
          elseCode = ` else ${generateStatement(stmt.elseBranch, ctx)}`;
        }
      }

      return `if (${cond}) {\n        ${thenCode}\n      }${elseCode}`;
    }

    case 'MatchStatement': {
      const value = generateExpr(stmt.value, ctx);
      const arms = stmt.arms.map(arm => generateMatchArm(arm, value, ctx)).join(' else ');
      return arms;
    }

    default:
      return `// Unknown statement type`;
  }
}

function generateMatchArm(arm: MatchArm, value: string, ctx: GenContext): string {
  const body = generateStatements(arm.body, ctx);

  switch (arm.pattern.type) {
    case 'NumberPattern':
      return `if ((${value}) === ${arm.pattern.value}) {\n        ${body}\n      }`;

    case 'RangePattern':
      return `if ((${value}) >= ${arm.pattern.start} && (${value}) <= ${arm.pattern.end}) {\n        ${body}\n      }`;

    case 'WildcardPattern':
      // Default case - no condition needed, but wrapped in block for consistency
      return `{\n        ${body}\n      }`;

    default:
      return `// Unknown pattern type`;
  }
}

function generateExpr(expr: BehavioralExpr, ctx: GenContext): string {
  switch (expr.type) {
    case 'BehavioralNumberExpr':
      return String(expr.value);

    case 'BehavioralIdentifierExpr':
      return sanitizeName(expr.name);

    case 'BehavioralCallExpr': {
      // Call another module's behavioral implementation
      const moduleName = expr.moduleName;
      const moduleDecl = ctx.moduleDecls.get(moduleName);

      if (!moduleDecl) {
        throw new Error(`Unknown module: ${moduleName}`);
      }

      // Build the inputs object for the called module
      const argExprs = expr.args.map(arg => generateExpr(arg, ctx));
      const paramNames = moduleDecl.params.map(p => p.name);

      if (argExprs.length !== paramNames.length) {
        throw new Error(`Module ${moduleName} expects ${paramNames.length} arguments, got ${argExprs.length}`);
      }

      // Generate: modules.get("moduleName")({ param1: arg1, param2: arg2, ... }, null, modules)
      const argsObj = paramNames.map((name, i) => `"${name}": ${argExprs[i]}`).join(', ');

      // The result is an object with the module's outputs
      // If module has single output, return that value directly
      // If module has multiple outputs, return the object (caller must extract)
      if (moduleDecl.outputs.length === 1) {
        const outputName = moduleDecl.outputs[0].name;
        return `(modules.get("${moduleName}")({${argsObj}}, null, modules)["${outputName}"])`;
      } else {
        // For multiple outputs, return the result object
        // The caller needs to destructure or access specific properties
        return `(modules.get("${moduleName}")({${argsObj}}, null, modules))`;
      }
    }

    case 'BinaryExpr': {
      const left = generateExpr(expr.left, ctx);
      const right = generateExpr(expr.right, ctx);
      const op = translateOp(expr.op);
      return `(${left} ${op} ${right})`;
    }

    case 'UnaryExpr': {
      const operand = generateExpr(expr.operand, ctx);
      if (expr.op === '~') {
        return `(~${operand})`;
      } else if (expr.op === '!') {
        return `((${operand}) ? 0 : 1)`;
      }
      return `(${expr.op}${operand})`;
    }

    case 'TernaryExpr': {
      const cond = generateExpr(expr.condition, ctx);
      const thenExpr = generateExpr(expr.thenExpr, ctx);
      const elseExpr = generateExpr(expr.elseExpr, ctx);
      return `((${cond}) ? (${thenExpr}) : (${elseExpr}))`;
    }

    case 'BehavioralIndexExpr': {
      const obj = generateExpr(expr.object, ctx);
      const index = generateExpr(expr.index, ctx);
      return `((${obj} >> (${index})) & 1)`;
    }

    case 'BehavioralSliceExpr': {
      const obj = generateExpr(expr.object, ctx);
      const hi = expr.start;
      const lo = expr.end;
      const width = hi - lo + 1;
      const mask = getMask(width);
      return `((${obj} >> ${lo}) & ${mask})`;
    }

    case 'BehavioralConcatExpr': {
      // Concatenate parts: {a:4, b:4} -> 8-bit
      // We need to know widths, but for now assume each part is 1 bit
      // TODO: Track widths properly through expression analysis
      const parts = expr.parts.map(p => generateExpr(p, ctx));
      if (parts.length === 0) return '0';
      if (parts.length === 1) return parts[0];
      // For now, assume 1-bit each for simple cases
      // Real implementation would need width inference
      return `(${parts.reverse().map((p, i) => i === 0 ? p : `((${p}) << ${i})`).join(' | ')})`;
    }

    default:
      return '0';
  }
}

function translateOp(op: BinaryOp): string {
  switch (op) {
    case '==': return '===';
    case '!=': return '!==';
    case '<<': return '<<';
    case '>>': return '>>>';  // Use unsigned right shift
    default: return op;
  }
}

function getMask(width: number): string {
  if (width >= 32) return '0xFFFFFFFF';
  return `0x${((1 << width) - 1).toString(16).toUpperCase()}`;
}

function sanitizeName(name: string): string {
  // Replace any characters not valid in JS identifiers
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

function getIdentifierName(expr: BehavioralExpr): string {
  if (expr.type === 'BehavioralIdentifierExpr') {
    return expr.name;
  }
  throw new Error(`Expected identifier, got ${expr.type}`);
}
