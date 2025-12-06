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
