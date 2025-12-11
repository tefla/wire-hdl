/**
 * RISC-V Assembler Parser
 *
 * Parses tokens into an AST representing assembly statements.
 */

import { Lexer, Token, TokenType } from './lexer.js';

export enum NodeType {
  INSTRUCTION = 'INSTRUCTION',
  LABEL = 'LABEL',
  DIRECTIVE = 'DIRECTIVE',
}

export enum InstructionType {
  R = 'R',
  I = 'I',
  S = 'S',
  B = 'B',
  U = 'U',
  J = 'J',
}

export interface InstructionNode {
  type: NodeType.INSTRUCTION;
  mnemonic: string;
  instructionType: InstructionType;
  rd?: number;
  rs1?: number;
  rs2?: number;
  imm?: number;
  label?: string;
  line: number;
  column: number;
}

export interface LabelNode {
  type: NodeType.LABEL;
  name: string;
  line: number;
  column: number;
}

export interface DirectiveNode {
  type: NodeType.DIRECTIVE;
  name: string;
  args: (string | number)[];
  line: number;
  column: number;
}

export type ASTNode = InstructionNode | LabelNode | DirectiveNode;

export interface AST {
  statements: ASTNode[];
}

// Instruction type mappings
const R_TYPE_INSTRUCTIONS = new Set([
  'ADD', 'SUB', 'SLL', 'SLT', 'SLTU', 'XOR', 'SRL', 'SRA', 'OR', 'AND',
]);

const I_TYPE_ALU_INSTRUCTIONS = new Set([
  'ADDI', 'SLTI', 'SLTIU', 'XORI', 'ORI', 'ANDI', 'SLLI', 'SRLI', 'SRAI',
]);

const I_TYPE_LOAD_INSTRUCTIONS = new Set([
  'LB', 'LH', 'LW', 'LBU', 'LHU',
]);

const S_TYPE_INSTRUCTIONS = new Set([
  'SB', 'SH', 'SW',
]);

const B_TYPE_INSTRUCTIONS = new Set([
  'BEQ', 'BNE', 'BLT', 'BGE', 'BLTU', 'BGEU',
]);

const U_TYPE_INSTRUCTIONS = new Set([
  'LUI', 'AUIPC',
]);

const SYSTEM_INSTRUCTIONS = new Set([
  'ECALL', 'EBREAK', 'FENCE',
]);

const PSEUDO_NO_OPERANDS = new Set([
  'NOP', 'RET',
]);

const PSEUDO_ONE_REG = new Set([
  'JR',
]);

const PSEUDO_ONE_LABEL = new Set([
  'J', 'CALL', 'TAIL',
]);

const PSEUDO_RD_IMM = new Set([
  'LI',
]);

const PSEUDO_RD_LABEL = new Set([
  'LA',
]);

const PSEUDO_RD_RS1 = new Set([
  'MV', 'NOT', 'NEG', 'SEQZ', 'SNEZ', 'SLTZ', 'SGTZ',
]);

const PSEUDO_RS1_LABEL = new Set([
  'BEQZ', 'BNEZ', 'BLEZ', 'BGEZ', 'BLTZ', 'BGTZ',
]);

export class ParserError extends Error {
  constructor(message: string, public line: number, public column: number) {
    super(`${message} at line ${line}, column ${column}`);
    this.name = 'ParserError';
  }
}

export class Parser {
  private tokens: Token[] = [];
  private pos: number = 0;
  private source: string;

  constructor(source: string) {
    this.source = source;
  }

  parse(): AST {
    const lexer = new Lexer(this.source);
    this.tokens = lexer.tokenize();
    this.pos = 0;

    const statements: ASTNode[] = [];

    while (!this.isAtEnd()) {
      // Skip newlines
      while (this.check(TokenType.NEWLINE)) {
        this.advance();
      }

      if (this.isAtEnd()) break;

      const stmt = this.parseStatement();
      if (stmt) {
        statements.push(stmt);
      }
    }

    return { statements };
  }

  private parseStatement(): ASTNode | null {
    const token = this.peek();

    if (token.type === TokenType.LABEL_DEF) {
      return this.parseLabelDefinition();
    }

    if (token.type === TokenType.DIRECTIVE) {
      return this.parseDirective();
    }

    if (token.type === TokenType.INSTRUCTION) {
      return this.parseInstruction();
    }

    // Skip newlines and EOF
    if (token.type === TokenType.NEWLINE || token.type === TokenType.EOF) {
      this.advance();
      return null;
    }

    throw new ParserError(
      `Unexpected token '${token.value}'`,
      token.line,
      token.column
    );
  }

