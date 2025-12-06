// Recursive descent parser for the Wire HDL language

import { Token, TokenType, tokenize } from './lexer.js';
import {
  Program,
  ModuleDecl,
  Param,
  Output,
  Statement,
  Expr,
  CallExpr,
  IndexExpr,
  SliceExpr,
  MemberExpr,
  IdentifierExpr,
  NumberExpr,
  ConcatExpr,
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

    const statements = this.parseStatements();

    return {
      type: 'ModuleDecl',
      name,
      params,
      outputs,
      statements,
      loc: { line: loc.line, column: loc.column, offset: loc.offset },
    };
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

    // Check for multiple outputs: (out1, out2)
    if (this.check('LPAREN')) {
      this.advance();

      do {
        outputs.push(this.parseOutput());
      } while (this.match('COMMA'));

      this.expect('RPAREN');
    } else {
      // Single output
      outputs.push(this.parseOutput());
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

  private parseStatements(): Statement[] {
    const statements: Statement[] = [];

    while (!this.isAtEnd() && !this.check('MODULE')) {
      if (this.check('NEWLINE')) {
        this.advance();
        continue;
      }
      if (this.check('EOF')) {
        break;
      }

      statements.push(this.parseStatement());
    }

    return statements;
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
