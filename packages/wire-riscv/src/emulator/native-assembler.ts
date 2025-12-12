/**
 * Native RISC-V Assembler
 *
 * A simplified assembler that can run within the RISC-V emulator,
 * enabling self-hosting development.
 *
 * Supports:
 * - Basic RV32I instructions
 * - Labels (forward and backward)
 * - Directives (.byte, .word, .ascii, .asciiz, .space)
 * - Register aliases (x0-x31 and ABI names)
 * - Comments (; and #)
 */

import { RiscVCpu } from './cpu.js';
import { WireFS } from './filesystem.js';

/** Syscall numbers for assembler operations */
export const NATIVE_ASM_SYSCALLS = {
  ASM_INIT: 100,
  ASM_LINE: 101,
  ASM_FINISH: 102,
} as const;

/**
 * Assembler error class
 */
export class AssemblerError extends Error {
  constructor(
    message: string,
    public line?: number,
    public source?: string
  ) {
    super(line !== undefined ? `Line ${line}: ${message}` : message);
    this.name = 'AssemblerError';
  }
}

/**
 * Register name mapping
 */
const REGISTERS: Record<string, number> = {
  // Numeric names
  x0: 0, x1: 1, x2: 2, x3: 3, x4: 4, x5: 5, x6: 6, x7: 7,
  x8: 8, x9: 9, x10: 10, x11: 11, x12: 12, x13: 13, x14: 14, x15: 15,
  x16: 16, x17: 17, x18: 18, x19: 19, x20: 20, x21: 21, x22: 22, x23: 23,
  x24: 24, x25: 25, x26: 26, x27: 27, x28: 28, x29: 29, x30: 30, x31: 31,
  // ABI names
  zero: 0, ra: 1, sp: 2, gp: 3, tp: 4,
  t0: 5, t1: 6, t2: 7,
  s0: 8, fp: 8, s1: 9,
  a0: 10, a1: 11, a2: 12, a3: 13, a4: 14, a5: 15, a6: 16, a7: 17,
  s2: 18, s3: 19, s4: 20, s5: 21, s6: 22, s7: 23, s8: 24, s9: 25, s10: 26, s11: 27,
  t3: 28, t4: 29, t5: 30, t6: 31,
};

/**
 * Native RISC-V Assembler
 */
interface MacroDefinition {
  name: string;
  params: string[];
  body: string[];
}

export class NativeAssembler {
  private labels: Map<string, number> = new Map();
  private constants: Map<string, number> = new Map();
  private macros: Map<string, MacroDefinition> = new Map();
  private pendingLabels: Array<{ offset: number; label: string; type: 'J' | 'B'; line: number }> = [];
  private output: number[] = [];
  private textOutput: number[] = [];
  private dataOutput: number[] = [];
  private currentSection: 'text' | 'data' = 'text';
  private firstSection: 'text' | 'data' | null = null;
  private currentLine: number = 0;
  private sourceLines: string[] = [];

  constructor(
    private cpu?: RiscVCpu,
    private fs?: WireFS
  ) {}

  /**
   * Assemble source code to binary
   */
  assemble(source: string): Uint8Array {
    this.labels.clear();
    this.constants.clear();
    this.macros.clear();
    this.pendingLabels = [];
    this.output = [];
    this.textOutput = [];
    this.dataOutput = [];
    this.currentSection = 'text';
    this.firstSection = null;
    this.currentLine = 0;

    this.sourceLines = source.split('\n');

    // Preprocessing: expand macros
    const expandedLines = this.expandMacros(this.sourceLines);
    this.sourceLines = expandedLines;

    // First pass: collect labels and emit code
    for (let i = 0; i < this.sourceLines.length; i++) {
      this.currentLine = i + 1;
      this.processLine(this.sourceLines[i]);
    }

    // Concatenate sections in source order (default: text first)
    if (this.firstSection === 'data') {
      this.output = [...this.dataOutput, ...this.textOutput];
    } else {
      // text first (or no sections defined)
      this.output = [...this.textOutput, ...this.dataOutput];
    }

    // Second pass: resolve pending labels
    for (const pending of this.pendingLabels) {
      const targetAddr = this.labels.get(pending.label);
      if (targetAddr === undefined) {
        throw new AssemblerError(`Undefined label: ${pending.label}`, pending.line);
      }

      const offset = targetAddr - pending.offset;
      this.patchBranch(pending.offset, offset, pending.type);
    }

    return new Uint8Array(this.output);
  }

