// Stage 1 Assembler for wire-hdl CPU
// Extended assembler with macros, conditional assembly, and advanced syntax
//
// New features over Stage 0:
// - Macros: .MACRO, .ENDM with parameter substitution
// - Conditional assembly: .IF, .ELSE, .ENDIF, .IFDEF, .IFNDEF
// - Local labels: @name (scoped to macro or .PROC)
// - Repeat blocks: .REPEAT count, .ENDR
// - Enhanced expressions: *, /, %, |, &, ^, ~, <<, >>
// - New directives: .ASCIIZ, .DS/.RES, .PROC/.ENDPROC, .ALIGN
// - Include files: .INCLUDE "filename"
// - Enhanced error reporting with line/column info

import { OPCODES } from './stage0.js';

// ============================================================================
// Types
// ============================================================================

type TokenType =
  | 'LABEL' | 'LOCAL_LABEL' | 'MNEMONIC' | 'NUMBER' | 'STRING'
  | 'COMMA' | 'HASH' | 'DOLLAR' | 'LPAREN' | 'RPAREN' | 'LBRACKET' | 'RBRACKET'
  | 'EQUALS' | 'DOT' | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH' | 'PERCENT'
  | 'PIPE' | 'AMPERSAND' | 'CARET' | 'TILDE' | 'LSHIFT' | 'RSHIFT'
  | 'LESS' | 'GREATER' | 'BACKSLASH' | 'AT'
  | 'NEWLINE' | 'EOF';

interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

interface SourceLocation {
  line: number;
  column: number;
  file?: string;
}

type AddressingMode =
  | 'immediate' | 'absolute' | 'absolute_x' | 'absolute_y'
  | 'zeropage' | 'zeropage_x' | 'zeropage_y'
  | 'indirect' | 'indirect_x' | 'indirect_y'
  | 'relative' | 'implied' | 'accumulator' | 'data';

interface Instruction {
  mnemonic: string;
  mode: AddressingMode;
  operand?: number;
  label?: string;
  offset?: number;
  lowByte?: boolean;
  highByte?: boolean;
  location: SourceLocation;
}

interface MacroDefinition {
  name: string;
  params: string[];
  body: string;
  location: SourceLocation;
}

interface AssemblerOptions {
  includeResolver?: (filename: string, currentFile?: string) => string | null;
  defines?: Record<string, number>;
}

export interface AssemblerOutput {
  bytes: Uint8Array;
  labels: Map<string, number>;
  origin: number;
  errors: AssemblerError[];
  warnings: AssemblerWarning[];
}

interface AssemblerError {
  message: string;
  location: SourceLocation;
}

interface AssemblerWarning {
  message: string;
  location: SourceLocation;
}

// ============================================================================
// Tokenizer
// ============================================================================

class Tokenizer {
  private source: string;
  private pos = 0;
  private line = 1;
  private column = 1;
  private file?: string;

  constructor(source: string, file?: string) {
    this.source = source;
    this.file = file;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.pos < this.source.length) {
      const token = this.nextToken();
      if (token) {
        tokens.push(token);
      }
    }

    tokens.push(this.makeToken('EOF', ''));
    return tokens;
  }

  private peek(offset = 0): string {
    return this.source[this.pos + offset] || '\0';
  }

  private advance(): string {
    const ch = this.source[this.pos++] || '\0';
    if (ch === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return ch;
  }

  private makeToken(type: TokenType, value: string, startLine?: number, startCol?: number): Token {
    return {
      type,
      value,
      line: startLine ?? this.line,
      column: startCol ?? this.column,
    };
  }

  private nextToken(): Token | null {
    // Skip whitespace (but not newlines)
    while (this.peek() === ' ' || this.peek() === '\t' || this.peek() === '\r') {
      this.advance();
    }

    if (this.pos >= this.source.length) {
      return null;
    }

    const startLine = this.line;
    const startCol = this.column;
    const ch = this.peek();

    // Skip comments
    if (ch === ';') {
      while (this.pos < this.source.length && this.peek() !== '\n') {
        this.advance();
      }
      return null;
    }

    // Newline
    if (ch === '\n') {
      this.advance();
      return this.makeToken('NEWLINE', '\n', startLine, startCol);
    }

    // Single-character tokens
    const singleCharTokens: Record<string, TokenType> = {
      '#': 'HASH', '$': 'DOLLAR', ',': 'COMMA',
      '(': 'LPAREN', ')': 'RPAREN', '[': 'LBRACKET', ']': 'RBRACKET',
      '=': 'EQUALS', '.': 'DOT', '+': 'PLUS', '-': 'MINUS',
      '*': 'STAR', '/': 'SLASH', '%': 'PERCENT',
      '|': 'PIPE', '&': 'AMPERSAND', '^': 'CARET', '~': 'TILDE',
      '\\': 'BACKSLASH', '@': 'AT',
    };

    if (singleCharTokens[ch]) {
      this.advance();
      return this.makeToken(singleCharTokens[ch], ch, startLine, startCol);
    }

    // Two-character tokens (<<, >>)
    if (ch === '<') {
      this.advance();
      if (this.peek() === '<') {
        this.advance();
        return this.makeToken('LSHIFT', '<<', startLine, startCol);
      }
      return this.makeToken('LESS', '<', startLine, startCol);
    }

    if (ch === '>') {
      this.advance();
      if (this.peek() === '>') {
        this.advance();
        return this.makeToken('RSHIFT', '>>', startLine, startCol);
      }
      return this.makeToken('GREATER', '>', startLine, startCol);
    }

    // Colon (label marker)
    if (ch === ':') {
      this.advance();
      // Mark previous identifier as a label (handled in parser)
      return null;
    }

    // Character literal 'x'
    if (ch === "'") {
      this.advance(); // skip opening quote
      let value = 0;
      if (this.peek() === '\\') {
        // Escape sequence
        this.advance();
        const esc = this.advance();
        switch (esc) {
          case 'n': value = 10; break;
          case 'r': value = 13; break;
          case 't': value = 9; break;
          case '0': value = 0; break;
          case '\\': value = 92; break;
          case "'": value = 39; break;
          default: value = esc.charCodeAt(0);
        }
      } else {
        value = this.advance().charCodeAt(0);
      }
      if (this.peek() === "'") {
        this.advance(); // skip closing quote
      }
      return this.makeToken('NUMBER', value.toString(), startLine, startCol);
    }

    // String literal "xxx"
    if (ch === '"') {
      this.advance(); // skip opening quote
      let str = '';
      while (this.pos < this.source.length && this.peek() !== '"') {
        if (this.peek() === '\\') {
          this.advance();
          const esc = this.advance();
          switch (esc) {
            case 'n': str += '\n'; break;
            case 'r': str += '\r'; break;
            case 't': str += '\t'; break;
            case '0': str += '\0'; break;
            case '\\': str += '\\'; break;
            case '"': str += '"'; break;
            default: str += esc;
          }
        } else {
          str += this.advance();
        }
      }
      if (this.peek() === '"') {
        this.advance(); // skip closing quote
      }
      return this.makeToken('STRING', str, startLine, startCol);
    }

    // Number (decimal, hex with $, binary with %)
    if (ch >= '0' && ch <= '9') {
      let num = '';
      // Check for binary prefix 0b
      if (ch === '0' && (this.peek(1) === 'b' || this.peek(1) === 'B')) {
        this.advance(); // skip 0
        this.advance(); // skip b
        while (/[01]/.test(this.peek())) {
          num += this.advance();
        }
        return this.makeToken('NUMBER', parseInt(num, 2).toString(), startLine, startCol);
      }
      // Check for hex prefix 0x
      if (ch === '0' && (this.peek(1) === 'x' || this.peek(1) === 'X')) {
        this.advance(); // skip 0
        this.advance(); // skip x
        while (/[0-9A-Fa-f]/.test(this.peek())) {
          num += this.advance();
        }
        return this.makeToken('NUMBER', parseInt(num, 16).toString(), startLine, startCol);
      }
      // Decimal or hex (hex can appear after $)
      while (/[0-9A-Fa-f]/.test(this.peek())) {
        num += this.advance();
      }
      return this.makeToken('NUMBER', num, startLine, startCol);
    }

    // Identifier (label, mnemonic, directive)
    if (/[A-Za-z_]/.test(ch)) {
      let ident = '';
      while (/[A-Za-z0-9_]/.test(this.peek())) {
        ident += this.advance();
      }
      // Check if followed by colon (label definition)
      if (this.peek() === ':') {
        this.advance(); // consume the colon
        return this.makeToken('LABEL', ident.toUpperCase(), startLine, startCol);
      }
      return this.makeToken('MNEMONIC', ident.toUpperCase(), startLine, startCol);
    }

    // Unknown character - skip
    this.advance();
    return null;
  }
}

