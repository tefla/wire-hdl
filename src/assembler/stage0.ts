// Stage 0 Assembler for wire-hdl CPU
// This is a minimal JavaScript assembler that generates machine code
// for the wire-hdl 6502-inspired CPU.

// Opcode table
export const OPCODES = {
  // Immediate mode (2 bytes: opcode + immediate)
  'LDA': 0xA9,
  'LDX': 0xA2,
  'LDY': 0xA0,
  'ADC': 0x69,
  'SBC': 0xE9,
  'CMP': 0xC9,
  'CPX': 0xE0,
  'CPY': 0xC0,
  'AND': 0x29,
  'ORA': 0x09,
  'EOR': 0x49,

  // Zero page mode (2 bytes: opcode + zero page address)
  'LDA_ZP': 0xA5,
  'LDX_ZP': 0xA6,
  'LDY_ZP': 0xA4,
  'STA_ZP': 0x85,
  'STX_ZP': 0x86,
  'STY_ZP': 0x84,
  'ADC_ZP': 0x65,
  'SBC_ZP': 0xE5,
  'CMP_ZP': 0xC5,
  'AND_ZP': 0x25,
  'ORA_ZP': 0x05,
  'EOR_ZP': 0x45,
  'INC_ZP': 0xE6,
  'DEC_ZP': 0xC6,

  // Zero page,X mode (2 bytes: opcode + zero page address)
  'LDA_ZPX': 0xB5,
  'LDY_ZPX': 0xB4,
  'STA_ZPX': 0x95,
  'STY_ZPX': 0x94,
  'ADC_ZPX': 0x75,
  'SBC_ZPX': 0xF5,
  'CMP_ZPX': 0xD5,
  'AND_ZPX': 0x35,
  'ORA_ZPX': 0x15,
  'EOR_ZPX': 0x55,
  'INC_ZPX': 0xF6,
  'DEC_ZPX': 0xD6,

  // Zero page,Y mode (2 bytes)
  'LDX_ZPY': 0xB6,
  'STX_ZPY': 0x96,

  // Indirect indexed mode (zp),Y (2 bytes: opcode + zero page address)
  'LDA_IND_Y': 0xB1,
  'STA_IND_Y': 0x91,
  'ADC_IND_Y': 0x71,
  'SBC_IND_Y': 0xF1,
  'CMP_IND_Y': 0xD1,
  'AND_IND_Y': 0x31,
  'ORA_IND_Y': 0x11,
  'EOR_IND_Y': 0x51,

  // Indexed indirect mode (zp,X) (2 bytes: opcode + zero page address)
  'LDA_IND_X': 0xA1,
  'STA_IND_X': 0x81,
  'ADC_IND_X': 0x61,
  'SBC_IND_X': 0xE1,
  'CMP_IND_X': 0xC1,
  'AND_IND_X': 0x21,
  'ORA_IND_X': 0x01,
  'EOR_IND_X': 0x41,

  // Absolute mode (3 bytes: opcode + lo + hi)
  'LDA_ABS': 0xAD,
  'LDX_ABS': 0xAE,
  'LDY_ABS': 0xAC,
  'STA': 0x8D,
  'STX': 0x8E,
  'STY': 0x8C,
  'ADC_ABS': 0x6D,
  'SBC_ABS': 0xED,
  'CMP_ABS': 0xCD,
  'CPX_ABS': 0xEC,
  'CPY_ABS': 0xCC,
  'AND_ABS': 0x2D,
  'ORA_ABS': 0x0D,
  'EOR_ABS': 0x4D,
  'JMP': 0x4C,
  'JSR': 0x20,
  'INC_ABS': 0xEE,
  'DEC_ABS': 0xCE,

  // Absolute,X mode (3 bytes)
  'LDA_ABS_X': 0xBD,
  'LDY_ABS_X': 0xBC,
  'STA_ABS_X': 0x9D,
  'ADC_ABS_X': 0x7D,
  'SBC_ABS_X': 0xFD,
  'CMP_ABS_X': 0xDD,
  'AND_ABS_X': 0x3D,
  'ORA_ABS_X': 0x1D,
  'EOR_ABS_X': 0x5D,
  'INC_ABS_X': 0xFE,
  'DEC_ABS_X': 0xDE,

  // Absolute,Y mode (3 bytes)
  'LDA_ABS_Y': 0xB9,
  'LDX_ABS_Y': 0xBE,
  'STA_ABS_Y': 0x99,
  'ADC_ABS_Y': 0x79,
  'SBC_ABS_Y': 0xF9,
  'CMP_ABS_Y': 0xD9,
  'AND_ABS_Y': 0x39,
  'ORA_ABS_Y': 0x19,
  'EOR_ABS_Y': 0x59,

  // Indirect mode (3 bytes: opcode + lo + hi) - for JMP only
  'JMP_IND': 0x6C,

  // Relative mode (2 bytes: opcode + signed offset)
  'BEQ': 0xF0,
  'BNE': 0xD0,
  'BCC': 0x90,
  'BCS': 0xB0,
  'BPL': 0x10,
  'BMI': 0x30,
  'BVC': 0x50,
  'BVS': 0x70,

  // Implied mode (1 byte: opcode only)
  'INX': 0xE8,
  'DEX': 0xCA,
  'INY': 0xC8,
  'DEY': 0x88,
  'TAX': 0xAA,
  'TAY': 0xA8,
  'TXA': 0x8A,
  'TYA': 0x98,
  'TSX': 0xBA,
  'TXS': 0x9A,
  'PHA': 0x48,
  'PLA': 0x68,
  'PHP': 0x08,
  'PLP': 0x28,
  'RTS': 0x60,
  'RTI': 0x40,
  'CLC': 0x18,
  'SEC': 0x38,
  'CLI': 0x58,
  'SEI': 0x78,
  'CLV': 0xB8,
  'CLD': 0xD8,
  'SED': 0xF8,
  'NOP': 0xEA,
  'BRK': 0x00,
  'HLT': 0x02,

  // Accumulator mode (1 byte: opcode only)
  'ASL_A': 0x0A,
  'LSR_A': 0x4A,
  'ROL_A': 0x2A,
  'ROR_A': 0x6A,

  // ASL/LSR/ROL/ROR with zero page
  'ASL_ZP': 0x06,
  'LSR_ZP': 0x46,
  'ROL_ZP': 0x26,
  'ROR_ZP': 0x66,

  // ASL/LSR/ROL/ROR with absolute
  'ASL_ABS': 0x0E,
  'LSR_ABS': 0x4E,
  'ROL_ABS': 0x2E,
  'ROR_ABS': 0x6E,

  // BIT instruction
  'BIT_ZP': 0x24,
  'BIT_ABS': 0x2C,
} as const;

