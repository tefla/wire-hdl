// Recursive descent parser for the Wire HDL language

import { Token, TokenType, tokenize } from './lexer.js';
import type {
  Program,
  ModuleDecl,
  Param,
  Output,
  Statement,
  Expr,
  // Behavioral types
  BehaviorBlock,
  StructureBlock,
  BehavioralStatement,
  LetStatement,
  AssignStatement,
  IfStatement,
  MatchStatement,
  MatchArm,
  MatchPattern,
  BehavioralExpr,
  BinaryOp,
  BehavioralLValue,
} from '../types/ast.js';

export class Parser {
  private tokens: Token[] = [];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): Program {
    const modules: ModuleDecl[] = [];

    this.skipNewlines();

    while (!this.isAtEnd()) {
      if (this.check('MODULE')) {
        modules.push(this.parseModule());
      } else if (this.check('NEWLINE')) {
        this.advance();
      } else if (this.check('EOF')) {
        break;
      } else {
        throw this.error(`Unexpected token: ${this.current().type}`);
      }
    }

    return { type: 'Program', modules };
  }

  private parseModule(): ModuleDecl {
    const loc = this.current();
    this.expect('MODULE');
    const name = this.expect('IDENTIFIER').value;

    this.expect('LPAREN');
    const params = this.parseParams();
    this.expect('RPAREN');

    this.expect('ARROW');
    const outputs = this.parseOutputs();
    this.expect('COLON');

    this.skipNewlines();

    // Parse module body: can be regular statements, @behavior block, @structure block, or combination
    const statements: Statement[] = [];
    let behavior: BehaviorBlock | undefined;
    let structure: StructureBlock | undefined;

    while (!this.isAtEnd() && !this.check('MODULE')) {
      if (this.check('NEWLINE')) {
        this.advance();
        continue;
      }
      if (this.check('EOF')) {
        break;
      }

      // Check for @behavior or @structure blocks
      if (this.check('AT')) {
        this.advance(); // consume @
        if (this.check('BEHAVIOR')) {
          this.advance(); // consume 'behavior'
          behavior = this.parseBehaviorBlock();
        } else if (this.check('STRUCTURE')) {
          this.advance(); // consume 'structure'
          structure = this.parseStructureBlock();
        } else {
          throw this.error(`Expected 'behavior' or 'structure' after @`);
        }
      } else if (this.check('IDENTIFIER')) {
        // Regular structural statement
        statements.push(this.parseStatement());
      } else {
        break;
      }
    }

    // If we have a structure block, use its statements
    // Otherwise use the inline statements
    const finalStatements = structure ? structure.statements : statements;

    return {
      type: 'ModuleDecl',
      name,
      params,
      outputs,
      statements: finalStatements,
      behavior,
      structure,
      loc: { line: loc.line, column: loc.column, offset: loc.offset },
    };
  }

  private parseBehaviorBlock(): BehaviorBlock {
    this.skipNewlines();
    this.expect('LBRACE');
    this.skipNewlines();

    const body: BehavioralStatement[] = [];

    while (!this.check('RBRACE') && !this.isAtEnd()) {
      if (this.check('NEWLINE')) {
        this.advance();
        continue;
      }
      body.push(this.parseBehavioralStatement());
    }

    this.expect('RBRACE');
    this.skipNewlines();

    return { type: 'BehaviorBlock', body };
  }

  private parseStructureBlock(): StructureBlock {
    this.skipNewlines();
    this.expect('LBRACE');
    this.skipNewlines();

    const statements: Statement[] = [];

    while (!this.check('RBRACE') && !this.isAtEnd()) {
      if (this.check('NEWLINE')) {
        this.advance();
        continue;
      }
      statements.push(this.parseStatement());
    }

    this.expect('RBRACE');
    this.skipNewlines();

    return { type: 'StructureBlock', statements };
  }

  private parseBehavioralStatement(): BehavioralStatement {
    this.skipNewlines();

    // let name:width = expr
    if (this.check('LET')) {
      return this.parseLetStatement();
    }

    // if condition { ... }
    if (this.check('IF')) {
      return this.parseIfStatement();
    }

    // match value { ... }
    if (this.check('MATCH')) {
      return this.parseMatchStatement();
    }

    // Assignment: target = expr
    return this.parseAssignStatement();
  }

  private parseLetStatement(): LetStatement {
    this.expect('LET');
    const name = this.expect('IDENTIFIER').value;
    this.expect('COLON');
    const width = parseInt(this.expect('NUMBER').value, 10);
    this.expect('EQUALS');
    const init = this.parseBehavioralExpr();
    this.skipNewlines();

    return { type: 'LetStatement', name, width, init };
  }

  private parseAssignStatement(): AssignStatement {
    const target = this.parseBehavioralLValue();
    this.expect('EQUALS');
    const value = this.parseBehavioralExpr();
    this.skipNewlines();

    return { type: 'AssignStatement', target, value };
  }

  private parseBehavioralLValue(): BehavioralLValue {
    const name = this.expect('IDENTIFIER').value;
    let lvalue: BehavioralLValue = { type: 'IdentifierExpr', name };

    // Check for indexing: name[n] or name[hi:lo]
    if (this.check('LBRACKET')) {
      this.advance();
      const start = this.parseBehavioralExpr();

      if (this.check('COLON')) {
        // Slice: [hi:lo]
        this.advance();
        const end = parseInt(this.expect('NUMBER').value, 10);
        this.expect('RBRACKET');
        // For lvalue, start must be a number
        if (start.type !== 'BehavioralNumberExpr') {
          throw this.error('Slice indices must be numbers');
        }
        lvalue = {
          type: 'BehavioralSliceExpr',
          object: { type: 'BehavioralIdentifierExpr', name },
          start: start.value,
          end,
        };
      } else {
        // Index: [n]
        this.expect('RBRACKET');
        lvalue = {
          type: 'BehavioralIndexExpr',
          object: { type: 'BehavioralIdentifierExpr', name },
          index: start,
        };
      }
    }

    return lvalue;
  }

  private parseIfStatement(): IfStatement {
    this.expect('IF');
    const condition = this.parseBehavioralExpr();

    this.skipNewlines();
    this.expect('LBRACE');
    this.skipNewlines();

    const thenBranch: BehavioralStatement[] = [];
    while (!this.check('RBRACE') && !this.isAtEnd()) {
      if (this.check('NEWLINE')) {
        this.advance();
        continue;
      }
      thenBranch.push(this.parseBehavioralStatement());
    }
    this.expect('RBRACE');
    this.skipNewlines();

    let elseBranch: BehavioralStatement[] | IfStatement | undefined;

    if (this.check('ELSE')) {
      this.advance();
      this.skipNewlines();

      if (this.check('IF')) {
        // else if
        elseBranch = this.parseIfStatement();
      } else {
        // else { ... }
        this.expect('LBRACE');
        this.skipNewlines();
        elseBranch = [];
        while (!this.check('RBRACE') && !this.isAtEnd()) {
          if (this.check('NEWLINE')) {
            this.advance();
            continue;
          }
          elseBranch.push(this.parseBehavioralStatement());
        }
        this.expect('RBRACE');
        this.skipNewlines();
      }
    }

    return { type: 'IfStatement', condition, thenBranch, elseBranch };
  }

  private parseMatchStatement(): MatchStatement {
    this.expect('MATCH');
    const value = this.parseBehavioralExpr();

    this.skipNewlines();
    this.expect('LBRACE');
    this.skipNewlines();

    const arms: MatchArm[] = [];

    while (!this.check('RBRACE') && !this.isAtEnd()) {
      if (this.check('NEWLINE')) {
        this.advance();
        continue;
      }
      arms.push(this.parseMatchArm());
    }

    this.expect('RBRACE');
    this.skipNewlines();

    return { type: 'MatchStatement', value, arms };
  }

  private parseMatchArm(): MatchArm {
    const pattern = this.parseMatchPattern();
    this.expect('ARROW_FAT');

    // Body can be single statement or { ... }
    let body: BehavioralStatement[];
    if (this.check('LBRACE')) {
      this.advance();
      this.skipNewlines();
      body = [];
      while (!this.check('RBRACE') && !this.isAtEnd()) {
        if (this.check('NEWLINE')) {
          this.advance();
          continue;
        }
        body.push(this.parseBehavioralStatement());
      }
      this.expect('RBRACE');
    } else {
      // Single statement
      body = [this.parseBehavioralStatement()];
    }
    this.skipNewlines();

    return { type: 'MatchArm', pattern, body };
  }

  private parseMatchPattern(): MatchPattern {
    // Wildcard: _
    if (this.check('UNDERSCORE')) {
      this.advance();
      return { type: 'WildcardPattern' };
    }

    // Number or range
    const start = this.parseNumber();

    if (this.check('DOTDOT')) {
      // Range: start..end
      this.advance();
      const end = this.parseNumber();
      return { type: 'RangePattern', start, end };
    }

    return { type: 'NumberPattern', value: start };
  }

  private parseNumber(): number {
    const token = this.expect('NUMBER');
    const value = token.value;
    // Handle hex (0x...) and decimal
    if (value.startsWith('0x') || value.startsWith('0X')) {
      return parseInt(value, 16);
    }
    return parseInt(value, 10);
  }

  // ============================================================
  // Behavioral Expression Parsing (with operator precedence)
  // ============================================================

  private parseBehavioralExpr(): BehavioralExpr {
    return this.parseTernary();
  }

  private parseTernary(): BehavioralExpr {
    let expr = this.parseOr();

    if (this.check('QUESTION')) {
      this.advance();
      const thenExpr = this.parseBehavioralExpr();
      this.expect('COLON');
      const elseExpr = this.parseBehavioralExpr();
      return { type: 'TernaryExpr', condition: expr, thenExpr, elseExpr };
    }

    return expr;
  }

  private parseOr(): BehavioralExpr {
    let left = this.parseXor();

    while (this.check('PIPE')) {
      this.advance();
      const right = this.parseXor();
      left = { type: 'BinaryExpr', op: '|', left, right };
    }

    return left;
  }

  private parseXor(): BehavioralExpr {
    let left = this.parseAnd();

    while (this.check('CARET')) {
      this.advance();
      const right = this.parseAnd();
      left = { type: 'BinaryExpr', op: '^', left, right };
    }

    return left;
  }

  private parseAnd(): BehavioralExpr {
    let left = this.parseEquality();

    while (this.check('AMPERSAND')) {
      this.advance();
      const right = this.parseEquality();
      left = { type: 'BinaryExpr', op: '&', left, right };
    }

    return left;
  }

  private parseEquality(): BehavioralExpr {
    let left = this.parseComparison();

    while (this.check('EQ_EQ') || this.check('BANG_EQ')) {
      const op: BinaryOp = this.current().type === 'EQ_EQ' ? '==' : '!=';
      this.advance();
      const right = this.parseComparison();
      left = { type: 'BinaryExpr', op, left, right };
    }

    return left;
  }

  private parseComparison(): BehavioralExpr {
    let left = this.parseShift();

    while (this.check('LT') || this.check('GT') || this.check('LT_EQ') || this.check('GT_EQ')) {
      let op: BinaryOp;
      switch (this.current().type) {
        case 'LT': op = '<'; break;
        case 'GT': op = '>'; break;
        case 'LT_EQ': op = '<='; break;
        case 'GT_EQ': op = '>='; break;
        default: throw this.error('Unexpected comparison operator');
      }
      this.advance();
      const right = this.parseShift();
      left = { type: 'BinaryExpr', op, left, right };
    }

    return left;
  }

  private parseShift(): BehavioralExpr {
    let left = this.parseAddSub();

    while (this.check('LT_LT') || this.check('GT_GT')) {
      const op: BinaryOp = this.current().type === 'LT_LT' ? '<<' : '>>';
      this.advance();
      const right = this.parseAddSub();
      left = { type: 'BinaryExpr', op, left, right };
    }

    return left;
  }

  private parseAddSub(): BehavioralExpr {
    let left = this.parseMulDiv();

    while (this.check('PLUS') || this.check('MINUS')) {
      const op: BinaryOp = this.current().type === 'PLUS' ? '+' : '-';
      this.advance();
      const right = this.parseMulDiv();
      left = { type: 'BinaryExpr', op, left, right };
    }

    return left;
  }

  private parseMulDiv(): BehavioralExpr {
    let left = this.parseUnary();

    while (this.check('STAR')) {
      this.advance();
      const right = this.parseUnary();
      left = { type: 'BinaryExpr', op: '*', left, right };
    }

    return left;
  }

  private parseUnary(): BehavioralExpr {
    if (this.check('TILDE')) {
      this.advance();
      const operand = this.parseUnary();
      return { type: 'UnaryExpr', op: '~', operand };
    }

    if (this.check('BANG')) {
      this.advance();
      const operand = this.parseUnary();
      return { type: 'UnaryExpr', op: '!', operand };
    }

    return this.parsePostfix();
  }

  private parsePostfix(): BehavioralExpr {
    let expr = this.parseBehavioralPrimary();

    while (true) {
      if (this.check('LBRACKET')) {
        this.advance();
        const index = this.parseBehavioralExpr();

        if (this.check('COLON')) {
          // Slice: [hi:lo]
          this.advance();
          const end = parseInt(this.expect('NUMBER').value, 10);
          this.expect('RBRACKET');
          // start must be a number for slices
          if (index.type !== 'BehavioralNumberExpr') {
            throw this.error('Slice indices must be numbers');
          }
          expr = { type: 'BehavioralSliceExpr', object: expr, start: index.value, end };
        } else {
          // Index: [n]
          this.expect('RBRACKET');
          expr = { type: 'BehavioralIndexExpr', object: expr, index };
        }
      } else {
        break;
      }
    }

    return expr;
  }

  private parseBehavioralPrimary(): BehavioralExpr {
    // Number literal
    if (this.check('NUMBER')) {
      const value = this.parseNumber();
      return { type: 'BehavioralNumberExpr', value };
    }

    // Concat: { a, b, c }
    if (this.check('LBRACE')) {
      this.advance();
      const parts: BehavioralExpr[] = [];

      if (!this.check('RBRACE')) {
        do {
          parts.push(this.parseBehavioralExpr());
        } while (this.match('COMMA'));
      }

      this.expect('RBRACE');
      return { type: 'BehavioralConcatExpr', parts };
    }

    // Parenthesized expression
    if (this.check('LPAREN')) {
      this.advance();
      const expr = this.parseBehavioralExpr();
      this.expect('RPAREN');
      return expr;
    }

    // Identifier or function call
    if (this.check('IDENTIFIER')) {
      const name = this.advance().value;

      // Check if this is a function call: name(...)
      if (this.check('LPAREN')) {
        this.advance();
        const args: BehavioralExpr[] = [];

        if (!this.check('RPAREN')) {
          do {
            args.push(this.parseBehavioralExpr());
          } while (this.match('COMMA'));
        }

        this.expect('RPAREN');
        return { type: 'BehavioralCallExpr', moduleName: name, args };
      }

      return { type: 'BehavioralIdentifierExpr', name };
    }

    throw this.error(`Unexpected token in expression: ${this.current().type}`);
  }

  private parseParams(): Param[] {
    const params: Param[] = [];

    if (this.check('RPAREN')) return params;

    do {
      const name = this.expect('IDENTIFIER').value;
      let width = 1;

      if (this.check('COLON')) {
        this.advance();
        width = parseInt(this.expect('NUMBER').value, 10);
      }

      params.push({ type: 'Param', name, width });
    } while (this.match('COMMA'));

    return params;
  }

  private parseOutputs(): Output[] {
    const outputs: Output[] = [];

    // Check for multiple outputs: (out1, out2) - parenthesized form
    if (this.check('LPAREN')) {
      this.advance();

      do {
        outputs.push(this.parseOutput());
      } while (this.match('COMMA'));

      this.expect('RPAREN');
    } else {
      // One or more outputs separated by commas: out1:8, out2, out3:
      do {
        outputs.push(this.parseOutput());
      } while (this.match('COMMA'));
    }

    return outputs;
  }

  private parseOutput(): Output {
    const name = this.expect('IDENTIFIER').value;
    let width = 1;

    // Only parse width if COLON is followed by NUMBER
    // Otherwise the COLON is the module header terminator
    if (this.check('COLON') && this.peek(1)?.type === 'NUMBER') {
      this.advance(); // consume ':'
      width = parseInt(this.expect('NUMBER').value, 10);
      // DON'T consume the trailing colon here - it's the module header terminator
    }

    return { type: 'Output', name, width };
  }

  private peek(offset: number): Token | undefined {
    const pos = this.pos + offset;
    if (pos >= this.tokens.length) return undefined;
    return this.tokens[pos];
  }

  private parseStatement(): Statement {
    const target = this.expect('IDENTIFIER').value;
    this.expect('EQUALS');
    const expr = this.parseExpr();
    this.skipNewlines();

    return { type: 'Statement', target, expr };
  }

  private parseExpr(): Expr {
    // Parse primary expression first
    let expr = this.parsePrimary();

    // Handle postfix operators in a loop: [], [n:m], .field
    while (true) {
      if (this.check('LBRACKET')) {
        this.advance();
        const start = parseInt(this.expect('NUMBER').value, 10);

        if (this.check('COLON')) {
          // Slice: [start:end]
          this.advance();
          const end = parseInt(this.expect('NUMBER').value, 10);
          this.expect('RBRACKET');
          expr = { type: 'SliceExpr', object: expr, start, end };
        } else {
          // Index: [index]
          this.expect('RBRACKET');
          expr = { type: 'IndexExpr', object: expr, index: start };
        }
      } else if (this.check('DOT')) {
        this.advance();
        const field = this.expect('IDENTIFIER').value;
        expr = { type: 'MemberExpr', object: expr, field };
      } else {
        break;
      }
    }

    return expr;
  }

  private parsePrimary(): Expr {
    // Number literal
    if (this.check('NUMBER')) {
      const value = parseInt(this.advance().value, 10);
      return { type: 'NumberExpr', value };
    }

    // Must be identifier or function call
    const name = this.expect('IDENTIFIER').value;

    // Function call: name(args)
    if (this.check('LPAREN')) {
      this.advance();

      // Special case: concat
      if (name === 'concat') {
        const parts = this.parseArgs();
        this.expect('RPAREN');
        return { type: 'ConcatExpr', parts };
      }

      const args = this.parseArgs();
      this.expect('RPAREN');
      return { type: 'CallExpr', callee: name, args };
    }

    // Just an identifier
    return { type: 'IdentifierExpr', name };
  }

  private parseArgs(): Expr[] {
    const args: Expr[] = [];

    if (this.check('RPAREN')) return args;

    do {
      args.push(this.parseExpr());
    } while (this.match('COMMA'));

    return args;
  }

  // Helper methods

  private current(): Token {
    return this.tokens[this.pos];
  }

  private isAtEnd(): boolean {
    return this.current().type === 'EOF';
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return type === 'EOF';
    return this.current().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.pos++;
    return this.tokens[this.pos - 1];
  }

  private match(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private expect(type: TokenType): Token {
    if (this.check(type)) return this.advance();
    throw this.error(`Expected ${type}, got ${this.current().type}`);
  }

  private skipNewlines(): void {
    while (this.check('NEWLINE')) {
      this.advance();
    }
  }

  private error(message: string): Error {
    const token = this.current();
    return new Error(
      `Parse error at line ${token.line}, column ${token.column}: ${message}`
    );
  }
}

export function parse(source: string): Program {
  const tokens = tokenize(source);
  return new Parser(tokens).parse();
}