// ============================================================================
// Preprocessor - handles macros, includes, conditionals
// ============================================================================

class Preprocessor {
  private macros = new Map<string, MacroDefinition>();
  private defines = new Map<string, number>();
  private includeStack: string[] = [];
  private errors: AssemblerError[] = [];
  private warnings: AssemblerWarning[] = [];
  private options: AssemblerOptions;
  private macroCounter = 0;

  constructor(options: AssemblerOptions = {}) {
    this.options = options;
    // Initialize with any predefined constants
    if (options.defines) {
      for (const [name, value] of Object.entries(options.defines)) {
        this.defines.set(name.toUpperCase(), value);
      }
    }
  }

  process(source: string, filename?: string): string {
    const lines = source.split('\n');
    const output: string[] = [];
    let i = 0;
    let conditionStack: boolean[] = [];
    let skipUntilEndif = 0;

    // Prepend predefined constants as EQU statements (only on first call)
    if (!filename && this.defines.size > 0) {
      for (const [name, value] of this.defines) {
        output.push(`${name} = $${value.toString(16).toUpperCase()}`);
      }
    }

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();
      const location: SourceLocation = { line: i + 1, column: 1, file: filename };

      // Handle conditional assembly
      if (trimmed.startsWith('.IF ') || trimmed.startsWith('.IFDEF ') || trimmed.startsWith('.IFNDEF ')) {
        if (skipUntilEndif > 0) {
          skipUntilEndif++;
          i++;
          continue;
        }

        let condition = false;
        if (trimmed.startsWith('.IF ')) {
          const expr = trimmed.slice(4).trim();
          condition = this.evaluateCondition(expr, location);
        } else if (trimmed.startsWith('.IFDEF ')) {
          const name = trimmed.slice(7).trim().toUpperCase();
          condition = this.defines.has(name) || this.macros.has(name);
        } else if (trimmed.startsWith('.IFNDEF ')) {
          const name = trimmed.slice(8).trim().toUpperCase();
          condition = !this.defines.has(name) && !this.macros.has(name);
        }

        conditionStack.push(condition);
        if (!condition) {
          skipUntilEndif = 1;
        }
        i++;
        continue;
      }

      if (trimmed === '.ELSE') {
        if (skipUntilEndif === 1) {
          // We were skipping, now include
          skipUntilEndif = 0;
        } else if (skipUntilEndif === 0 && conditionStack.length > 0) {
          // We were including, now skip
          skipUntilEndif = 1;
        }
        i++;
        continue;
      }

      if (trimmed === '.ENDIF') {
        if (skipUntilEndif > 0) {
          skipUntilEndif--;
        }
        conditionStack.pop();
        i++;
        continue;
      }

      if (skipUntilEndif > 0) {
        i++;
        continue;
      }

      // Handle macro definition
      if (trimmed.startsWith('.MACRO ')) {
        const macroStart = i;
        const headerMatch = trimmed.match(/^\.MACRO\s+(\w+)\s*(.*)$/i);
        if (!headerMatch) {
          this.errors.push({ message: 'Invalid macro definition', location });
          i++;
          continue;
        }

        const macroName = headerMatch[1].toUpperCase();
        const paramsStr = headerMatch[2].trim();
        const params = paramsStr ? paramsStr.split(/\s*,\s*/).map(p => p.toUpperCase()) : [];

        // Collect macro body
        const bodyLines: string[] = [];
        i++;
        while (i < lines.length) {
          const bodyLine = lines[i].trim();
          if (bodyLine === '.ENDM' || bodyLine === '.ENDMACRO') {
            break;
          }
          bodyLines.push(lines[i]);
          i++;
        }

        this.macros.set(macroName, {
          name: macroName,
          params,
          body: bodyLines.join('\n'),
          location: { line: macroStart + 1, column: 1, file: filename },
        });
        i++;
        continue;
      }

      // Handle .DEFINE
      if (trimmed.startsWith('.DEFINE ')) {
        const match = trimmed.match(/^\.DEFINE\s+(\w+)\s+(.+)$/i);
        if (match) {
          const name = match[1].toUpperCase();
          const valueStr = match[2].trim();
          const value = this.parseSimpleNumber(valueStr);
          this.defines.set(name, value);
        }
        i++;
        continue;
      }

      // Handle .INCLUDE
      if (trimmed.startsWith('.INCLUDE ')) {
        const match = trimmed.match(/^\.INCLUDE\s+"([^"]+)"$/i);
        if (match && this.options.includeResolver) {
          const includePath = match[1];
          if (this.includeStack.includes(includePath)) {
            this.errors.push({ message: `Circular include detected: ${includePath}`, location });
          } else {
            this.includeStack.push(includePath);
            const content = this.options.includeResolver(includePath, filename);
            if (content !== null) {
              const processed = this.process(content, includePath);
              output.push(processed);
            } else {
              this.errors.push({ message: `Include file not found: ${includePath}`, location });
            }
            this.includeStack.pop();
          }
        }
        i++;
        continue;
      }