// Token types
type TokenType = 'LABEL' | 'MNEMONIC' | 'NUMBER' | 'COMMA' | 'HASH' | 'DOLLAR' | 'LPAREN' | 'RPAREN' | 'EQUALS' | 'DOT' | 'PLUS' | 'MINUS' | 'LESS' | 'GREATER' | 'NEWLINE' | 'EOF';

interface Token {
  type: TokenType;
  value: string;
  line: number;
}

type AddressingMode =
  | 'immediate'     // #$xx
  | 'absolute'      // $xxxx
  | 'absolute_x'    // $xxxx,X
  | 'absolute_y'    // $xxxx,Y
  | 'zeropage'      // $xx
  | 'zeropage_x'    // $xx,X
  | 'zeropage_y'    // $xx,Y
  | 'indirect'      // ($xxxx)
  | 'indirect_x'    // ($xx,X)
  | 'indirect_y'    // ($xx),Y
  | 'relative'      // label or $xxxx (for branches)
  | 'implied'       // no operand
  | 'accumulator'   // A (for ASL, LSR, ROL, ROR)
  | 'data';         // .DB data byte

interface Instruction {
  mnemonic: string;
  mode: AddressingMode;
  operand?: number;
  label?: string;
  offset?: number; // For label+offset expressions
  lowByte?: boolean;  // Extract low byte of address (<label)
  highByte?: boolean; // Extract high byte of address (>label)
}

export interface AssemblerOutput {
  bytes: Uint8Array;
  labels: Map<string, number>;
  origin: number;
}

