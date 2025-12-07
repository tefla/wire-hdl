// AST node types for the Wire HDL language

export interface SourceLocation {
  line: number;
  column: number;
  offset: number;
}

export interface ASTNode {
  loc?: SourceLocation;
}

// Program is a collection of modules
export interface Program extends ASTNode {
  type: 'Program';
  modules: ModuleDecl[];
}

// Module declaration: module name(params) -> outputs:
export interface ModuleDecl extends ASTNode {
  type: 'ModuleDecl';
  name: string;
  params: Param[];
  outputs: Output[];
  statements: Statement[];
  // Behavioral extension: optional @behavior and @structure blocks
  behavior?: BehaviorBlock;
  structure?: StructureBlock;
}

// Input parameter: name or name:width
export interface Param extends ASTNode {
  type: 'Param';
  name: string;
  width: number; // default 1
}

// Output declaration: name or name:width
export interface Output extends ASTNode {
  type: 'Output';
  name: string;
  width: number; // default 1
}

// Statement: name = expr
export interface Statement extends ASTNode {
  type: 'Statement';
  target: string;
  expr: Expr;
}

// Expression types
export type Expr =
  | CallExpr
  | IndexExpr
  | SliceExpr
  | MemberExpr
  | IdentifierExpr
  | NumberExpr
  | ConcatExpr;

// Function/module call: name(args)
export interface CallExpr extends ASTNode {
  type: 'CallExpr';
  callee: string;
  args: Expr[];
}

// Bit index: expr[index]
export interface IndexExpr extends ASTNode {
  type: 'IndexExpr';
  object: Expr;
  index: number;
}

// Bit slice: expr[start:end] - extracts bits from start to end (inclusive)
export interface SliceExpr extends ASTNode {
  type: 'SliceExpr';
  object: Expr;
  start: number;
  end: number;
}

// Member access: expr.field (for multi-output modules)
export interface MemberExpr extends ASTNode {
  type: 'MemberExpr';
  object: Expr;
  field: string;
}

// Identifier reference
export interface IdentifierExpr extends ASTNode {
  type: 'IdentifierExpr';
  name: string;
}

// Numeric literal
export interface NumberExpr extends ASTNode {
  type: 'NumberExpr';
  value: number;
}

// concat(a, b, c, ...) - built-in for combining bits
export interface ConcatExpr extends ASTNode {
  type: 'ConcatExpr';
  parts: Expr[];
}

// ============================================================
// Behavioral Extension Types
// ============================================================

// @behavior block containing behavioral statements
export interface BehaviorBlock extends ASTNode {
  type: 'BehaviorBlock';
  body: BehavioralStatement[];
}

// @structure block (wraps regular structural statements)
export interface StructureBlock extends ASTNode {
  type: 'StructureBlock';
  statements: Statement[];
}

// Behavioral statements
export type BehavioralStatement =
  | LetStatement
  | AssignStatement
  | IfStatement
  | MatchStatement;

// let name:width = expr
export interface LetStatement extends ASTNode {
  type: 'LetStatement';
  name: string;
  width: number;
  init: BehavioralExpr;
}

// name = expr (assignment to output or variable)
export interface AssignStatement extends ASTNode {
  type: 'AssignStatement';
  target: BehavioralLValue;
  value: BehavioralExpr;
}

// Left-hand side of assignment: variable, bit index, or slice
export type BehavioralLValue =
  | IdentifierExpr
  | BehavioralIndexExpr
  | BehavioralSliceExpr;

// if cond { ... } else if cond { ... } else { ... }
export interface IfStatement extends ASTNode {
  type: 'IfStatement';
  condition: BehavioralExpr;
  thenBranch: BehavioralStatement[];
  elseBranch?: BehavioralStatement[] | IfStatement;
}

// match value { pattern => stmt, ... }
export interface MatchStatement extends ASTNode {
  type: 'MatchStatement';
  value: BehavioralExpr;
  arms: MatchArm[];
}