      // Handle .REPEAT / .ENDR
      if (trimmed.startsWith('.REPEAT ')) {
        const countStr = trimmed.slice(8).trim();
        const count = this.parseSimpleNumber(countStr);

        // Collect repeat body
        const bodyLines: string[] = [];
        i++;
        let depth = 1;
        while (i < lines.length && depth > 0) {
          const bodyLine = lines[i].trim();
          if (bodyLine.startsWith('.REPEAT ')) {
            depth++;
            bodyLines.push(lines[i]);
          } else if (bodyLine === '.ENDR') {
            depth--;
            if (depth > 0) {
              bodyLines.push(lines[i]);
            }
          } else {
            bodyLines.push(lines[i]);
          }
          i++;
        }

        // Expand repeat count times, recursively processing for nested repeats
        const bodyText = bodyLines.join('\n');
        for (let r = 0; r < count; r++) {
          const processedBody = this.process(bodyText, filename);
          output.push(processedBody);
        }
        continue;
      }

      // Check for macro invocation (identifier at start that matches a macro)
      const macroMatch = trimmed.match(/^(\w+)(?:\s+(.*))?$/);
      if (macroMatch) {
        const possibleMacro = macroMatch[1].toUpperCase();
        if (this.macros.has(possibleMacro)) {
          const macro = this.macros.get(possibleMacro)!;
          const argsStr = macroMatch[2] || '';
          const args = this.parseArguments(argsStr);
          const expanded = this.expandMacro(macro, args, location);
          output.push(expanded);
          i++;
          continue;
        }
      }

      // Regular line - output as-is
      output.push(line);
      i++;
    }

    return output.join('\n');
  }

  private parseArguments(argsStr: string): string[] {
    if (!argsStr.trim()) return [];

    const args: string[] = [];
    let current = '';
    let parenDepth = 0;
    let inString = false;

    for (let i = 0; i < argsStr.length; i++) {
      const ch = argsStr[i];

      if (ch === '"' && argsStr[i - 1] !== '\\') {
        inString = !inString;
        current += ch;
      } else if (inString) {
        current += ch;
      } else if (ch === '(') {
        parenDepth++;
        current += ch;
      } else if (ch === ')') {
        parenDepth--;
        current += ch;
      } else if (ch === ',' && parenDepth === 0) {
        args.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }

    if (current.trim()) {
      args.push(current.trim());
    }

    return args;
  }

  private expandMacro(macro: MacroDefinition, args: string[], location: SourceLocation): string {
    let body = macro.body;
    const uniqueId = this.macroCounter++;

    // Replace parameters
    for (let i = 0; i < macro.params.length; i++) {
      const param = macro.params[i];
      const arg = args[i] || '';
      // Replace \param or \1, \2, etc.
      body = body.replace(new RegExp(`\\\\${param}`, 'gi'), arg);
      body = body.replace(new RegExp(`\\\\${i + 1}`, 'g'), arg);
    }

    // Replace local labels (@label -> @label_uniqueId)
    body = body.replace(/@(\w+)/g, `@$1_${uniqueId}`);

    // Replace \@ with unique counter
    body = body.replace(/\\@/g, uniqueId.toString());

    return body;
  }

  private evaluateCondition(expr: string, location: SourceLocation): boolean {
    // Simple condition evaluation: number != 0, or defined symbol
    const trimmed = expr.trim().toUpperCase();

    // Check for comparison operators
    const compMatch = trimmed.match(/^(.+?)\s*(==|!=|<>|<=|>=|<|>)\s*(.+)$/);
    if (compMatch) {
      const left = this.parseSimpleNumber(compMatch[1].trim());
      const op = compMatch[2];
      const right = this.parseSimpleNumber(compMatch[3].trim());

      switch (op) {
        case '==': return left === right;
        case '!=': case '<>': return left !== right;
        case '<': return left < right;
        case '>': return left > right;
        case '<=': return left <= right;
        case '>=': return left >= right;
      }
    }

    // Just evaluate as number (0 = false, non-zero = true)
    return this.parseSimpleNumber(trimmed) !== 0;
  }

  private parseSimpleNumber(str: string): number {
    str = str.trim().toUpperCase();

    // Check if it's a defined constant
    if (this.defines.has(str)) {
      return this.defines.get(str)!;
    }

    // Hex with $
    if (str.startsWith('$')) {
      return parseInt(str.slice(1), 16) || 0;
    }
    // Hex with 0x
    if (str.startsWith('0X')) {
      return parseInt(str.slice(2), 16) || 0;
    }
    // Binary with %
    if (str.startsWith('%')) {
      return parseInt(str.slice(1), 2) || 0;
    }
    // Binary with 0b
    if (str.startsWith('0B')) {
      return parseInt(str.slice(2), 2) || 0;
    }
    // Decimal
    return parseInt(str, 10) || 0;
  }

  getErrors(): AssemblerError[] {
    return this.errors;
  }

  getWarnings(): AssemblerWarning[] {
    return this.warnings;
  }
}

// ============================================================================
// Parser
// ============================================================================

// Branch instructions
const BRANCH_OPS = ['BEQ', 'BNE', 'BCC', 'BCS', 'BPL', 'BMI', 'BVC', 'BVS'];

// Implied mode instructions (no operand)
const IMPLIED_OPS = [
  'INX', 'DEX', 'INY', 'DEY', 'TAX', 'TAY', 'TXA', 'TYA', 'TSX', 'TXS',
  'PHA', 'PLA', 'PHP', 'PLP', 'RTS', 'RTI', 'CLC', 'SEC', 'CLI', 'SEI',
  'CLV', 'CLD', 'SED', 'NOP', 'BRK', 'HLT'
];