  private parseLabelDefinition(): LabelNode {
    const token = this.advance();
    return {
      type: NodeType.LABEL,
      name: token.value as string,
      line: token.line,
      column: token.column,
    };
  }

  private parseDirective(): DirectiveNode {
    const token = this.advance();
    const name = token.value as string;
    const args: (string | number)[] = [];

    // Parse directive arguments
    if (!this.checkEndOfStatement()) {
      // Special handling for .equ which has NAME, VALUE format
      if (name === '.EQU' || name === '.SET' || name === '.EQUIV') {
        // First arg is identifier
        const identToken = this.expect(TokenType.IDENTIFIER, 'Expected identifier after .equ');
        args.push(identToken.value as string);
        this.expect(TokenType.COMMA, 'Expected comma after identifier');
        // Second arg is number
        const numToken = this.expect(TokenType.NUMBER, 'Expected number after comma');
        args.push(numToken.value as number);
      } else if (name === '.GLOBAL' || name === '.GLOBL' || name === '.LOCAL' || name === '.SECTION') {
        // These take an identifier
        const identToken = this.expect(TokenType.IDENTIFIER, `Expected identifier after ${name}`);
        args.push(identToken.value as string);
      } else if (name === '.ASCII' || name === '.ASCIIZ' || name === '.STRING') {
        // These take a string
        const strToken = this.expect(TokenType.STRING, `Expected string after ${name}`);
        args.push(strToken.value as string);
      } else {
        // Parse comma-separated list of numbers or identifiers
        do {
          const argToken = this.peek();
          if (argToken.type === TokenType.NUMBER) {
            args.push(this.advance().value as number);
          } else if (argToken.type === TokenType.IDENTIFIER) {
            args.push(this.advance().value as string);
          } else {
            break;
          }
        } while (this.match(TokenType.COMMA));
      }
    }

    return {
      type: NodeType.DIRECTIVE,
      name,
      args,
      line: token.line,
      column: token.column,
    };
  }

  private parseInstruction(): InstructionNode {
    const token = this.advance();
    const mnemonic = token.value as string;

    // Determine instruction type and parse accordingly
    if (R_TYPE_INSTRUCTIONS.has(mnemonic)) {
      return this.parseRType(mnemonic, token);
    }

    if (I_TYPE_ALU_INSTRUCTIONS.has(mnemonic)) {
      return this.parseITypeAlu(mnemonic, token);
    }

    if (I_TYPE_LOAD_INSTRUCTIONS.has(mnemonic)) {
      return this.parseITypeLoad(mnemonic, token);
    }

    if (mnemonic === 'JALR') {
      return this.parseJalr(token);
    }

    if (S_TYPE_INSTRUCTIONS.has(mnemonic)) {
      return this.parseSType(mnemonic, token);
    }

    if (B_TYPE_INSTRUCTIONS.has(mnemonic)) {
      return this.parseBType(mnemonic, token);
    }

    if (U_TYPE_INSTRUCTIONS.has(mnemonic)) {
      return this.parseUType(mnemonic, token);
    }

    if (mnemonic === 'JAL') {
      return this.parseJal(token);
    }

    if (SYSTEM_INSTRUCTIONS.has(mnemonic)) {
      return this.parseSystem(mnemonic, token);
    }

    // Pseudo-instructions
    if (PSEUDO_NO_OPERANDS.has(mnemonic)) {
      return {
        type: NodeType.INSTRUCTION,
        mnemonic,
        instructionType: InstructionType.I,
        line: token.line,
        column: token.column,
      };
    }

    if (PSEUDO_ONE_REG.has(mnemonic)) {
      const rs1 = this.parseRegister();
      return {
        type: NodeType.INSTRUCTION,
        mnemonic,
        instructionType: InstructionType.I,
        rs1,
        line: token.line,
        column: token.column,
      };
    }

    if (PSEUDO_ONE_LABEL.has(mnemonic)) {
      const label = this.parseLabel();
      return {
        type: NodeType.INSTRUCTION,
        mnemonic,
        instructionType: InstructionType.J,
        label,
        line: token.line,
        column: token.column,
      };
    }

    if (PSEUDO_RD_IMM.has(mnemonic)) {
      const rd = this.parseRegister();
      this.expect(TokenType.COMMA, 'Expected comma');
      const immOrLabel = this.parseLabelOrImmediate();
      return {
        type: NodeType.INSTRUCTION,
        mnemonic,
        instructionType: InstructionType.I,
        rd,
        ...(typeof immOrLabel === 'string' ? { label: immOrLabel } : { imm: immOrLabel }),
        line: token.line,
        column: token.column,
      };
    }

    if (PSEUDO_RD_LABEL.has(mnemonic)) {
      const rd = this.parseRegister();
      this.expect(TokenType.COMMA, 'Expected comma');
      const label = this.parseLabel();
      return {
        type: NodeType.INSTRUCTION,
        mnemonic,
        instructionType: InstructionType.I,
        rd,
        label,
        line: token.line,
        column: token.column,
      };
    }

    if (PSEUDO_RD_RS1.has(mnemonic)) {
      const rd = this.parseRegister();
      this.expect(TokenType.COMMA, 'Expected comma');
      const rs1 = this.parseRegister();
      return {
        type: NodeType.INSTRUCTION,
        mnemonic,
        instructionType: InstructionType.R,
        rd,
        rs1,
        line: token.line,
        column: token.column,
      };
    }

    if (PSEUDO_RS1_LABEL.has(mnemonic)) {
      const rs1 = this.parseRegister();
      this.expect(TokenType.COMMA, 'Expected comma');
      const labelOrImm = this.parseLabelOrImmediate();
      return {
        type: NodeType.INSTRUCTION,
        mnemonic,
        instructionType: InstructionType.B,
        rs1,
        rs2: 0,
        ...(typeof labelOrImm === 'string' ? { label: labelOrImm } : { imm: labelOrImm }),
        line: token.line,
        column: token.column,
      };
    }

    throw new ParserError(
      `Unknown instruction '${mnemonic}'`,
      token.line,
      token.column
    );
  }

