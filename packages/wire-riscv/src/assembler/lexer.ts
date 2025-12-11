/**
 * RISC-V Assembler Lexer
 *
 * Tokenizes RISC-V assembly source code into tokens for parsing.
 */

export enum TokenType {
  // Instructions and identifiers
  INSTRUCTION = 'INSTRUCTION',
  REGISTER = 'REGISTER',
  IDENTIFIER = 'IDENTIFIER',
  LABEL_DEF = 'LABEL_DEF',

  // Literals
  NUMBER = 'NUMBER',
  STRING = 'STRING',

  // Directives
  DIRECTIVE = 'DIRECTIVE',

  // Punctuation
  COMMA = 'COMMA',
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  NEWLINE = 'NEWLINE',

  // End of file
  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string | number;
  line: number;
  column: number;
}

// RV32I instruction mnemonics
const INSTRUCTIONS = new Set([
  // U-type
  'LUI', 'AUIPC',
  // J-type
  'JAL',
  // I-type (jumps)
  'JALR',
  // B-type (branches)
  'BEQ', 'BNE', 'BLT', 'BGE', 'BLTU', 'BGEU',
  // I-type (loads)
  'LB', 'LH', 'LW', 'LBU', 'LHU',
  // S-type (stores)
  'SB', 'SH', 'SW',
  // I-type (ALU immediate)
  'ADDI', 'SLTI', 'SLTIU', 'XORI', 'ORI', 'ANDI', 'SLLI', 'SRLI', 'SRAI',
  // R-type (ALU register)
  'ADD', 'SUB', 'SLL', 'SLT', 'SLTU', 'XOR', 'SRL', 'SRA', 'OR', 'AND',
  // System
  'ECALL', 'EBREAK', 'FENCE',
  // Pseudo-instructions
  'NOP', 'LI', 'LA', 'MV', 'NOT', 'NEG', 'SEQZ', 'SNEZ', 'SLTZ', 'SGTZ',
  'BEQZ', 'BNEZ', 'BLEZ', 'BGEZ', 'BLTZ', 'BGTZ',
  'BGT', 'BLE', 'BGTU', 'BLEU',
  'J', 'JR', 'RET', 'CALL', 'TAIL',
]);

// Directives
const DIRECTIVES = new Set([
  '.ORG', '.BYTE', '.HALF', '.WORD',
  '.ASCII', '.ASCIIZ', '.STRING',
  '.ALIGN', '.SPACE', '.ZERO',
  '.EQU', '.SET', '.EQUIV',
  '.GLOBAL', '.GLOBL', '.LOCAL',
  '.SECTION', '.TEXT', '.DATA', '.BSS', '.RODATA',
  '.INCLUDE', '.INCBIN',
]);

// Register aliases
const REGISTER_ALIASES: Record<string, number> = {
  'zero': 0,
  'ra': 1,
  'sp': 2,
  'gp': 3,
  'tp': 4,
  't0': 5, 't1': 6, 't2': 7,
  's0': 8, 'fp': 8, // s0 and fp are the same
  's1': 9,
  'a0': 10, 'a1': 11, 'a2': 12, 'a3': 13, 'a4': 14, 'a5': 15, 'a6': 16, 'a7': 17,
  's2': 18, 's3': 19, 's4': 20, 's5': 21, 's6': 22, 's7': 23, 's8': 24, 's9': 25, 's10': 26, 's11': 27,
  't3': 28, 't4': 29, 't5': 30, 't6': 31,
};

export class LexerError extends Error {
  constructor(message: string, public line: number, public column: number) {
    super(`${message} at line ${line}, column ${column}`);
    this.name = 'LexerError';
  }
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
    this.tokens = [];
    this.pos = 0;
    this.line = 1;
    this.column = 1;

    while (!this.isAtEnd()) {
      this.scanToken();
    }

    this.tokens.push({
      type: TokenType.EOF,
      value: '',
      line: this.line,
      column: this.column,
    });

