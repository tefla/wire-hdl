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
  'AND': 0x29,
  'ORA': 0x09,
  'EOR': 0x49,

  // Absolute mode (3 bytes: opcode + lo + hi)
  'LDA_ABS': 0xAD,
  'LDX_ABS': 0xAE,
  'LDY_ABS': 0xAC,
  'STA': 0x8D,
  'STX': 0x8E,
  'STY': 0x8C,
  'JMP': 0x4C,
  'JSR': 0x20,

  // Relative mode (2 bytes: opcode + signed offset)
  'BEQ': 0xF0,
  'BNE': 0xD0,

  // Implied mode (1 byte: opcode only)
  'INX': 0xE8,
  'DEX': 0xCA,
  'INY': 0xC8,
  'DEY': 0x88,
  'TAX': 0xAA,
  'TAY': 0xA8,
  'TXA': 0x8A,
  'TYA': 0x98,
  'PHA': 0x48,
  'PLA': 0x68,
  'RTS': 0x60,
  'TXS': 0x9A,
  'CLC': 0x18,
  'SEC': 0x38,
  'HLT': 0x02,
} as const;

// Token types
type TokenType = 'LABEL' | 'MNEMONIC' | 'NUMBER' | 'COMMA' | 'HASH' | 'DOLLAR' | 'NEWLINE' | 'EOF';

interface Token {
  type: TokenType;
  value: string;
  line: number;
}

interface Instruction {
  mnemonic: string;
  mode: 'immediate' | 'absolute' | 'relative' | 'implied';
  operand?: number;
  label?: string;
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

// Parser
function parse(tokens: Token[]): { instructions: Instruction[]; labels: Map<string, number>; origin: number } {
  const instructions: Instruction[] = [];
  const labels = new Map<string, number>();
  let origin = 0x0200; // Default origin
  let pc = origin;
  let i = 0;

  function peek(): Token {
    return tokens[i] || { type: 'EOF', value: '', line: -1 };
  }

  function advance(): Token {
    return tokens[i++] || { type: 'EOF', value: '', line: -1 };
  }

  function skipNewlines() {
    while (peek().type === 'NEWLINE') advance();
  }

  while (i < tokens.length && peek().type !== 'EOF') {
    skipNewlines();
    if (peek().type === 'EOF') break;

    const token = advance();

    // Handle .ORG directive
    if (token.value === 'ORG' || token.value === '.ORG') {
      if (peek().type === 'DOLLAR') advance();
      const numToken = advance();
      origin = parseInt(numToken.value, 16);
      pc = origin;
      continue;
    }

    // Label definition
    if (token.type === 'LABEL') {
      labels.set(token.value, pc);
      continue;
    }

    // Mnemonic
    if (token.type === 'MNEMONIC') {
      const mnemonic = token.value;

      // Implied mode (no operand)
      const impliedOps = ['INX', 'DEX', 'INY', 'DEY', 'TAX', 'TAY', 'TXA', 'TYA', 'PHA', 'PLA', 'RTS', 'TXS', 'CLC', 'SEC', 'HLT'];
      if (impliedOps.includes(mnemonic)) {
        instructions.push({ mnemonic, mode: 'implied' });
        pc += 1;
        continue;
      }

      // Immediate mode: LDA #$xx
      if (peek().type === 'HASH') {
        advance(); // skip #
        if (peek().type === 'DOLLAR') advance(); // skip $
        const numToken = advance();
        const operand = parseInt(numToken.value, 16);
        instructions.push({ mnemonic, mode: 'immediate', operand });
        pc += 2;
        continue;
      }

      // Absolute or relative mode
      if (peek().type === 'DOLLAR') {
        advance(); // skip $
        const numToken = advance();
        const operand = parseInt(numToken.value, 16);

        // Relative mode for branches
        if (mnemonic === 'BEQ' || mnemonic === 'BNE') {
          instructions.push({ mnemonic, mode: 'relative', operand });
        } else {
          instructions.push({ mnemonic, mode: 'absolute', operand });
        }
        pc += (mnemonic === 'BEQ' || mnemonic === 'BNE') ? 2 : 3;
        continue;
      }

      // Label reference
      if (peek().type === 'MNEMONIC') {
        const labelName = advance().value;
        if (mnemonic === 'BEQ' || mnemonic === 'BNE') {
          instructions.push({ mnemonic, mode: 'relative', label: labelName });
          pc += 2;
        } else {
          instructions.push({ mnemonic, mode: 'absolute', label: labelName });
          pc += 3;
        }
        continue;
      }

      throw new Error(`Unexpected token after ${mnemonic}: ${peek().value} on line ${peek().line}`);
    }
  }

  return { instructions, labels, origin };
}

// Code generator
function generate(instructions: Instruction[], labels: Map<string, number>, origin: number): Uint8Array {
  const bytes: number[] = [];
  let pc = origin;

  for (const inst of instructions) {
    const { mnemonic, mode, operand, label } = inst;

    // Resolve label to address
    let addr = operand;
    if (label !== undefined) {
      addr = labels.get(label);
      if (addr === undefined) {
        throw new Error(`Undefined label: ${label}`);
      }
    }

    switch (mode) {
      case 'implied': {
        const op = OPCODES[mnemonic as keyof typeof OPCODES];
        if (op === undefined) throw new Error(`Unknown mnemonic: ${mnemonic}`);
        bytes.push(op);
        pc += 1;
        break;
      }

      case 'immediate': {
        const op = OPCODES[mnemonic as keyof typeof OPCODES];
        if (op === undefined) throw new Error(`Unknown mnemonic: ${mnemonic}`);
        bytes.push(op, addr! & 0xFF);
        pc += 2;
        break;
      }

      case 'absolute': {
        // Check for absolute addressing variants
        let op: number;
        if (mnemonic === 'LDA' || mnemonic === 'LDX' || mnemonic === 'LDY') {
          // Use absolute variant if operand is >= 256 or force absolute mode
          op = OPCODES[(mnemonic + '_ABS') as keyof typeof OPCODES];
        } else {
          op = OPCODES[mnemonic as keyof typeof OPCODES];
        }
        if (op === undefined) throw new Error(`Unknown mnemonic: ${mnemonic}`);
        bytes.push(op, addr! & 0xFF, (addr! >> 8) & 0xFF);
        pc += 3;
        break;
      }

      case 'relative': {
        const op = OPCODES[mnemonic as keyof typeof OPCODES];
        if (op === undefined) throw new Error(`Unknown mnemonic: ${mnemonic}`);
        // Calculate relative offset: target - (pc + 2)
        const target = addr!;
        const offset = target - (pc + 2);
        if (offset < -128 || offset > 127) {
          throw new Error(`Branch target out of range: ${offset}`);
        }
        bytes.push(op, offset & 0xFF);
        pc += 2;
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