// Accumulator mode instructions
const ACC_OPS = ['ASL', 'LSR', 'ROL', 'ROR'];

class Parser {
  private tokens: Token[] = [];
  private pos = 0;
  private labels = new Map<string, number>();
  private localLabels = new Map<string, number>();
  private currentScope = '';
  private origin = 0x0200;
  private pc = 0x0200;
  private errors: AssemblerError[] = [];
  private warnings: AssemblerWarning[] = [];

  parse(tokens: Token[]): {
    instructions: Instruction[];
    labels: Map<string, number>;
    origin: number;
    errors: AssemblerError[];
    warnings: AssemblerWarning[];
  } {
    this.tokens = tokens;
    this.pos = 0;
    this.labels = new Map();
    this.localLabels = new Map();
    this.origin = 0x0200;
    this.pc = 0x0200;
    this.errors = [];
    this.warnings = [];

    const instructions: Instruction[] = [];

    while (this.pos < this.tokens.length && this.peek().type !== 'EOF') {
      this.skipNewlines();
      if (this.peek().type === 'EOF') break;

      try {
        const inst = this.parseStatement();
        if (inst) {
          if (Array.isArray(inst)) {
            instructions.push(...inst);
          } else {
            instructions.push(inst);
          }
        }
      } catch (e) {
        const token = this.peek();
        this.errors.push({
          message: e instanceof Error ? e.message : String(e),
          location: { line: token.line, column: token.column },
        });
        // Skip to next line
        while (this.pos < this.tokens.length && this.peek().type !== 'NEWLINE' && this.peek().type !== 'EOF') {
          this.advance();
        }
      }
    }

    return {
      instructions,
      labels: this.labels,
      origin: this.origin,
      errors: this.errors,
      warnings: this.warnings,
    };
  }

  private peek(offset = 0): Token {
    return this.tokens[this.pos + offset] || { type: 'EOF', value: '', line: -1, column: -1 };
  }

  private advance(): Token {
    return this.tokens[this.pos++] || { type: 'EOF', value: '', line: -1, column: -1 };
  }

  private skipNewlines() {
    while (this.peek().type === 'NEWLINE') this.advance();
  }

  private expect(type: TokenType, msg: string): Token {
    const tok = this.advance();
    if (tok.type !== type) {
      throw new Error(`${msg}: expected ${type}, got ${tok.type} (${tok.value}) on line ${tok.line}`);
    }
    return tok;
  }

  private location(): SourceLocation {
    const tok = this.peek();
    return { line: tok.line, column: tok.column };
  }

  private parseStatement(): Instruction | Instruction[] | null {
    const token = this.advance();

    // Handle @ prefix for local labels
    if (token.type === 'AT') {
      const labelToken = this.advance();
      if (labelToken.type === 'MNEMONIC' || labelToken.type === 'LABEL') {
        const localName = `${this.currentScope}@${labelToken.value}`;
        this.localLabels.set(localName, this.pc);
        this.labels.set(localName, this.pc);
        // Check if followed by colon
        if (this.peek().type === 'MNEMONIC' && this.peek().value === ':') {
          this.advance();
        }
        return null;
      }
    }

    // Handle .ORG directive
    if (token.value === 'ORG' || token.value === '.ORG') {
      this.origin = this.parseNumber();
      this.pc = this.origin;
      return null;
    }

    // Handle .PROC directive (creates a new scope)
    if (token.value === '.PROC' || token.value === 'PROC') {
      if (this.peek().type === 'MNEMONIC') {
        this.currentScope = this.advance().value;
        this.labels.set(this.currentScope, this.pc);
      }
      return null;
    }

    // Handle .ENDPROC directive
    if (token.value === '.ENDPROC' || token.value === 'ENDPROC') {
      this.currentScope = '';
      return null;
    }

    // Handle .DB directive (define bytes)
    if (token.value === 'DB' || token.value === '.DB' || token.value === 'BYTE' || token.value === '.BYTE') {
      return this.parseDataBytes();
    }

    // Handle .DW directive (define words)
    if (token.value === 'DW' || token.value === '.DW' || token.value === 'WORD' || token.value === '.WORD') {
      return this.parseDataWords();
    }

    // Handle .ASCIIZ directive (null-terminated string)
    if (token.value === '.ASCIIZ' || token.value === 'ASCIIZ') {
      return this.parseAsciiz();
    }

    // Handle .ASCII directive (string without null terminator)
    if (token.value === '.ASCII' || token.value === 'ASCII') {
      return this.parseAscii();
    }

    // Handle .DS/.RES directive (define storage/reserve bytes)
    if (token.value === '.DS' || token.value === 'DS' || token.value === '.RES' || token.value === 'RES') {
      const count = this.parseNumber();
      const fillValue = this.peek().type === 'COMMA' ? (this.advance(), this.parseNumber()) : 0;
      const insts: Instruction[] = [];
      for (let i = 0; i < count; i++) {
        insts.push({ mnemonic: '.DB', mode: 'data', operand: fillValue, location: this.location() });
        this.pc++;
      }
      return insts;
    }

    // Handle .ALIGN directive
    if (token.value === '.ALIGN' || token.value === 'ALIGN') {
      const alignment = this.parseNumber();
      const fillValue = this.peek().type === 'COMMA' ? (this.advance(), this.parseNumber()) : 0;
      const insts: Instruction[] = [];
      while (this.pc % alignment !== 0) {
        insts.push({ mnemonic: '.DB', mode: 'data', operand: fillValue, location: this.location() });
        this.pc++;
      }
      return insts;
    }

    // Handle . prefix for other directives
    if (token.type === 'DOT') {
      const directive = this.advance().value;
      if (directive === 'ORG') {
        this.origin = this.parseNumber();
        this.pc = this.origin;
        return null;
      }
      if (directive === 'DB' || directive === 'BYTE') {
        return this.parseDataBytes();
      }
      if (directive === 'DW' || directive === 'WORD') {
        return this.parseDataWords();
      }
      if (directive === 'DS' || directive === 'RES') {
        const count = this.parseNumber();
        const fillValue = this.peek().type === 'COMMA' ? (this.advance(), this.parseNumber()) : 0;
        const insts: Instruction[] = [];
        for (let i = 0; i < count; i++) {
          insts.push({ mnemonic: '.DB', mode: 'data', operand: fillValue, location: this.location() });
          this.pc++;
        }
        return insts;
      }
      if (directive === 'ASCIIZ') {
        return this.parseAsciiz();
      }
      if (directive === 'ASCII') {
        return this.parseAscii();
      }
      if (directive === 'ALIGN') {
        const alignment = this.parseNumber();
        const fillValue = this.peek().type === 'COMMA' ? (this.advance(), this.parseNumber()) : 0;
        const insts: Instruction[] = [];
        while (this.pc % alignment !== 0) {
          insts.push({ mnemonic: '.DB', mode: 'data', operand: fillValue, location: this.location() });
          this.pc++;
        }
        return insts;
      }
      if (directive === 'PROC') {
        if (this.peek().type === 'MNEMONIC') {
          this.currentScope = this.advance().value;
          this.labels.set(this.currentScope, this.pc);
        }
        return null;
      }
      if (directive === 'ENDPROC') {
        this.currentScope = '';
        return null;
      }
      return null;
    }

    // Label definition
    if (token.type === 'LABEL') {
      this.labels.set(token.value, this.pc);
      if (this.currentScope) {
        // Also register with scope prefix for local reference
        this.labels.set(`${this.currentScope}::${token.value}`, this.pc);
      }
      return null;
    }

    // Mnemonic (or EQU definition)
    if (token.type === 'MNEMONIC') {
      // Check for EQU: IDENT = VALUE
      if (this.peek().type === 'EQUALS') {
        this.advance(); // skip =
        const value = this.parseNumber();
        this.labels.set(token.value, value);
        return null;
      }

      return this.parseInstruction(token.value);
    }

    return null;
  }