    return this.tokens;
  }

  private isAtEnd(): boolean {
    return this.pos >= this.source.length;
  }

  private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.source[this.pos];
  }

  private peekNext(): string {
    if (this.pos + 1 >= this.source.length) return '\0';
    return this.source[this.pos + 1];
  }

  private advance(): string {
    const char = this.source[this.pos++];
    if (char === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return char;
  }

  private scanToken(): void {
    const startLine = this.line;
    const startColumn = this.column;
    const char = this.advance();

    switch (char) {
      case ' ':
      case '\t':
      case '\r':
        // Skip whitespace
        break;

      case '\n':
        this.tokens.push({
          type: TokenType.NEWLINE,
          value: '\n',
          line: startLine,
          column: startColumn,
        });
        break;

      case ',':
        this.tokens.push({
          type: TokenType.COMMA,
          value: ',',
          line: startLine,
          column: startColumn,
        });
        break;

      case '(':
        this.tokens.push({
          type: TokenType.LPAREN,
          value: '(',
          line: startLine,
          column: startColumn,
        });
        break;

      case ')':
        this.tokens.push({
          type: TokenType.RPAREN,
          value: ')',
          line: startLine,
          column: startColumn,
        });
        break;

      case ';':
      case '#':
        // Skip comment until end of line
        while (!this.isAtEnd() && this.peek() !== '\n') {
          this.advance();
        }
        break;

      case '"':
        this.scanString(startLine, startColumn);
        break;

      case '.':
        this.scanDirective(startLine, startColumn);
        break;

      case '-':
        // Negative number
        if (this.isDigit(this.peek())) {
          this.scanNumber(startLine, startColumn, true);
        } else {
          throw new LexerError(`Unexpected character '-'`, startLine, startColumn);
        }
        break;

      default:
        if (this.isDigit(char)) {
          this.pos--; // Put back the character
          this.column--;
          this.scanNumber(startLine, startColumn, false);
        } else if (this.isAlpha(char) || char === '_') {
          this.pos--; // Put back the character
          this.column--;
          this.scanIdentifier(startLine, startColumn);
        } else {
          throw new LexerError(`Unexpected character '${char}'`, startLine, startColumn);
        }
    }
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private isAlpha(char: string): boolean {
    return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');
  }

  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char) || char === '_';
  }

  private isHexDigit(char: string): boolean {
    return this.isDigit(char) || (char >= 'a' && char <= 'f') || (char >= 'A' && char <= 'F');
  }

  private isBinaryDigit(char: string): boolean {
    return char === '0' || char === '1';
  }

  private scanNumber(startLine: number, startColumn: number, negative: boolean): void {
    let value = 0;

    // Check for hex or binary prefix
    if (this.peek() === '0' && (this.peekNext() === 'x' || this.peekNext() === 'X')) {
      this.advance(); // consume '0'
      this.advance(); // consume 'x' or 'X'
      value = this.scanHexNumber();
    } else if (this.peek() === '0' && (this.peekNext() === 'b' || this.peekNext() === 'B')) {
      this.advance(); // consume '0'
      this.advance(); // consume 'b' or 'B'
      value = this.scanBinaryNumber();
    } else {
      value = this.scanDecimalNumber();
    }

    if (negative) {
      value = -value;
    }

    this.tokens.push({
      type: TokenType.NUMBER,
      value: value,
      line: startLine,
      column: startColumn,
    });
  }

  private scanDecimalNumber(): number {
    let numStr = '';
    while (!this.isAtEnd() && this.isDigit(this.peek())) {
      numStr += this.advance();
    }
    return parseInt(numStr, 10);
  }

  private scanHexNumber(): number {
    let numStr = '';
    while (!this.isAtEnd() && this.isHexDigit(this.peek())) {
      numStr += this.advance();
    }
    return parseInt(numStr, 16);
  }

  private scanBinaryNumber(): number {
    let numStr = '';
    while (!this.isAtEnd() && this.isBinaryDigit(this.peek())) {
      numStr += this.advance();
    }
    return parseInt(numStr, 2);
  }

  private scanString(startLine: number, startColumn: number): void {
    let value = '';

    while (!this.isAtEnd() && this.peek() !== '"') {
      if (this.peek() === '\n') {
        throw new LexerError('Unterminated string literal', startLine, startColumn);
      }

      if (this.peek() === '\\') {
        this.advance(); // consume backslash
        if (this.isAtEnd()) {
          throw new LexerError('Unterminated string literal', startLine, startColumn);
        }
        const escaped = this.advance();
        switch (escaped) {
          case 'n': value += '\n'; break;
          case 't': value += '\t'; break;
          case 'r': value += '\r'; break;
          case '\\': value += '\\'; break;
          case '"': value += '"'; break;
          case '0': value += '\0'; break;
          default: value += escaped; break;
        }
      } else {
        value += this.advance();
      }
    }

    if (this.isAtEnd()) {
      throw new LexerError('Unterminated string literal', startLine, startColumn);
    }

    this.advance(); // consume closing quote

    this.tokens.push({
      type: TokenType.STRING,
      value: value,
      line: startLine,
      column: startColumn,
    });
  }

  private scanDirective(startLine: number, startColumn: number): void {
    let name = '.';
    while (!this.isAtEnd() && this.isAlphaNumeric(this.peek())) {
      name += this.advance();
    }

    const upperName = name.toUpperCase();

    this.tokens.push({
      type: TokenType.DIRECTIVE,
      value: upperName,
      line: startLine,
      column: startColumn,
    });
  }

  private scanIdentifier(startLine: number, startColumn: number): void {
    let name = '';
    while (!this.isAtEnd() && this.isAlphaNumeric(this.peek())) {
      name += this.advance();
    }

    const upperName = name.toUpperCase();
    const lowerName = name.toLowerCase();

    // Check if it's a label definition (followed by colon)
    if (this.peek() === ':') {
      this.advance(); // consume colon
      this.tokens.push({
        type: TokenType.LABEL_DEF,
        value: name,
        line: startLine,
        column: startColumn,
      });
      return;
    }

    // Check if it's a numeric register (x0-x31)
    if (lowerName.startsWith('x') && lowerName.length >= 2) {
      const regNum = parseInt(lowerName.slice(1), 10);
      if (!isNaN(regNum) && regNum >= 0 && regNum <= 31) {
        this.tokens.push({
          type: TokenType.REGISTER,
          value: regNum,
          line: startLine,
          column: startColumn,
        });
        return;
      }
    }

    // Check if it's a register alias
    if (lowerName in REGISTER_ALIASES) {
      this.tokens.push({
        type: TokenType.REGISTER,
        value: REGISTER_ALIASES[lowerName],
        line: startLine,
        column: startColumn,
      });
      return;
    }

    // Check if it's an instruction
    if (INSTRUCTIONS.has(upperName)) {
      this.tokens.push({
        type: TokenType.INSTRUCTION,
        value: upperName,
        line: startLine,
        column: startColumn,
      });
      return;
    }

    // Otherwise it's an identifier (label reference)
    this.tokens.push({
      type: TokenType.IDENTIFIER,
      value: name,
      line: startLine,
      column: startColumn,
    });
  }
}