// Tokenizer
function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let line = 1;
  let i = 0;

  while (i < source.length) {
    const ch = source[i];

    // Skip whitespace (but not newlines)
    if (ch === ' ' || ch === '\t') {
      i++;
      continue;
    }

    // Skip comments
    if (ch === ';') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }

    // Newline
    if (ch === '\n') {
      tokens.push({ type: 'NEWLINE', value: '', line });
      line++;
      i++;
      continue;
    }

    // Hash (immediate mode indicator)
    if (ch === '#') {
      tokens.push({ type: 'HASH', value: '#', line });
      i++;
      continue;
    }

    // Dollar (hex indicator)
    if (ch === '$') {
      tokens.push({ type: 'DOLLAR', value: '$', line });
      i++;
      continue;
    }

    // Comma
    if (ch === ',') {
      tokens.push({ type: 'COMMA', value: ',', line });
      i++;
      continue;
    }

    // Parentheses (for indirect addressing)
    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(', line });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')', line });
      i++;
      continue;
    }

    // Equals sign (for EQU)
    if (ch === '=') {
      tokens.push({ type: 'EQUALS', value: '=', line });
      i++;
      continue;
    }

    // Dot (for directives)
    if (ch === '.') {
      tokens.push({ type: 'DOT', value: '.', line });
      i++;
      continue;
    }

    // Plus (for arithmetic)
    if (ch === '+') {
      tokens.push({ type: 'PLUS', value: '+', line });
      i++;
      continue;
    }

    // Minus (for arithmetic)
    if (ch === '-') {
      tokens.push({ type: 'MINUS', value: '-', line });
      i++;
      continue;
    }

    // Less than (low byte operator)
    if (ch === '<') {
      tokens.push({ type: 'LESS', value: '<', line });
      i++;
      continue;
    }

    // Greater than (high byte operator)
    if (ch === '>') {
      tokens.push({ type: 'GREATER', value: '>', line });
      i++;
      continue;
    }

    // Character literal 'x'
    if (ch === "'") {
      i++; // skip opening quote
      const char = source[i];
      i++; // skip character
      if (source[i] === "'") {
        i++; // skip closing quote
      }
      tokens.push({ type: 'NUMBER', value: char.charCodeAt(0).toString(), line });
      continue;
    }

    // String literal "xxx" - emit as sequence of NUMBER tokens with COMMA between
    if (ch === '"') {
      i++; // skip opening quote
      let first = true;
      while (i < source.length && source[i] !== '"') {
        if (!first) {
          tokens.push({ type: 'COMMA', value: ',', line });
        }
        const charCode = source.charCodeAt(i);
        tokens.push({ type: 'NUMBER', value: charCode.toString(), line });
        first = false;
        i++;
      }
      if (source[i] === '"') {
        i++; // skip closing quote
      }
      continue;
    }

    // Colon (label marker)
    if (ch === ':') {
      // Mark previous identifier as a label
      if (tokens.length > 0 && tokens[tokens.length - 1].type === 'MNEMONIC') {
        tokens[tokens.length - 1].type = 'LABEL';
      }
      i++;
      continue;
    }

    // Number (decimal or hex after $)
    if (ch >= '0' && ch <= '9') {
      let num = '';
      while (i < source.length && /[0-9A-Fa-f]/.test(source[i])) {
        num += source[i++];
      }
      tokens.push({ type: 'NUMBER', value: num, line });
      continue;
    }

    // Identifier (label or mnemonic)
    if (/[A-Za-z_]/.test(ch)) {
      let ident = '';
      while (i < source.length && /[A-Za-z0-9_]/.test(source[i])) {
        ident += source[i++];
      }
      tokens.push({ type: 'MNEMONIC', value: ident.toUpperCase(), line });
      continue;
    }

    // Unknown character - skip
    i++;
  }

  tokens.push({ type: 'EOF', value: '', line });
  return tokens;
}

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

// Calculate instruction size
function getInstructionSize(mode: AddressingMode): number {
  switch (mode) {
    case 'implied':
    case 'accumulator':
      return 1;
    case 'immediate':
    case 'zeropage':
    case 'zeropage_x':
    case 'zeropage_y':
    case 'indirect_x':
    case 'indirect_y':
    case 'relative':
      return 2;
    case 'absolute':
    case 'absolute_x':
    case 'absolute_y':
    case 'indirect':
      return 3;
    default:
      return 1;
  }
}

// Keep function to avoid unused warning
void getInstructionSize;