  private parseDataBytes(): Instruction[] {
    const insts: Instruction[] = [];
    const loc = this.location();

    while (true) {
      // Check for string
      if (this.peek().type === 'STRING') {
        const str = this.advance().value;
        for (const ch of str) {
          insts.push({ mnemonic: '.DB', mode: 'data', operand: ch.charCodeAt(0), location: loc });
          this.pc++;
        }
      } else {
        const expr = this.parseExpression();
        insts.push({
          mnemonic: '.DB',
          mode: 'data',
          operand: expr.value & 0xff,
          label: expr.label,
          lowByte: expr.lowByte,
          highByte: expr.highByte,
          location: loc,
        });
        this.pc++;
      }

      if (this.peek().type === 'COMMA') {
        this.advance();
      } else {
        break;
      }
    }
    return insts;
  }

  private parseDataWords(): Instruction[] {
    const insts: Instruction[] = [];
    const loc = this.location();

    while (true) {
      const expr = this.parseExpression();
      // Low byte first (little-endian)
      insts.push({
        mnemonic: '.DB',
        mode: 'data',
        operand: expr.value & 0xff,
        label: expr.label,
        lowByte: true,
        location: loc,
      });
      this.pc++;
      // High byte second
      insts.push({
        mnemonic: '.DB',
        mode: 'data',
        operand: (expr.value >> 8) & 0xff,
        label: expr.label,
        highByte: true,
        location: loc,
      });
      this.pc++;

      if (this.peek().type === 'COMMA') {
        this.advance();
      } else {
        break;
      }
    }
    return insts;
  }

  private parseAsciiz(): Instruction[] {
    const insts: Instruction[] = [];
    const loc = this.location();

    if (this.peek().type === 'STRING') {
      const str = this.advance().value;
      for (const ch of str) {
        insts.push({ mnemonic: '.DB', mode: 'data', operand: ch.charCodeAt(0), location: loc });
        this.pc++;
      }
      // Null terminator
      insts.push({ mnemonic: '.DB', mode: 'data', operand: 0, location: loc });
      this.pc++;
    }
    return insts;
  }

  private parseAscii(): Instruction[] {
    const insts: Instruction[] = [];
    const loc = this.location();

    if (this.peek().type === 'STRING') {
      const str = this.advance().value;
      for (const ch of str) {
        insts.push({ mnemonic: '.DB', mode: 'data', operand: ch.charCodeAt(0), location: loc });
        this.pc++;
      }
    }
    return insts;
  }