  /**
   * Assemble from filesystem
   */
  assembleFile(name: string, extension: string): Uint8Array | null {
    if (!this.fs) {
      throw new AssemblerError('No filesystem available');
    }

    const data = this.fs.readFile(name, extension);
    if (!data) {
      return null;
    }

    const source = new TextDecoder().decode(data);
    return this.assemble(source);
  }

  /**
   * Assemble and write to filesystem
   */
  assembleToFile(source: string, name: string, extension: string): boolean {
    if (!this.fs) {
      throw new AssemblerError('No filesystem available');
    }

    const binary = this.assemble(source);
    this.fs.createFile(name, extension);
    return this.fs.writeFile(name, extension, binary);
  }

  /**
   * Create an error with context
   */
  private error(message: string): AssemblerError {
    let errorMessage = `Line ${this.currentLine}: ${message}`;

    // Add context lines
    if (this.sourceLines.length > 0) {
      const contextLines: string[] = [];
      const lineNum = this.currentLine;

      // Show line before (if exists)
      if (lineNum > 1 && lineNum - 1 <= this.sourceLines.length) {
        contextLines.push(`  ${lineNum - 1} | ${this.sourceLines[lineNum - 2]}`);
      }

      // Show current line with caret
      if (lineNum <= this.sourceLines.length) {
        const currentLine = this.sourceLines[lineNum - 1];
        contextLines.push(`  ${lineNum} | ${currentLine}`);

        // Add caret pointing to line
        const indent = `  ${lineNum} | `.length;
        contextLines.push(' '.repeat(indent) + '^'.repeat(Math.max(1, currentLine.trim().length)));
      }

      // Show line after (if exists)
      if (lineNum < this.sourceLines.length) {
        contextLines.push(`  ${lineNum + 1} | ${this.sourceLines[lineNum]}`);
      }

      errorMessage += '\n' + contextLines.join('\n');
    }

    return new AssemblerError(errorMessage, this.currentLine);
  }

  /**
   * Remove comments from a line, respecting quoted strings
   */
  private removeComments(line: string): string {
    let result = '';
    let inString = false;
    let escaped = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (escaped) {
        result += ch;
        escaped = false;
        continue;
      }

      if (ch === '\\' && inString) {
        result += ch;
        escaped = true;
        continue;
      }

      if (ch === '"') {
        inString = !inString;
        result += ch;
        continue;
      }

      if (!inString && (ch === ';' || ch === '#')) {
        // Found comment start outside of string
        break;
      }

      result += ch;
    }