// Parser
function parse(tokens: Token[]): { instructions: Instruction[]; labels: Map<string, number>; origin: number } {
  const instructions: Instruction[] = [];
  const labels = new Map<string, number>();
  let origin = 0x0200; // Default origin
  let pc = origin;
  let i = 0;

  function peek(offset = 0): Token {
    return tokens[i + offset] || { type: 'EOF', value: '', line: -1 };
  }

  function advance(): Token {
    return tokens[i++] || { type: 'EOF', value: '', line: -1 };
  }

  function skipNewlines() {
    while (peek().type === 'NEWLINE') advance();
  }

  function expect(type: TokenType, msg: string): Token {
    const tok = advance();
    if (tok.type !== type) {
      throw new Error(`${msg}: expected ${type}, got ${tok.type} (${tok.value}) on line ${tok.line}`);
    }
    return tok;
  }

  // Parse a primary value (number or label reference)
  function parsePrimary(): { value: number; label?: string; lowByte?: boolean; highByte?: boolean } {
    // Handle low byte operator <
    if (peek().type === 'LESS') {
      advance(); // skip <
      const inner = parsePrimary();
      const resolved = inner.label ? labels.get(inner.label) : inner.value;
      if (resolved !== undefined) {
        return { value: resolved & 0xff };
      }
      // Forward reference - mark for low byte extraction
      return { value: 0, label: inner.label, lowByte: true };
    }
    // Handle high byte operator >
    if (peek().type === 'GREATER') {
      advance(); // skip >
      const inner = parsePrimary();
      const resolved = inner.label ? labels.get(inner.label) : inner.value;
      if (resolved !== undefined) {
        return { value: (resolved >> 8) & 0xff };
      }
      // Forward reference - mark for high byte extraction
      return { value: 0, label: inner.label, highByte: true };
    }
    if (peek().type === 'DOLLAR') {
      advance(); // skip $
      return { value: parseInt(advance().value, 16) };
    }
    if (peek().type === 'NUMBER') {
      return { value: parseInt(advance().value, 10) };
    }
    if (peek().type === 'MNEMONIC') {
      // Label reference - resolve later
      const labelName = advance().value;
      const resolved = labels.get(labelName);
      if (resolved !== undefined) {
        return { value: resolved };
      }
      // Return 0 for now, will be resolved in code generation
      return { value: 0, label: labelName };
    }
    throw new Error(`Expected number or label on line ${peek().line}`);
  }

  // Parse an expression: value +/- value
  function parseExpression(): { value: number; label?: string; offset: number; lowByte?: boolean; highByte?: boolean } {
    const primary = parsePrimary();
    let offset = 0;

    // Check for + or - operators
    while (peek().type === 'PLUS' || peek().type === 'MINUS') {
      const op = advance().type;
      const next = parsePrimary();
      if (op === 'PLUS') {
        offset += next.value;
      } else {
        offset -= next.value;
      }
    }

    return { value: primary.value + offset, label: primary.label, offset, lowByte: primary.lowByte, highByte: primary.highByte };
  }

  function parseNumber(): number {
    const expr = parseExpression();
    return expr.value;
  }

  while (i < tokens.length && peek().type !== 'EOF') {
    skipNewlines();
    if (peek().type === 'EOF') break;

    const token = advance();

    // Handle .ORG directive
    if (token.value === 'ORG' || token.value === '.ORG') {
      origin = parseNumber();
      pc = origin;
      continue;
    }

    // Handle .DB directive (define bytes)
    if (token.value === 'DB' || token.value === '.DB') {
      // Parse comma-separated byte values
      while (true) {
        const value = parseNumber();
        instructions.push({ mnemonic: '.DB', mode: 'data', operand: value & 0xff });
        pc += 1;

        // Check for comma to continue
        if (peek().type === 'COMMA') {
          advance(); // skip comma
        } else {
          break;
        }
      }
      continue;
    }

    // Handle . prefix for directives
    if (token.type === 'DOT') {
      const directive = advance().value;
      if (directive === 'ORG') {
        origin = parseNumber();
        pc = origin;
      } else if (directive === 'DB' || directive === 'BYTE') {
        // Parse comma-separated byte values
        while (true) {
          const value = parseNumber();
          instructions.push({ mnemonic: '.DB', mode: 'data', operand: value & 0xff });
          pc += 1;
          if (peek().type === 'COMMA') {
            advance();
          } else {
            break;
          }
        }
      } else if (directive === 'DW' || directive === 'WORD') {
        // Parse comma-separated word values (little-endian)
        while (true) {
          const expr = parseExpression();
          // Low byte first - preserve label for forward reference resolution
          instructions.push({ mnemonic: '.DB', mode: 'data', operand: expr.value & 0xff, label: expr.label, lowByte: true });
          pc += 1;
          // High byte second - preserve label for forward reference resolution
          instructions.push({ mnemonic: '.DB', mode: 'data', operand: (expr.value >> 8) & 0xff, label: expr.label, highByte: true });
          pc += 1;
          if (peek().type === 'COMMA') {
            advance();
          } else {
            break;
          }
        }
      }
      continue;
    }

    // Label definition
    if (token.type === 'LABEL') {
      labels.set(token.value, pc);
      continue;
    }

    // Mnemonic (or EQU definition)
    if (token.type === 'MNEMONIC') {
      // Check for EQU: IDENT = VALUE
      if (peek().type === 'EQUALS') {
        advance(); // skip =
        const value = parseNumber();
        labels.set(token.value, value);
        continue;
      }
      const mnemonic = token.value;

      // Implied mode
      if (IMPLIED_OPS.includes(mnemonic)) {
        instructions.push({ mnemonic, mode: 'implied' });
        pc += 1;
        continue;
      }

      // Accumulator mode: ASL A, LSR A, etc.
      if (ACC_OPS.includes(mnemonic)) {
        if (peek().type === 'MNEMONIC' && peek().value === 'A') {
          advance(); // skip 'A'
          instructions.push({ mnemonic, mode: 'accumulator' });
          pc += 1;
          continue;
        }
        // Fall through to check other modes (zero page, absolute)
      }

      // Immediate mode: LDA #$xx or LDA #<label or LDA #>label
      if (peek().type === 'HASH') {
        advance(); // skip #
        const expr = parseExpression();
        instructions.push({
          mnemonic,
          mode: 'immediate',
          operand: expr.value,
          label: expr.label,
          offset: expr.offset,
          lowByte: expr.lowByte,
          highByte: expr.highByte
        });
        pc += 2;
        continue;
      }

      // Indirect modes: ($xx),Y or ($xx,X) or ($xxxx)
      if (peek().type === 'LPAREN') {
        advance(); // skip (
        const operand = parseNumber();

        if (peek().type === 'COMMA') {
          // Indexed indirect: ($xx,X)
          advance(); // skip ,
          const reg = advance().value; // X or Y
          expect('RPAREN', 'Expected )');
          if (reg === 'X') {
            instructions.push({ mnemonic, mode: 'indirect_x', operand });
            pc += 2;
          } else {
            throw new Error(`Invalid indexed indirect mode on line ${peek().line}`);
          }
        } else if (peek().type === 'RPAREN') {
          advance(); // skip )
          if (peek().type === 'COMMA') {
            // Indirect indexed: ($xx),Y
            advance(); // skip ,
            const reg = advance().value;
            if (reg === 'Y') {
              instructions.push({ mnemonic, mode: 'indirect_y', operand });
              pc += 2;
            } else {
              throw new Error(`Invalid indirect indexed mode on line ${peek().line}`);
            }
          } else {
            // Plain indirect: ($xxxx) - for JMP
            instructions.push({ mnemonic, mode: 'indirect', operand });
            pc += 3;
          }
        }
        continue;
      }

      // Direct addressing: $xx or $xxxx or $xx,X or $xxxx,X or $xx,Y or $xxxx,Y
      if (peek().type === 'DOLLAR') {
        const operand = parseNumber();
        const isZeroPage = operand <= 0xff;

        // Check for indexed mode: ,X or ,Y
        if (peek().type === 'COMMA') {
          advance(); // skip ,
          const reg = advance().value;

          if (reg === 'X') {
            if (isZeroPage) {
              instructions.push({ mnemonic, mode: 'zeropage_x', operand });
              pc += 2;
            } else {
              instructions.push({ mnemonic, mode: 'absolute_x', operand });
              pc += 3;
            }
          } else if (reg === 'Y') {
            if (isZeroPage) {
              instructions.push({ mnemonic, mode: 'zeropage_y', operand });
              pc += 2;
            } else {
              instructions.push({ mnemonic, mode: 'absolute_y', operand });
              pc += 3;
            }
          } else {
            throw new Error(`Invalid index register ${reg} on line ${peek().line}`);
          }
          continue;
        }

        // Branch instructions always use relative mode
        if (BRANCH_OPS.includes(mnemonic)) {
          instructions.push({ mnemonic, mode: 'relative', operand });
          pc += 2;
          continue;
        }

        // Zero page or absolute mode
        if (isZeroPage) {
          instructions.push({ mnemonic, mode: 'zeropage', operand });
          pc += 2;
        } else {
          instructions.push({ mnemonic, mode: 'absolute', operand });
          pc += 3;
        }
        continue;
      }

      // Label reference (with optional +/- offset)
      if (peek().type === 'MNEMONIC') {
        const expr = parseExpression();
        const labelName = expr.label;
        const offset = expr.offset || 0;

        // Check for indexed mode: ,X or ,Y
        if (peek().type === 'COMMA') {
          advance(); // skip ,
          const reg = advance().value;
          if (reg === 'X') {
            instructions.push({ mnemonic, mode: 'absolute_x', label: labelName, offset, operand: expr.value });
            pc += 3;
          } else if (reg === 'Y') {
            instructions.push({ mnemonic, mode: 'absolute_y', label: labelName, offset, operand: expr.value });
            pc += 3;
          } else {
            throw new Error(`Invalid index register ${reg} on line ${peek().line}`);
          }
          continue;
        }

        // Branch instructions use relative mode
        if (BRANCH_OPS.includes(mnemonic)) {
          instructions.push({ mnemonic, mode: 'relative', label: labelName, offset, operand: expr.value });
          pc += 2;
        } else {
          instructions.push({ mnemonic, mode: 'absolute', label: labelName, offset, operand: expr.value });
          pc += 3;
        }
        continue;
      }

      throw new Error(`Unexpected token after ${mnemonic}: ${peek().value} (${peek().type}) on line ${peek().line}`);
    }
  }

  return { instructions, labels, origin };
}