  private parseInstruction(mnemonic: string): Instruction {
    const loc = this.location();

    // Implied mode
    if (IMPLIED_OPS.includes(mnemonic)) {
      this.pc += 1;
      return { mnemonic, mode: 'implied', location: loc };
    }

    // Accumulator mode: ASL A, LSR A, etc.
    if (ACC_OPS.includes(mnemonic)) {
      if (this.peek().type === 'MNEMONIC' && this.peek().value === 'A') {
        this.advance(); // skip 'A'
        this.pc += 1;
        return { mnemonic, mode: 'accumulator', location: loc };
      }
      // Fall through to check other modes (zero page, absolute)
    }

    // Immediate mode: LDA #$xx or LDA #<label or LDA #>label
    if (this.peek().type === 'HASH') {
      this.advance(); // skip #
      const expr = this.parseExpression();
      this.pc += 2;
      return {
        mnemonic,
        mode: 'immediate',
        operand: expr.value,
        label: expr.label,
        offset: expr.offset,
        lowByte: expr.lowByte,
        highByte: expr.highByte,
        location: loc,
      };
    }

    // Indirect modes: ($xx),Y or ($xx,X) or ($xxxx)
    if (this.peek().type === 'LPAREN') {
      this.advance(); // skip (
      const operand = this.parseNumber();

      if (this.peek().type === 'COMMA') {
        // Indexed indirect: ($xx,X)
        this.advance(); // skip ,
        const reg = this.advance().value; // X or Y
        this.expect('RPAREN', 'Expected )');
        if (reg === 'X') {
          this.pc += 2;
          return { mnemonic, mode: 'indirect_x', operand, location: loc };
        }
        throw new Error(`Invalid indexed indirect mode on line ${this.peek().line}`);
      }

      if (this.peek().type === 'RPAREN') {
        this.advance(); // skip )
        if (this.peek().type === 'COMMA') {
          // Indirect indexed: ($xx),Y
          this.advance(); // skip ,
          const reg = this.advance().value;
          if (reg === 'Y') {
            this.pc += 2;
            return { mnemonic, mode: 'indirect_y', operand, location: loc };
          }
          throw new Error(`Invalid indirect indexed mode on line ${this.peek().line}`);
        }
        // Plain indirect: ($xxxx) - for JMP
        this.pc += 3;
        return { mnemonic, mode: 'indirect', operand, location: loc };
      }
    }

    // Direct addressing: $xx or $xxxx or $xx,X or $xxxx,X or $xx,Y or $xxxx,Y
    if (this.peek().type === 'DOLLAR') {
      const operand = this.parseNumber();
      const isZeroPage = operand <= 0xff;

      // Check for indexed mode: ,X or ,Y
      if (this.peek().type === 'COMMA') {
        this.advance(); // skip ,
        const reg = this.advance().value;

        if (reg === 'X') {
          if (isZeroPage) {
            this.pc += 2;
            return { mnemonic, mode: 'zeropage_x', operand, location: loc };
          }
          this.pc += 3;
          return { mnemonic, mode: 'absolute_x', operand, location: loc };
        }
        if (reg === 'Y') {
          if (isZeroPage) {
            this.pc += 2;
            return { mnemonic, mode: 'zeropage_y', operand, location: loc };
          }
          this.pc += 3;
          return { mnemonic, mode: 'absolute_y', operand, location: loc };
        }
        throw new Error(`Invalid index register ${reg} on line ${this.peek().line}`);
      }

      // Branch instructions always use relative mode
      if (BRANCH_OPS.includes(mnemonic)) {
        this.pc += 2;
        return { mnemonic, mode: 'relative', operand, location: loc };
      }

      // Zero page or absolute mode
      if (isZeroPage) {
        this.pc += 2;
        return { mnemonic, mode: 'zeropage', operand, location: loc };
      }
      this.pc += 3;
      return { mnemonic, mode: 'absolute', operand, location: loc };
    }

    // Local label reference (@label)
    if (this.peek().type === 'AT') {
      this.advance(); // skip @
      const labelToken = this.advance();
      const localName = `${this.currentScope}@${labelToken.value}`;

      // Check for indexed mode
      if (this.peek().type === 'COMMA') {
        this.advance();
        const reg = this.advance().value;
        if (reg === 'X') {
          this.pc += 3;
          return { mnemonic, mode: 'absolute_x', label: localName, operand: 0, location: loc };
        }
        if (reg === 'Y') {
          this.pc += 3;
          return { mnemonic, mode: 'absolute_y', label: localName, operand: 0, location: loc };
        }
      }

      if (BRANCH_OPS.includes(mnemonic)) {
        this.pc += 2;
        return { mnemonic, mode: 'relative', label: localName, operand: 0, location: loc };
      }
      this.pc += 3;
      return { mnemonic, mode: 'absolute', label: localName, operand: 0, location: loc };
    }

    // Label reference (with optional +/- offset)
    if (this.peek().type === 'MNEMONIC') {
      const expr = this.parseExpression();
      const labelName = expr.label;
      const offset = expr.offset || 0;

      // Check for indexed mode: ,X or ,Y
      if (this.peek().type === 'COMMA') {
        this.advance(); // skip ,
        const reg = this.advance().value;
        if (reg === 'X') {
          this.pc += 3;
          return { mnemonic, mode: 'absolute_x', label: labelName, offset, operand: expr.value, location: loc };
        }
        if (reg === 'Y') {
          this.pc += 3;
          return { mnemonic, mode: 'absolute_y', label: labelName, offset, operand: expr.value, location: loc };
        }
        throw new Error(`Invalid index register ${reg} on line ${this.peek().line}`);
      }

      // Branch instructions use relative mode
      if (BRANCH_OPS.includes(mnemonic)) {
        this.pc += 2;
        return { mnemonic, mode: 'relative', label: labelName, offset, operand: expr.value, location: loc };
      }

      this.pc += 3;
      return { mnemonic, mode: 'absolute', label: labelName, offset, operand: expr.value, location: loc };
    }

    // Expression starting with * (current PC), <, >, or number
    if (this.peek().type === 'STAR' || this.peek().type === 'LESS' || this.peek().type === 'GREATER' || this.peek().type === 'NUMBER') {
      const expr = this.parseExpression();

      // Check for indexed mode: ,X or ,Y
      if (this.peek().type === 'COMMA') {
        this.advance(); // skip ,
        const reg = this.advance().value;
        if (reg === 'X') {
          this.pc += 3;
          return { mnemonic, mode: 'absolute_x', operand: expr.value, location: loc };
        }
        if (reg === 'Y') {
          this.pc += 3;
          return { mnemonic, mode: 'absolute_y', operand: expr.value, location: loc };
        }
        throw new Error(`Invalid index register ${reg} on line ${this.peek().line}`);
      }

      // Branch instructions use relative mode
      if (BRANCH_OPS.includes(mnemonic)) {
        this.pc += 2;
        return { mnemonic, mode: 'relative', operand: expr.value, location: loc };
      }

      // Zero page or absolute based on value
      if (expr.value <= 0xff && expr.value >= 0) {
        this.pc += 2;
        return { mnemonic, mode: 'zeropage', operand: expr.value, location: loc };
      }

      this.pc += 3;
      return { mnemonic, mode: 'absolute', operand: expr.value, location: loc };
    }

    throw new Error(`Unexpected token after ${mnemonic}: ${this.peek().value} (${this.peek().type}) on line ${this.peek().line}`);
  }

  // Expression parsing with operator precedence
  private parseExpression(): { value: number; label?: string; offset: number; lowByte?: boolean; highByte?: boolean } {
    return this.parseOr();
  }

  private parseOr(): { value: number; label?: string; offset: number; lowByte?: boolean; highByte?: boolean } {
    let left = this.parseXor();
    while (this.peek().type === 'PIPE') {
      this.advance();
      const right = this.parseXor();
      left = { value: left.value | right.value, offset: 0 };
    }
    return left;
  }

  private parseXor(): { value: number; label?: string; offset: number; lowByte?: boolean; highByte?: boolean } {
    let left = this.parseAnd();
    while (this.peek().type === 'CARET') {
      this.advance();
      const right = this.parseAnd();
      left = { value: left.value ^ right.value, offset: 0 };
    }
    return left;
  }

  private parseAnd(): { value: number; label?: string; offset: number; lowByte?: boolean; highByte?: boolean } {
    let left = this.parseShift();
    while (this.peek().type === 'AMPERSAND') {
      this.advance();
      const right = this.parseShift();
      left = { value: left.value & right.value, offset: 0 };
    }
    return left;
  }

