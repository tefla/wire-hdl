// Lexer for the Wire HDL language

export type TokenType =
  | 'MODULE'
  | 'ARROW'      // ->
  | 'COLON'      // :
  | 'LPAREN'     // (
  | 'RPAREN'     // )
  | 'LBRACKET'   // [
  | 'RBRACKET'   // ]
  | 'COMMA'      // ,
  | 'DOT'        // .
  | 'EQUALS'     // =
  | 'IDENTIFIER'
  | 'NUMBER'
  | 'NEWLINE'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
  offset: number;
}

export class Lexer {
  private source: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: Token[] = [];

  constructor(source: string) {
    this.source = source;
  }

  tokenize(): Token[] {
    while (this.pos < this.source.length) {
      this.skipWhitespaceAndComments();
      if (this.pos >= this.source.length) break;

      const char = this.source[this.pos];

      // Newline
      if (char === '\n') {
        this.addToken('NEWLINE', '\n');
        this.advance();
        this.line++;
        this.column = 1;
        continue;
      }

      // Arrow ->
      if (char === '-' && this.peek(1) === '>') {
        this.addToken('ARROW', '->');
        this.advance(2);
        continue;
      }

      // Single character tokens
      if (char === ':') {
        this.addToken('COLON', ':');
        this.advance();
        continue;
      }
      if (char === '(') {
        this.addToken('LPAREN', '(');
        this.advance();
        continue;
      }
      if (char === ')') {
        this.addToken('RPAREN', ')');
        this.advance();
        continue;
      }
      if (char === '[') {
        this.addToken('LBRACKET', '[');
        this.advance();
        continue;
      }
      if (char === ']') {
        this.addToken('RBRACKET', ']');
        this.advance();
        continue;
      }
      if (char === ',') {
        this.addToken('COMMA', ',');
        this.advance();
        continue;
      }
      if (char === '.') {
        this.addToken('DOT', '.');
        this.advance();
        continue;
      }
      if (char === '=') {
        this.addToken('EQUALS', '=');
        this.advance();
        continue;
      }

      // Numbers
      if (this.isDigit(char)) {
        this.readNumber();
        continue;
      }

      // Identifiers and keywords
      if (this.isAlpha(char) || char === '_') {
        this.readIdentifier();
        continue;
      }

      throw new Error(
        `Unexpected character '${char}' at line ${this.line}, column ${this.column}`
      );
    }

    this.addToken('EOF', '');
    return this.tokens;
  }

  private skipWhitespaceAndComments(): void {
    while (this.pos < this.source.length) {
      const char = this.source[this.pos];

      // Skip spaces and tabs (but not newlines)
      if (char === ' ' || char === '\t' || char === '\r') {
        this.advance();
        continue;
      }

      // Skip comments (;)
      if (char === ';') {
        while (this.pos < this.source.length && this.source[this.pos] !== '\n') {
          this.advance();
        }
        continue;
      }

      break;
    }
  }

  private readNumber(): void {
    const start = this.pos;
    while (this.pos < this.source.length && this.isDigit(this.source[this.pos])) {
      this.advance();
    }
    this.addToken('NUMBER', this.source.slice(start, this.pos));
  }

  private readIdentifier(): void {
    const start = this.pos;
    while (
      this.pos < this.source.length &&
      (this.isAlphaNumeric(this.source[this.pos]) || this.source[this.pos] === '_')
    ) {
      this.advance();
    }
    const value = this.source.slice(start, this.pos);

    // Check for keywords
    if (value === 'module') {
      this.addToken('MODULE', value);
    } else {
      this.addToken('IDENTIFIER', value);
    }
  }

  private addToken(type: TokenType, value: string): void {
    this.tokens.push({
      type,
      value,
      line: this.line,
      column: this.column - value.length,
      offset: this.pos - value.length,
    });
  }

  private advance(count: number = 1): void {
    for (let i = 0; i < count; i++) {
      if (this.source[this.pos] === '\n') {
        // Line tracking handled in main loop
      } else {
        this.column++;
      }
      this.pos++;
    }
  }

  private peek(offset: number = 0): string {
    const pos = this.pos + offset;
    if (pos >= this.source.length) return '\0';
    return this.source[pos];
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private isAlpha(char: string): boolean {
    return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');
  }

  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char);
  }
}

export function tokenize(source: string): Token[] {
  return new Lexer(source).tokenize();
}