// Helper to get opcode with suffix
function getOpcode(mnemonic: string, suffix: string): number {
  const key = suffix ? `${mnemonic}_${suffix}` : mnemonic;
  const op = OPCODES[key as keyof typeof OPCODES];
  if (op === undefined) {
    throw new Error(`Unknown opcode: ${key}`);
  }
  return op;
}

// Code generator
function generate(instructions: Instruction[], labels: Map<string, number>, origin: number): Uint8Array {
  const bytes: number[] = [];
  let pc = origin;

  for (const inst of instructions) {
    const { mnemonic, mode, operand, label, offset, lowByte, highByte } = inst;

    // Resolve label to address (with optional offset)
    let addr = operand;
    if (label !== undefined) {
      const labelAddr = labels.get(label);
      if (labelAddr === undefined) {
        throw new Error(`Undefined label: ${label}`);
      }
      let fullAddr = labelAddr + (offset || 0);
      // Apply low/high byte extraction if specified
      if (lowByte) {
        addr = fullAddr & 0xff;
      } else if (highByte) {
        addr = (fullAddr >> 8) & 0xff;
      } else {
        addr = fullAddr;
      }
    }

    switch (mode) {
      case 'implied': {
        bytes.push(getOpcode(mnemonic, ''));
        pc += 1;
        break;
      }

      case 'accumulator': {
        bytes.push(getOpcode(mnemonic, 'A'));
        pc += 1;
        break;
      }

      case 'immediate': {
        bytes.push(getOpcode(mnemonic, ''), addr! & 0xFF);
        pc += 2;
        break;
      }

      case 'zeropage': {
        // Some instructions have specific zero page opcodes, others use the immediate opcode location
        let op: number;
        try {
          op = getOpcode(mnemonic, 'ZP');
        } catch {
          // For instructions like INC, DEC that don't have immediate mode
          op = getOpcode(mnemonic, '');
        }
        bytes.push(op, addr! & 0xFF);
        pc += 2;
        break;
      }

      case 'zeropage_x': {
        bytes.push(getOpcode(mnemonic, 'ZPX'), addr! & 0xFF);
        pc += 2;
        break;
      }

      case 'zeropage_y': {
        bytes.push(getOpcode(mnemonic, 'ZPY'), addr! & 0xFF);
        pc += 2;
        break;
      }

      case 'absolute': {
        // Check for absolute addressing variants (LDA, LDX, LDY have _ABS suffix)
        let op: number;
        try {
          op = getOpcode(mnemonic, 'ABS');
        } catch {
          op = getOpcode(mnemonic, '');
        }
        bytes.push(op, addr! & 0xFF, (addr! >> 8) & 0xFF);
        pc += 3;
        break;
      }

      case 'absolute_x': {
        bytes.push(getOpcode(mnemonic, 'ABS_X'), addr! & 0xFF, (addr! >> 8) & 0xFF);
        pc += 3;
        break;
      }

      case 'absolute_y': {
        bytes.push(getOpcode(mnemonic, 'ABS_Y'), addr! & 0xFF, (addr! >> 8) & 0xFF);
        pc += 3;
        break;
      }

      case 'indirect': {
        bytes.push(getOpcode(mnemonic, 'IND'), addr! & 0xFF, (addr! >> 8) & 0xFF);
        pc += 3;
        break;
      }

      case 'indirect_x': {
        bytes.push(getOpcode(mnemonic, 'IND_X'), addr! & 0xFF);
        pc += 2;
        break;
      }

      case 'indirect_y': {
        bytes.push(getOpcode(mnemonic, 'IND_Y'), addr! & 0xFF);
        pc += 2;
        break;
      }

      case 'relative': {
        const op = getOpcode(mnemonic, '');
        // Calculate relative offset: target - (pc + 2)
        const target = addr!;
        const offset = target - (pc + 2);
        if (offset < -128 || offset > 127) {
          throw new Error(`Branch target out of range: ${offset} (${mnemonic} at $${pc.toString(16).toUpperCase()} to ${label || '$' + target.toString(16).toUpperCase()})`);
        }
        bytes.push(op, offset & 0xFF);
        pc += 2;
        break;
      }

      case 'data': {
        // .DB directive - just output the byte
        // Use addr which has resolved label (with lowByte/highByte extraction), or fall back to operand
        const byte = (label !== undefined) ? addr! : operand!;
        bytes.push(byte & 0xFF);
        pc += 1;
        break;
      }
    }
  }

  return new Uint8Array(bytes);
}