  private parseShift(): { value: number; label?: string; offset: number; lowByte?: boolean; highByte?: boolean } {
    let left = this.parseAddSub();
    while (this.peek().type === 'LSHIFT' || this.peek().type === 'RSHIFT') {
      const op = this.advance().type;
      const right = this.parseAddSub();
      if (op === 'LSHIFT') {
        left = { value: left.value << right.value, offset: 0 };
      } else {
        left = { value: left.value >>> right.value, offset: 0 };
      }
    }
    return left;
  }

  private parseAddSub(): { value: number; label?: string; offset: number; lowByte?: boolean; highByte?: boolean } {
    let left = this.parseMulDiv();
    let offset = 0;

    while (this.peek().type === 'PLUS' || this.peek().type === 'MINUS') {
      const op = this.advance().type;
      const right = this.parseMulDiv();
      if (op === 'PLUS') {
        if (left.label) {
          offset += right.value;
        } else {
          left = { value: left.value + right.value, offset: 0 };
        }
      } else {
        if (left.label) {
          offset -= right.value;
        } else {
          left = { value: left.value - right.value, offset: 0 };
        }
      }
    }

    if (left.label) {
      return { ...left, offset };
    }
    return left;
  }

  private parseMulDiv(): { value: number; label?: string; offset: number; lowByte?: boolean; highByte?: boolean } {
    let left = this.parseUnary();
    while (this.peek().type === 'STAR' || this.peek().type === 'SLASH' || this.peek().type === 'PERCENT') {
      const op = this.advance().type;
      const right = this.parseUnary();
      if (op === 'STAR') {
        left = { value: left.value * right.value, offset: 0 };
      } else if (op === 'SLASH') {
        left = { value: Math.floor(left.value / right.value), offset: 0 };
      } else {
        left = { value: left.value % right.value, offset: 0 };
      }
    }
    return left;
  }

  private parseUnary(): { value: number; label?: string; offset: number; lowByte?: boolean; highByte?: boolean } {
    // Handle low byte operator <
    if (this.peek().type === 'LESS') {
      this.advance();
      const inner = this.parseUnary();
      const resolved = inner.label ? this.labels.get(inner.label) : inner.value;
      if (resolved !== undefined) {
        return { value: resolved & 0xff, offset: 0 };
      }
      return { value: 0, label: inner.label, offset: 0, lowByte: true };
    }

    // Handle high byte operator >
    if (this.peek().type === 'GREATER') {
      this.advance();
      const inner = this.parseUnary();
      const resolved = inner.label ? this.labels.get(inner.label) : inner.value;
      if (resolved !== undefined) {
        return { value: (resolved >> 8) & 0xff, offset: 0 };
      }
      return { value: 0, label: inner.label, offset: 0, highByte: true };
    }

    // Handle bitwise NOT ~
    if (this.peek().type === 'TILDE') {
      this.advance();
      const inner = this.parseUnary();
      return { value: ~inner.value & 0xffff, offset: 0 };
    }

    // Handle negative -
    if (this.peek().type === 'MINUS') {
      this.advance();
      const inner = this.parseUnary();
      return { value: -inner.value, offset: 0 };
    }

    return this.parsePrimary();
  }

  private parsePrimary(): { value: number; label?: string; offset: number; lowByte?: boolean; highByte?: boolean } {
    // Parenthesized expression
    if (this.peek().type === 'LPAREN') {
      this.advance();
      const expr = this.parseExpression();
      this.expect('RPAREN', 'Expected )');
      return expr;
    }

    // Hex number with $
    if (this.peek().type === 'DOLLAR') {
      this.advance();
      const numToken = this.advance();
      return { value: parseInt(numToken.value, 16), offset: 0 };
    }

    // Number
    if (this.peek().type === 'NUMBER') {
      const numToken = this.advance();
      return { value: parseInt(numToken.value, 10), offset: 0 };
    }

    // Current PC (*)
    if (this.peek().type === 'STAR') {
      this.advance();
      return { value: this.pc, offset: 0 };
    }

    // Label reference
    if (this.peek().type === 'MNEMONIC') {
      const labelName = this.advance().value;
      const resolved = this.labels.get(labelName);
      if (resolved !== undefined) {
        return { value: resolved, offset: 0 };
      }
      return { value: 0, label: labelName, offset: 0 };
    }

    throw new Error(`Expected number or label on line ${this.peek().line}`);
  }

  private parseNumber(): number {
    const expr = this.parseExpression();
    return expr.value;
  }
}

// ============================================================================
// Code Generator
// ============================================================================

function getOpcode(mnemonic: string, suffix: string): number {
  const key = suffix ? `${mnemonic}_${suffix}` : mnemonic;
  const op = OPCODES[key as keyof typeof OPCODES];
  if (op === undefined) {
    throw new Error(`Unknown opcode: ${key}`);
  }
  return op;
}