  private parseRType(mnemonic: string, token: Token): InstructionNode {
    const rd = this.parseRegister();
    this.expect(TokenType.COMMA, 'Expected comma after rd');
    const rs1 = this.parseRegister();
    this.expect(TokenType.COMMA, 'Expected comma after rs1');
    const rs2 = this.parseRegister();

    return {
      type: NodeType.INSTRUCTION,
      mnemonic,
      instructionType: InstructionType.R,
      rd,
      rs1,
      rs2,
      line: token.line,
      column: token.column,
    };
  }

  private parseITypeAlu(mnemonic: string, token: Token): InstructionNode {
    const rd = this.parseRegister();
    this.expect(TokenType.COMMA, 'Expected comma after rd');
    const rs1 = this.parseRegister();
    this.expect(TokenType.COMMA, 'Expected comma after rs1');
    const immOrLabel = this.parseLabelOrImmediate();

    return {
      type: NodeType.INSTRUCTION,
      mnemonic,
      instructionType: InstructionType.I,
      rd,
      rs1,
      ...(typeof immOrLabel === 'string' ? { label: immOrLabel } : { imm: immOrLabel }),
      line: token.line,
      column: token.column,
    };
  }

  private parseITypeLoad(mnemonic: string, token: Token): InstructionNode {
    const rd = this.parseRegister();
    this.expect(TokenType.COMMA, 'Expected comma after rd');
    const { offset, base } = this.parseMemoryOperand();

    return {
      type: NodeType.INSTRUCTION,
      mnemonic,
      instructionType: InstructionType.I,
      rd,
      rs1: base,
      imm: offset,
      line: token.line,
      column: token.column,
    };
  }

  private parseJalr(token: Token): InstructionNode {
    const rd = this.parseRegister();
    this.expect(TokenType.COMMA, 'Expected comma after rd');
    const { offset, base } = this.parseMemoryOperand();

    return {
      type: NodeType.INSTRUCTION,
      mnemonic: 'JALR',
      instructionType: InstructionType.I,
      rd,
      rs1: base,
      imm: offset,
      line: token.line,
      column: token.column,
    };
  }

  private parseSType(mnemonic: string, token: Token): InstructionNode {
    const rs2 = this.parseRegister(); // source register
    this.expect(TokenType.COMMA, 'Expected comma after rs2');
    const { offset, base } = this.parseMemoryOperand();

    return {
      type: NodeType.INSTRUCTION,
      mnemonic,
      instructionType: InstructionType.S,
      rs1: base,
      rs2,
      imm: offset,
      line: token.line,
      column: token.column,
    };
  }