export interface MatchArm extends ASTNode {
  type: 'MatchArm';
  pattern: MatchPattern;
  body: BehavioralStatement[];
}

// Match patterns
export type MatchPattern =
  | NumberPattern
  | RangePattern
  | WildcardPattern;

export interface NumberPattern extends ASTNode {
  type: 'NumberPattern';
  value: number;
}

export interface RangePattern extends ASTNode {
  type: 'RangePattern';
  start: number;
  end: number;
}

export interface WildcardPattern extends ASTNode {
  type: 'WildcardPattern';
}

// Behavioral expressions (with operators)
export type BehavioralExpr =
  | BinaryExpr
  | UnaryExpr
  | TernaryExpr
  | BehavioralIndexExpr
  | BehavioralSliceExpr
  | BehavioralConcatExpr
  | BehavioralIdentifierExpr
  | BehavioralNumberExpr
  | BehavioralCallExpr;

// Function call in behavioral context: module_name(arg1, arg2, ...)
// Calls another module's behavioral implementation
export interface BehavioralCallExpr extends ASTNode {
  type: 'BehavioralCallExpr';
  moduleName: string;
  args: BehavioralExpr[];
}

// Binary operators: +, -, &, |, ^, <<, >>, ==, !=, <, >, <=, >=
export type BinaryOp =
  | '+' | '-' | '*'
  | '&' | '|' | '^'
  | '<<' | '>>'
  | '==' | '!=' | '<' | '>' | '<=' | '>=';

export interface BinaryExpr extends ASTNode {
  type: 'BinaryExpr';
  op: BinaryOp;
  left: BehavioralExpr;
  right: BehavioralExpr;
}

// Unary operators: ~, !
export type UnaryOp = '~' | '!';

export interface UnaryExpr extends ASTNode {
  type: 'UnaryExpr';
  op: UnaryOp;
  operand: BehavioralExpr;
}

// Ternary: cond ? thenExpr : elseExpr
export interface TernaryExpr extends ASTNode {
  type: 'TernaryExpr';
  condition: BehavioralExpr;
  thenExpr: BehavioralExpr;
  elseExpr: BehavioralExpr;
}

// Behavioral bit index: expr[n]
export interface BehavioralIndexExpr extends ASTNode {
  type: 'BehavioralIndexExpr';
  object: BehavioralExpr;
  index: BehavioralExpr;
}

// Behavioral slice: expr[hi:lo]
export interface BehavioralSliceExpr extends ASTNode {
  type: 'BehavioralSliceExpr';
  object: BehavioralExpr;
  start: number;
  end: number;
}

// Behavioral concat: {a, b, c}
export interface BehavioralConcatExpr extends ASTNode {
  type: 'BehavioralConcatExpr';
  parts: BehavioralExpr[];
}

// Identifier in behavioral context
export interface BehavioralIdentifierExpr extends ASTNode {
  type: 'BehavioralIdentifierExpr';
  name: string;
}

// Number literal in behavioral context
export interface BehavioralNumberExpr extends ASTNode {
  type: 'BehavioralNumberExpr';
  value: number;
}

// Helper type guards
export function isCallExpr(expr: Expr): expr is CallExpr {
  return expr.type === 'CallExpr';
}

export function isIndexExpr(expr: Expr): expr is IndexExpr {
  return expr.type === 'IndexExpr';
}

export function isSliceExpr(expr: Expr): expr is SliceExpr {
  return expr.type === 'SliceExpr';
}

export function isMemberExpr(expr: Expr): expr is MemberExpr {
  return expr.type === 'MemberExpr';
}

export function isIdentifierExpr(expr: Expr): expr is IdentifierExpr {
  return expr.type === 'IdentifierExpr';
}

export function isNumberExpr(expr: Expr): expr is NumberExpr {
  return expr.type === 'NumberExpr';
}

export function isConcatExpr(expr: Expr): expr is ConcatExpr {
  return expr.type === 'ConcatExpr';
}