function generate(
  instructions: Instruction[],
  labels: Map<string, number>,
  origin: number
): { bytes: Uint8Array; errors: AssemblerError[] } {
  const bytes: number[] = [];
  const errors: AssemblerError[] = [];
  let pc = origin;

  for (const inst of instructions) {
    const { mnemonic, mode, operand, label, offset, lowByte, highByte, location } = inst;

    try {
      // Resolve label to address (with optional offset)
      let addr = operand;
      if (label !== undefined) {
        const labelAddr = labels.get(label);
        if (labelAddr === undefined) {
          errors.push({ message: `Undefined label: ${label}`, location });
          addr = 0;
        } else {
          let fullAddr = labelAddr + (offset || 0);
          if (lowByte) {
            addr = fullAddr & 0xff;
          } else if (highByte) {
            addr = (fullAddr >> 8) & 0xff;
          } else {
            addr = fullAddr;
          }
        }
      }

      switch (mode) {
        case 'implied':
          bytes.push(getOpcode(mnemonic, ''));
          pc += 1;
          break;

        case 'accumulator':
          bytes.push(getOpcode(mnemonic, 'A'));
          pc += 1;
          break;

        case 'immediate':
          bytes.push(getOpcode(mnemonic, ''), addr! & 0xff);
          pc += 2;
          break;

        case 'zeropage': {
          let op: number;
          try {
            op = getOpcode(mnemonic, 'ZP');
          } catch {
            op = getOpcode(mnemonic, '');
          }
          bytes.push(op, addr! & 0xff);
          pc += 2;
          break;
        }

        case 'zeropage_x':
          bytes.push(getOpcode(mnemonic, 'ZPX'), addr! & 0xff);
          pc += 2;
          break;

        case 'zeropage_y':
          bytes.push(getOpcode(mnemonic, 'ZPY'), addr! & 0xff);
          pc += 2;
          break;

        case 'absolute': {
          let op: number;
          try {
            op = getOpcode(mnemonic, 'ABS');
          } catch {
            op = getOpcode(mnemonic, '');
          }
          bytes.push(op, addr! & 0xff, (addr! >> 8) & 0xff);
          pc += 3;
          break;
        }

        case 'absolute_x':
          bytes.push(getOpcode(mnemonic, 'ABS_X'), addr! & 0xff, (addr! >> 8) & 0xff);
          pc += 3;
          break;

        case 'absolute_y':
          bytes.push(getOpcode(mnemonic, 'ABS_Y'), addr! & 0xff, (addr! >> 8) & 0xff);
          pc += 3;
          break;

        case 'indirect':
          bytes.push(getOpcode(mnemonic, 'IND'), addr! & 0xff, (addr! >> 8) & 0xff);
          pc += 3;
          break;

        case 'indirect_x':
          bytes.push(getOpcode(mnemonic, 'IND_X'), addr! & 0xff);
          pc += 2;
          break;

        case 'indirect_y':
          bytes.push(getOpcode(mnemonic, 'IND_Y'), addr! & 0xff);
          pc += 2;
          break;

        case 'relative': {
          const op = getOpcode(mnemonic, '');
          const target = addr!;
          const relOffset = target - (pc + 2);
          if (relOffset < -128 || relOffset > 127) {
            errors.push({
              message: `Branch target out of range: ${relOffset} (${mnemonic} at $${pc.toString(16).toUpperCase()} to ${label || '$' + target.toString(16).toUpperCase()})`,
              location,
            });
            bytes.push(op, 0);
          } else {
            bytes.push(op, relOffset & 0xff);
          }
          pc += 2;
          break;
        }

        case 'data': {
          const byte = label !== undefined ? addr! : operand!;
          bytes.push(byte & 0xff);
          pc += 1;
          break;
        }
      }
    } catch (e) {
      errors.push({
        message: e instanceof Error ? e.message : String(e),
        location,
      });
    }
  }

  return { bytes: new Uint8Array(bytes), errors };
}

// ============================================================================
// Main Assembler Function
// ============================================================================

export function assemble(source: string, options: AssemblerOptions = {}): AssemblerOutput {
  // Phase 1: Preprocessing (macros, includes, conditionals)
  const preprocessor = new Preprocessor(options);
  const preprocessed = preprocessor.process(source);

  // Phase 2: Tokenization
  const tokenizer = new Tokenizer(preprocessed);
  const tokens = tokenizer.tokenize();

  // Phase 3: Parsing
  const parser = new Parser();
  const { instructions, labels, origin, errors: parseErrors, warnings } = parser.parse(tokens);

  // Phase 4: Code generation
  const { bytes, errors: genErrors } = generate(instructions, labels, origin);

  // Combine all errors
  const allErrors = [
    ...preprocessor.getErrors(),
    ...parseErrors,
    ...genErrors,
  ];

  const allWarnings = [
    ...preprocessor.getWarnings(),
    ...warnings,
  ];

  return { bytes, labels, origin, errors: allErrors, warnings: allWarnings };
}

// ============================================================================
// Helper Functions
// ============================================================================

export function createRomImage(code: Uint8Array, origin: number = 0x0200): Uint8Array {
  const romSize = 0x8000; // 32KB ROM
  const rom = new Uint8Array(romSize);

  const romOffset = origin >= 0x8000 ? origin - 0x8000 : origin;
  for (let i = 0; i < code.length; i++) {
    rom[romOffset + i] = code[i];
  }

  // Set reset vector at 0xFFFC-0xFFFD
  rom[0x7FFC] = origin & 0xff;
  rom[0x7FFD] = (origin >> 8) & 0xff;

  return rom;
}

// ============================================================================
// Example Programs
// ============================================================================

export const MACRO_EXAMPLE = `
; Stage 1 Assembler - Macro Example
; Demonstrates macro definition and usage

.ORG $8000

; Define a macro to print a character
.MACRO PRINT_CHAR char
  LDA #\\char
  JSR PUTCHAR
.ENDM

; Define a macro with local labels
.MACRO DELAY count
  LDX #\\count
@LOOP:
  DEX
  BNE @LOOP
.ENDM

; Constants
PUTCHAR = $F000
SERIAL  = $D000

START:
  ; Use macros
  PRINT_CHAR $48    ; 'H'
  PRINT_CHAR $49    ; 'I'

  ; Use delay macro twice (local labels are unique)
  DELAY $10
  DELAY $20

  HLT

; Putchar routine
PUTCHAR_ROUTINE:
  STA SERIAL
  RTS
`;

export const CONDITIONAL_EXAMPLE = `
; Stage 1 Assembler - Conditional Assembly Example

.ORG $8000

; Define debug mode
.DEFINE DEBUG 1

START:
  LDA #$42

.IF DEBUG
  ; This code only included if DEBUG is defined
  JSR DEBUG_PRINT
.ELSE
  ; This code included if DEBUG is not defined
  NOP
.ENDIF

  HLT

.IFDEF DEBUG
DEBUG_PRINT:
  STA $D000
  RTS
.ENDIF
`;

export const REPEAT_EXAMPLE = `
; Stage 1 Assembler - Repeat Block Example

.ORG $8000

; Create a table of 8 NOP instructions
TABLE:
.REPEAT 8
  NOP
.ENDR

; Create initialized data
DATA:
.REPEAT 4
  .DB $FF
.ENDR

  HLT
`;

export const EXPRESSION_EXAMPLE = `
; Stage 1 Assembler - Expression Example

.ORG $8000

; Constants
BASE   = $1000
OFFSET = $0010

; Using expressions
START:
  LDA #BASE & $FF         ; Low byte of BASE
  LDX #(BASE >> 8) & $FF  ; High byte of BASE
  LDY #BASE + OFFSET      ; Addition

  ; Bitwise operations
  LDA #$F0 | $0F          ; OR: $FF
  LDA #$FF & $0F          ; AND: $0F
  LDA #$AA ^ $55          ; XOR: $FF
  LDA #~$00 & $FF         ; NOT: $FF

  ; Shifts
  LDA #$01 << 4           ; Left shift: $10
  LDA #$80 >> 4           ; Right shift: $08

  HLT
`;