  private parseBType(mnemonic: string, token: Token): InstructionNode {
    const rs1 = this.parseRegister();
    this.expect(TokenType.COMMA, 'Expected comma after rs1');
    const rs2 = this.parseRegister();
    this.expect(TokenType.COMMA, 'Expected comma after rs2');
    const labelOrImm = this.parseLabelOrImmediate();

    return {
      type: NodeType.INSTRUCTION,
      mnemonic,
      instructionType: InstructionType.B,
      rs1,
      rs2,
      ...(typeof labelOrImm === 'string' ? { label: labelOrImm } : { imm: labelOrImm }),
      line: token.line,
      column: token.column,
    };
  }

  private parseUType(mnemonic: string, token: Token): InstructionNode {
    const rd = this.parseRegister();
    this.expect(TokenType.COMMA, 'Expected comma after rd');
    const imm = this.parseImmediate();

    return {
      type: NodeType.INSTRUCTION,
      mnemonic,
      instructionType: InstructionType.U,
      rd,
      imm,
      line: token.line,
      column: token.column,
    };
  }

  private parseJal(token: Token): InstructionNode {
    const rd = this.parseRegister();
    this.expect(TokenType.COMMA, 'Expected comma after rd');
    const labelOrImm = this.parseLabelOrImmediate();

    return {
      type: NodeType.INSTRUCTION,
      mnemonic: 'JAL',
      instructionType: InstructionType.J,
      rd,
      ...(typeof labelOrImm === 'string' ? { label: labelOrImm } : { imm: labelOrImm }),
      line: token.line,
      column: token.column,
    };
  }

  private parseSystem(mnemonic: string, token: Token): InstructionNode {
    return {
      type: NodeType.INSTRUCTION,
      mnemonic,
      instructionType: InstructionType.I,
      rd: 0,
      rs1: 0,
      imm: mnemonic === 'ECALL' ? 0 : mnemonic === 'EBREAK' ? 1 : 0,
      line: token.line,
      column: token.column,
    };
  }

  private parseRegister(): number {
    const token = this.peek();
    if (token.type !== TokenType.REGISTER) {
      throw new ParserError(
        `Expected register, got '${token.value}'`,
        token.line,
        token.column
      );
    }
    this.advance();
    const regNum = token.value as number;
    if (regNum < 0 || regNum > 31) {
      throw new ParserError(
        `Invalid register number ${regNum}`,
        token.line,
        token.column
      );
    }
    return regNum;
  }

  private parseImmediate(): number {
    const token = this.peek();
    if (token.type !== TokenType.NUMBER) {
      throw new ParserError(
        `Expected immediate value, got '${token.value}'`,
        token.line,
        token.column
      );
    }
    this.advance();
    return token.value as number;
  }

  private parseLabel(): string {
    const token = this.peek();
    if (token.type !== TokenType.IDENTIFIER) {
      throw new ParserError(
        `Expected label, got '${token.value}'`,
        token.line,
        token.column
      );
    }
    this.advance();
    return token.value as string;
  }

  private parseLabelOrImmediate(): string | number {
    const token = this.peek();
    if (token.type === TokenType.IDENTIFIER) {
      this.advance();
      return token.value as string;
    }
    if (token.type === TokenType.NUMBER) {
      this.advance();
      return token.value as number;
    }
    throw new ParserError(
      `Expected label or immediate, got '${token.value}'`,
      token.line,
      token.column
    );
  }

  private parseMemoryOperand(): { offset: number; base: number } {
    // Parse offset(base) syntax
    const offsetToken = this.peek();
    let offset = 0;

    if (offsetToken.type === TokenType.NUMBER) {
      offset = this.advance().value as number;
    }

    this.expect(TokenType.LPAREN, 'Expected ( in memory operand');
    const base = this.parseRegister();
    this.expect(TokenType.RPAREN, 'Expected ) in memory operand');

    return { offset, base };
  }

  // Helper methods
  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    if (!this.isAtEnd()) {
      this.pos++;
    }
    return this.tokens[this.pos - 1];
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private match(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private expect(type: TokenType, message: string): Token {
    if (this.check(type)) {
      return this.advance();
    }
    const token = this.peek();
    throw new ParserError(
      `${message}, got '${token.value}'`,
      token.line,
      token.column
    );
  }

  private checkEndOfStatement(): boolean {
    const type = this.peek().type;
    return type === TokenType.NEWLINE || type === TokenType.EOF;
  }
}