    return result;
  }

  /**
   * Process a single line of source
   */
  private processLine(line: string): void {
    // Remove comments (but not if inside quotes)
    line = this.removeComments(line).trim();

    if (!line) {
      return;
    }

    // Check for EQU directive (must come before label check)
    const equMatch = line.match(/^(\w+)\s+EQU\s+(.+)$/i);
    if (equMatch) {
      const name = equMatch[1];
      const value = this.parseNumber(equMatch[2]);
      this.constants.set(name, value);
      return;
    }

    // Check for label
    const labelMatch = line.match(/^(\w+):\s*(.*)/);
    if (labelMatch) {
      // Store label offset based on section and order
      let offset: number;
      if (this.firstSection === 'data') {
        // Data comes first in output
        offset = this.currentSection === 'data'
          ? this.dataOutput.length
          : this.dataOutput.length + this.textOutput.length;
      } else {
        // Text comes first in output (or no sections yet)
        offset = this.currentSection === 'text'
          ? this.textOutput.length
          : this.textOutput.length + this.dataOutput.length;
      }
      this.labels.set(labelMatch[1], offset);
      line = labelMatch[2].trim();
      if (!line) {
        return;
      }
    }

    // Check for directive
    if (line.startsWith('.')) {
      this.processDirective(line);
      return;
    }

    // Process instruction
    this.processInstruction(line);
  }

  /**
   * Get the current output buffer based on section
   */
  private getCurrentOutput(): number[] {
    return this.currentSection === 'data' ? this.dataOutput : this.textOutput;
  }

  /**
   * Get current position in final output (accounting for sections)
   */
  private getCurrentPosition(): number {
    if (this.firstSection === 'data') {
      return this.currentSection === 'data'
        ? this.dataOutput.length
        : this.dataOutput.length + this.textOutput.length;
    } else {
      return this.currentSection === 'text'
        ? this.textOutput.length
        : this.textOutput.length + this.dataOutput.length;
    }
  }

  /**
   * Process directive
   */
  private processDirective(line: string): void {
    // Split only on first whitespace to preserve comma-separated values
    const match = line.match(/^(\S+)\s*(.*)$/);
    if (!match) {
      throw this.error('Invalid directive');
    }
    const directive = match[1].toLowerCase();
    const args = match[2] || '';

    switch (directive) {
      case '.text':
        if (this.firstSection === null) {
          this.firstSection = 'text';
        }
        this.currentSection = 'text';
        break;

      case '.data':
        if (this.firstSection === null) {
          this.firstSection = 'data';
        }
        this.currentSection = 'data';
        break;

      case '.byte': {
        // Support comma-separated values
        const values = args.split(',').map((v) => v.trim());
        for (const val of values) {
          this.getCurrentOutput().push(this.parseNumber(val) & 0xFF);
        }
        break;
      }

      case '.word': {
        // Support comma-separated values
        const values = args.split(',').map((v) => v.trim());
        for (const val of values) {
          this.emitWord(this.parseNumber(val));
        }
        break;
      }

      case '.ascii':
      case '.asciiz':
      case '.string': {
        // .string is an alias for .asciiz
        const shouldNullTerminate = directive === '.asciiz' || directive === '.string';

        // Match string allowing escaped quotes: "..." where \" is allowed inside
        const match = args.match(/"((?:[^"\\]|\\.)*)"/);
        if (!match) {
          throw this.error('Invalid string literal');
        }

        // Process escape sequences
        const str = this.processEscapeSequences(match[1]);
        for (const char of str) {
          this.getCurrentOutput().push(char.charCodeAt(0));
        }
        if (shouldNullTerminate) {
          this.getCurrentOutput().push(0);
        }
        break;
      }

      case '.space': {
        const size = this.parseNumber(args);
        for (let i = 0; i < size; i++) {
          this.getCurrentOutput().push(0);
        }
        break;
      }

      default:
        throw this.error(`Unknown directive: ${directive}`);
    }
  }

  /**
   * Process escape sequences in strings
   */
  private processEscapeSequences(str: string): string {
    let result = '';
    let i = 0;
    while (i < str.length) {
      if (str[i] === '\\' && i + 1 < str.length) {
        const next = str[i + 1];
        switch (next) {
          case 'n': result += '\n'; i += 2; break;
          case 't': result += '\t'; i += 2; break;
          case 'r': result += '\r'; i += 2; break;
          case '0': result += '\0'; i += 2; break;
          case '\\': result += '\\'; i += 2; break;
          case '"': result += '"'; i += 2; break;
          case 'x': {
            // Hex escape: \xHH
            if (i + 3 < str.length) {
              const hex = str.substring(i + 2, i + 4);
              const code = parseInt(hex, 16);
              if (!isNaN(code)) {
                result += String.fromCharCode(code);
                i += 4;
                break;
              }
            }
            // If invalid hex, fall through to default
            result += str[i];
            i++;
            break;
          }
          default: result += str[i]; i++; break;
        }
      } else {
        result += str[i];
        i++;
      }
    }
    return result;
  }

  /**
   * Process instruction
   */
  private processInstruction(line: string): void {
    const parts = line.split(/[\s,]+/).filter((p) => p);
    if (parts.length === 0) {
      return;
    }

    const mnemonic = parts[0].toUpperCase();
    const operands = parts.slice(1);

    switch (mnemonic) {
      case 'NOP':
        this.emitWord(0x00000013); // ADDI x0, x0, 0
        break;

      case 'LUI':
        this.emitLUI(operands);
        break;

      case 'AUIPC':
        this.emitAUIPC(operands);
        break;

      case 'JAL':
        this.emitJAL(operands);
        break;

      case 'JALR':
        this.emitJALR(operands);
        break;

      case 'BEQ':
      case 'BNE':
      case 'BLT':
      case 'BGE':
      case 'BLTU':
      case 'BGEU':
        this.emitBranch(mnemonic, operands);
        break;

      case 'LB':
      case 'LH':
      case 'LW':
      case 'LBU':
      case 'LHU':
        this.emitLoad(mnemonic, operands);
        break;

      case 'SB':
      case 'SH':
      case 'SW':
        this.emitStore(mnemonic, operands);
        break;

      case 'ADDI':
      case 'SLTI':
      case 'SLTIU':
      case 'XORI':
      case 'ORI':
      case 'ANDI':
      case 'SLLI':
      case 'SRLI':
      case 'SRAI':
        this.emitImmALU(mnemonic, operands);
        break;

      case 'ADD':
      case 'SUB':
      case 'SLL':
      case 'SLT':
      case 'SLTU':
      case 'XOR':
      case 'SRL':
      case 'SRA':
      case 'OR':
      case 'AND':
        this.emitRegALU(mnemonic, operands);
        break;

      case 'ECALL':
        this.emitWord(0x00000073);
        break;

      case 'EBREAK':
        this.emitWord(0x00100073);
        break;

      default:
        throw this.error(`Unknown instruction: ${mnemonic}`);
    }
  }

  private emitLUI(operands: string[]): void {
    if (operands.length !== 2) {
      throw this.error('LUI requires 2 operands');
    }
    const rd = this.parseRegister(operands[0]);
    const imm = this.parseNumber(operands[1]);
    // U-type: imm[31:12] | rd | opcode
    const inst = ((imm & 0xFFFFF) << 12) | (rd << 7) | 0x37;
    this.emitWord(inst);
  }

  private emitAUIPC(operands: string[]): void {
    if (operands.length !== 2) {
      throw this.error('AUIPC requires 2 operands');
    }
    const rd = this.parseRegister(operands[0]);
    const imm = this.parseNumber(operands[1]);
    const inst = ((imm & 0xFFFFF) << 12) | (rd << 7) | 0x17;
    this.emitWord(inst);
  }

  private emitJAL(operands: string[]): void {
    if (operands.length !== 2) {
      throw this.error('JAL requires 2 operands');
    }
    const rd = this.parseRegister(operands[0]);
    const target = operands[1];

    // Check if target is a label
    if (this.labels.has(target)) {
      const imm = this.labels.get(target)! - this.getCurrentPosition();
      this.emitWord(this.encodeJAL(rd, imm));
    } else if (/^[a-zA-Z_]\w*$/.test(target)) {
      // Forward reference
      this.pendingLabels.push({
        offset: this.getCurrentPosition(),
        label: target,
        type: 'J',
        line: this.currentLine,
      });
      this.emitWord(this.encodeJAL(rd, 0)); // Placeholder
    } else {
      // Immediate value
      const imm = this.parseNumber(target);
      this.emitWord(this.encodeJAL(rd, imm));
    }
  }

  private encodeJAL(rd: number, imm: number): number {
    // J-type encoding
    const bit20 = (imm >> 20) & 1;
    const bits10_1 = (imm >> 1) & 0x3FF;
    const bit11 = (imm >> 11) & 1;
    const bits19_12 = (imm >> 12) & 0xFF;
    return (bit20 << 31) | (bits10_1 << 21) | (bit11 << 20) | (bits19_12 << 12) | (rd << 7) | 0x6F;
  }

  private emitJALR(operands: string[]): void {
    if (operands.length !== 3) {
      throw this.error('JALR requires 3 operands');
    }
    const rd = this.parseRegister(operands[0]);
    const rs1 = this.parseRegister(operands[1]);
    const imm = this.parseNumber(operands[2]);
    // I-type
    const inst = ((imm & 0xFFF) << 20) | (rs1 << 15) | (0 << 12) | (rd << 7) | 0x67;
    this.emitWord(inst);
  }

  private emitBranch(mnemonic: string, operands: string[]): void {
    if (operands.length !== 3) {
      throw this.error(`${mnemonic} requires 3 operands`);
    }
    const rs1 = this.parseRegister(operands[0]);
    const rs2 = this.parseRegister(operands[1]);
    const target = operands[2];

    const funct3Map: Record<string, number> = {
      BEQ: 0, BNE: 1, BLT: 4, BGE: 5, BLTU: 6, BGEU: 7,
    };
    const funct3 = funct3Map[mnemonic];

    // Check if target is a label
    if (this.labels.has(target)) {
      const imm = this.labels.get(target)! - this.getCurrentPosition();
      this.emitWord(this.encodeBranch(rs1, rs2, imm, funct3));
    } else if (/^[a-zA-Z_]\w*$/.test(target)) {
      // Forward reference
      this.pendingLabels.push({
        offset: this.getCurrentPosition(),
        label: target,
        type: 'B',
        line: this.currentLine,
      });
      this.emitWord(this.encodeBranch(rs1, rs2, 0, funct3)); // Placeholder
    } else {
      // Immediate value
      const imm = this.parseNumber(target);
      this.emitWord(this.encodeBranch(rs1, rs2, imm, funct3));
    }
  }

  private encodeBranch(rs1: number, rs2: number, imm: number, funct3: number): number {
    // B-type encoding
    const bit12 = (imm >> 12) & 1;
    const bits10_5 = (imm >> 5) & 0x3F;
    const bits4_1 = (imm >> 1) & 0xF;
    const bit11 = (imm >> 11) & 1;
    return (bit12 << 31) | (bits10_5 << 25) | (rs2 << 20) | (rs1 << 15) | (funct3 << 12) | (bits4_1 << 8) | (bit11 << 7) | 0x63;
  }

  private emitLoad(mnemonic: string, operands: string[]): void {
    if (operands.length !== 2) {
      throw this.error(`${mnemonic} requires 2 operands`);
    }
    const rd = this.parseRegister(operands[0]);
    const { offset, base } = this.parseMemoryOperand(operands[1]);

    const funct3Map: Record<string, number> = {
      LB: 0, LH: 1, LW: 2, LBU: 4, LHU: 5,
    };
    const funct3 = funct3Map[mnemonic];

    // I-type
    const inst = ((offset & 0xFFF) << 20) | (base << 15) | (funct3 << 12) | (rd << 7) | 0x03;
    this.emitWord(inst);
  }

  private emitStore(mnemonic: string, operands: string[]): void {
    if (operands.length !== 2) {
      throw this.error(`${mnemonic} requires 2 operands`);
    }
    const rs2 = this.parseRegister(operands[0]);
    const { offset, base } = this.parseMemoryOperand(operands[1]);

    const funct3Map: Record<string, number> = {
      SB: 0, SH: 1, SW: 2,
    };
    const funct3 = funct3Map[mnemonic];

    // S-type
    const imm11_5 = (offset >> 5) & 0x7F;
    const imm4_0 = offset & 0x1F;
    const inst = (imm11_5 << 25) | (rs2 << 20) | (base << 15) | (funct3 << 12) | (imm4_0 << 7) | 0x23;
    this.emitWord(inst);
  }

  private emitImmALU(mnemonic: string, operands: string[]): void {
    if (operands.length !== 3) {
      throw this.error(`${mnemonic} requires 3 operands`);
    }
    const rd = this.parseRegister(operands[0]);
    const rs1 = this.parseRegister(operands[1]);
    const imm = this.parseNumber(operands[2]);

    const funct3Map: Record<string, number> = {
      ADDI: 0, SLTI: 2, SLTIU: 3, XORI: 4, ORI: 6, ANDI: 7,
      SLLI: 1, SRLI: 5, SRAI: 5,
    };
    const funct3 = funct3Map[mnemonic];

    let finalImm = imm & 0xFFF;
    if (mnemonic === 'SRAI') {
      finalImm = (imm & 0x1F) | 0x400; // Set bit 10 for arithmetic shift
    } else if (mnemonic === 'SLLI' || mnemonic === 'SRLI') {
      finalImm = imm & 0x1F;
    }

    // I-type
    const inst = (finalImm << 20) | (rs1 << 15) | (funct3 << 12) | (rd << 7) | 0x13;
    this.emitWord(inst);
  }

  private emitRegALU(mnemonic: string, operands: string[]): void {
    if (operands.length !== 3) {
      throw this.error(`${mnemonic} requires 3 operands`);
    }
    const rd = this.parseRegister(operands[0]);
    const rs1 = this.parseRegister(operands[1]);
    const rs2 = this.parseRegister(operands[2]);

    const funct3Map: Record<string, number> = {
      ADD: 0, SUB: 0, SLL: 1, SLT: 2, SLTU: 3,
      XOR: 4, SRL: 5, SRA: 5, OR: 6, AND: 7,
    };
    const funct3 = funct3Map[mnemonic];

    let funct7 = 0;
    if (mnemonic === 'SUB' || mnemonic === 'SRA') {
      funct7 = 0x20;
    }

    // R-type
    const inst = (funct7 << 25) | (rs2 << 20) | (rs1 << 15) | (funct3 << 12) | (rd << 7) | 0x33;
    this.emitWord(inst);
  }

  private parseRegister(name: string): number {
    const normalized = name.toLowerCase();
    if (!(normalized in REGISTERS)) {
      throw this.error(`Invalid register: ${name}`);
    }
    return REGISTERS[normalized];
  }

  private parseNumber(str: string): number {
    str = str.trim();

    // Check if it contains expression operators
    if (/[+\-*\/%&|^<>()]/.test(str)) {
      return this.evaluateExpression(str);
    }

    // Check if it's a constant
    if (this.constants.has(str)) {
      return this.constants.get(str)!;
    }

    // Check if it looks like an identifier (not a number)
    if (/^[a-zA-Z_]\w*$/.test(str)) {
      throw this.error(`Undefined constant: ${str}`);
    }

    if (str.startsWith('0x') || str.startsWith('0X')) {
      return parseInt(str.slice(2), 16);
    }
    if (str.startsWith('-')) {
      return parseInt(str, 10);
    }
    return parseInt(str, 10);
  }

  /**
   * Evaluate arithmetic expression
   */
  private evaluateExpression(expr: string): number {
    // Simple recursive descent parser for expressions
    expr = expr.trim();

    // Handle parentheses
    if (expr.startsWith('(') && expr.endsWith(')')) {
      return this.evaluateExpression(expr.slice(1, -1));
    }

    // Bitwise OR (lowest precedence)
    for (let i = expr.length - 1; i >= 0; i--) {
      if (expr[i] === '|' && !this.isInParens(expr, i)) {
        const left = this.evaluateExpression(expr.slice(0, i));
        const right = this.evaluateExpression(expr.slice(i + 1));
        return left | right;
      }
    }

    // Bitwise XOR
    for (let i = expr.length - 1; i >= 0; i--) {
      if (expr[i] === '^' && !this.isInParens(expr, i)) {
        const left = this.evaluateExpression(expr.slice(0, i));
        const right = this.evaluateExpression(expr.slice(i + 1));
        return left ^ right;
      }
    }

    // Bitwise AND
    for (let i = expr.length - 1; i >= 0; i--) {
      if (expr[i] === '&' && !this.isInParens(expr, i)) {
        const left = this.evaluateExpression(expr.slice(0, i));
        const right = this.evaluateExpression(expr.slice(i + 1));
        return left & right;
      }
    }

    // Bit shifts
    for (let i = expr.length - 1; i >= 0; i--) {
      if (expr.slice(i, i + 2) === '<<' && !this.isInParens(expr, i)) {
        const left = this.evaluateExpression(expr.slice(0, i));
        const right = this.evaluateExpression(expr.slice(i + 2));
        return left << right;
      }
      if (expr.slice(i, i + 2) === '>>' && !this.isInParens(expr, i)) {
        const left = this.evaluateExpression(expr.slice(0, i));
        const right = this.evaluateExpression(expr.slice(i + 2));
        return left >> right;
      }
    }

    // Addition and subtraction
    for (let i = expr.length - 1; i >= 0; i--) {
      if (expr[i] === '+' && !this.isInParens(expr, i) && i > 0) {
        const left = this.evaluateExpression(expr.slice(0, i));
        const right = this.evaluateExpression(expr.slice(i + 1));
        return left + right;
      }
      if (expr[i] === '-' && !this.isInParens(expr, i) && i > 0) {
        const left = this.evaluateExpression(expr.slice(0, i));
        const right = this.evaluateExpression(expr.slice(i + 1));
        return left - right;
      }
    }

    // Multiplication, division, modulo
    for (let i = expr.length - 1; i >= 0; i--) {
      if (expr[i] === '*' && !this.isInParens(expr, i)) {
        const left = this.evaluateExpression(expr.slice(0, i));
        const right = this.evaluateExpression(expr.slice(i + 1));
        return left * right;
      }
      if (expr[i] === '/' && !this.isInParens(expr, i)) {
        const left = this.evaluateExpression(expr.slice(0, i));
        const right = this.evaluateExpression(expr.slice(i + 1));
        return Math.floor(left / right);
      }
      if (expr[i] === '%' && !this.isInParens(expr, i)) {
        const left = this.evaluateExpression(expr.slice(0, i));
        const right = this.evaluateExpression(expr.slice(i + 1));
        return left % right;
      }
    }

    // Base case: single number or constant
    if (this.constants.has(expr)) {
      return this.constants.get(expr)!;
    }

    if (expr.startsWith('0x') || expr.startsWith('0X')) {
      return parseInt(expr.slice(2), 16);
    }
    if (expr.startsWith('-')) {
      return -this.evaluateExpression(expr.slice(1));
    }

    return parseInt(expr, 10);
  }

  /**
   * Check if position is inside parentheses
   */
  private isInParens(expr: string, pos: number): boolean {
    let depth = 0;
    for (let i = 0; i < pos; i++) {
      if (expr[i] === '(') depth++;
      if (expr[i] === ')') depth--;
    }
    return depth > 0;
  }

  private parseMemoryOperand(operand: string): { offset: number; base: number } {
    // Format: offset(reg) or just (reg)
    const match = operand.match(/(-?\d+|0x[0-9a-fA-F]+)?\((\w+)\)/);
    if (!match) {
      throw this.error(`Invalid memory operand: ${operand}`);
    }
    const offset = match[1] ? this.parseNumber(match[1]) : 0;
    const base = this.parseRegister(match[2]);
    return { offset, base };
  }

  /**
   * Expand macros in source code
   */
  private expandMacros(lines: string[]): string[] {
    const result: string[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i].replace(/[;#].*$/, '').trim();

      // Check for macro definition
      const macroMatch = line.match(/^\.macro\s+(\w+)(?:\s+(.*))?$/i);
      if (macroMatch) {
        const name = macroMatch[1];
        const params = macroMatch[2] ? macroMatch[2].split(/\s*,\s*/) : [];
        const body: string[] = [];

        // Collect macro body until .endmacro
        i++;
        while (i < lines.length) {
          const bodyLine = lines[i];
          const cleaned = bodyLine.replace(/[;#].*$/, '').trim();

          if (cleaned.match(/^\.endmacro$/i)) {
            break;
          }

          body.push(bodyLine);
          i++;
        }

        // Store macro definition
        this.macros.set(name.toUpperCase(), { name, params, body });
        i++;
        continue;
      }

      // Check for macro invocation
      const words = line.split(/\s+/);
      if (words.length > 0 && this.macros.has(words[0].toUpperCase())) {
        const macroName = words[0].toUpperCase();
        const macro = this.macros.get(macroName)!;
        const args = words.slice(1).join(' ').split(/\s*,\s*/);

        // Expand macro body with parameter substitution
        for (const bodyLine of macro.body) {
          let expanded = bodyLine;

          // Substitute parameters
          for (let j = 0; j < macro.params.length; j++) {
            const param = macro.params[j];
            const arg = args[j] || '';
            // Replace \param with actual argument
            const regex = new RegExp('\\\\' + param + '\\b', 'g');
            expanded = expanded.replace(regex, arg);
          }

          result.push(expanded);
        }
        i++;
        continue;
      }

      // Regular line - just copy it
      result.push(lines[i]);
      i++;
    }

    return result;
  }

  private emitWord(value: number): void {
    const output = this.getCurrentOutput();
    output.push(value & 0xFF);
    output.push((value >> 8) & 0xFF);
    output.push((value >> 16) & 0xFF);
    output.push((value >> 24) & 0xFF);
  }

  private patchBranch(offset: number, imm: number, type: 'J' | 'B'): void {
    // Read existing instruction
    const existing =
      this.output[offset] |
      (this.output[offset + 1] << 8) |
      (this.output[offset + 2] << 16) |
      (this.output[offset + 3] << 24);

    let patched: number;
    if (type === 'J') {
      // Extract rd from existing JAL
      const rd = (existing >> 7) & 0x1F;
      patched = this.encodeJAL(rd, imm);
    } else {
      // Extract rs1, rs2, funct3 from existing branch
      const rs1 = (existing >> 15) & 0x1F;
      const rs2 = (existing >> 20) & 0x1F;
      const funct3 = (existing >> 12) & 0x7;
      patched = this.encodeBranch(rs1, rs2, imm, funct3);
    }

    // Write back
    this.output[offset] = patched & 0xFF;
    this.output[offset + 1] = (patched >> 8) & 0xFF;
    this.output[offset + 2] = (patched >> 16) & 0xFF;
    this.output[offset + 3] = (patched >> 24) & 0xFF;
  }
}