// Main assembler function
export function assemble(source: string): AssemblerOutput {
  const tokens = tokenize(source);
  const { instructions, labels, origin } = parse(tokens);
  const bytes = generate(instructions, labels, origin);
  return { bytes, labels, origin };
}

// Helper to create ROM image with reset vector
export function createRomImage(code: Uint8Array, origin: number = 0x0200): Uint8Array {
  // Create a 64KB address space image (or just 32KB for ROM starting at 0x8000)
  const romSize = 0x8000; // 32KB ROM
  const rom = new Uint8Array(romSize);

  // Copy code to the correct location in ROM
  // ROM is mapped at 0x8000-0xFFFF, so origin 0x8000 = offset 0
  const romOffset = origin >= 0x8000 ? origin - 0x8000 : origin;
  for (let i = 0; i < code.length; i++) {
    rom[romOffset + i] = code[i];
  }

  // Set reset vector at 0xFFFC-0xFFFD (offset 0x7FFC-0x7FFD in ROM)
  // Points to origin address
  rom[0x7FFC] = origin & 0xFF;
  rom[0x7FFD] = (origin >> 8) & 0xFF;

  return rom;
}

// Example: Hello World program
export const HELLO_WORLD = `
; Hello World - write "HELLO" to serial output
; Serial output is memory-mapped at $D000

.ORG $8000

START:
  LDA #$48    ; 'H'
  STA $D000
  LDA #$45    ; 'E'
  STA $D000
  LDA #$4C    ; 'L'
  STA $D000
  LDA #$4C    ; 'L'
  STA $D000
  LDA #$4F    ; 'O'
  STA $D000
  HLT
`;

// Example: Counter program
export const COUNTER = `
; Counter - increment and display
; Video RAM starts at $8000 (in this config)

.ORG $8000

START:
  LDA #$00    ; Initialize counter
  TAX         ; Keep count in X
LOOP:
  TXA         ; Move count to A
  STA $D000   ; Output to serial
  INX         ; Increment
  JMP LOOP    ; Forever
`;
