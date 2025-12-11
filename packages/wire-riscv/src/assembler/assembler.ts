/**
 * RISC-V Assembler
 *
 * Two-pass assembler that converts RISC-V assembly source to machine code.
 */

import { Parser, AST, ASTNode, NodeType, InstructionNode, InstructionType, DirectiveNode, LabelNode } from './parser.js';
import { Encoder } from './encoder.js';

export interface AssemblerError {
  message: string;
  line: number;
  column: number;
}

export interface AssemblerResult {
  bytes: Uint8Array;
  symbols: Map<string, number>;
  errors: AssemblerError[];
}

export class Assembler {
  private source: string;
  private symbols: Map<string, number> = new Map();
  private output: number[] = [];
  private pc: number = 0;
  private errors: AssemblerError[] = [];

  constructor(source: string) {
    this.source = source;
  }

  assemble(): AssemblerResult {
    this.symbols = new Map();
    this.output = [];
    this.pc = 0;
    this.errors = [];

    // Parse source
    const parser = new Parser(this.source);
    let ast: AST;
    try {
      ast = parser.parse();
    } catch (e: unknown) {
      const err = e as Error;
      const match = err.message.match(/line (\d+)/i);
      const line = match ? parseInt(match[1]) : 1;
      this.errors.push({
        message: err.message,
        line,
        column: 1,
      });
      return {
        bytes: new Uint8Array(),
        symbols: this.symbols,
        errors: this.errors,
      };
    }

    // Pass 1: Collect labels and calculate addresses
    this.pass1(ast);

    if (this.errors.length > 0) {
      return {
        bytes: new Uint8Array(),
        symbols: this.symbols,
        errors: this.errors,
      };
    }

    // Pass 2: Generate machine code
    this.pc = 0;
    this.output = [];
    this.pass2(ast);

    return {
      bytes: new Uint8Array(this.output),
      symbols: this.symbols,
      errors: this.errors,
    };
  }

  private pass1(ast: AST): void {
    this.pc = 0;

    for (const stmt of ast.statements) {
      switch (stmt.type) {
        case NodeType.LABEL:
          this.pass1Label(stmt);
          break;
        case NodeType.DIRECTIVE:
          this.pass1Directive(stmt);
          break;
        case NodeType.INSTRUCTION:
          this.pass1Instruction(stmt);
          break;
      }
    }
  }

  private pass1Label(node: LabelNode): void {
    if (this.symbols.has(node.name)) {
      this.errors.push({
        message: `Duplicate label '${node.name}'`,
        line: node.line,
        column: node.column,
      });
      return;
    }
    this.symbols.set(node.name, this.pc);
  }

  private pass1Directive(node: DirectiveNode): void {
    switch (node.name) {
      case '.ORG':
        this.pc = node.args[0] as number;
        break;
      case '.EQU':
      case '.SET':
      case '.EQUIV':
        const name = node.args[0] as string;
        const value = node.args[1] as number;
        this.symbols.set(name, value);
        break;
      case '.BYTE':
        this.pc += node.args.length;
        break;
      case '.HALF':
        this.pc += node.args.length * 2;
        break;
      case '.WORD':
        this.pc += node.args.length * 4;
        break;
      case '.ASCII':
        this.pc += (node.args[0] as string).length;
        break;
      case '.ASCIIZ':
      case '.STRING':
        this.pc += (node.args[0] as string).length + 1; // +1 for null
        break;
      case '.SPACE':
      case '.ZERO':
        this.pc += node.args[0] as number;
        break;
      case '.ALIGN':
        const alignment = 1 << (node.args[0] as number);
        const padding = (alignment - (this.pc % alignment)) % alignment;
        this.pc += padding;
        break;
      case '.GLOBAL':
      case '.GLOBL':
      case '.LOCAL':
      case '.SECTION':
      case '.TEXT':
      case '.DATA':
      case '.BSS':
      case '.RODATA':
        // Informational only, no size impact for now
        break;
    }
  }

  private pass1Instruction(node: InstructionNode): void {
    // Most instructions are 4 bytes
    // Pseudo-instructions may expand to multiple instructions
    const size = this.getInstructionSize(node);
    this.pc += size;
  }

  private getInstructionSize(node: InstructionNode): number {
    switch (node.mnemonic) {
      case 'LI':
        // LI with small immediate (fits in 12 bits) -> 1 instruction
        // LI with large immediate -> 2 instructions (LUI + ADDI)
        if (node.imm !== undefined) {
          if (node.imm >= -2048 && node.imm < 2048) {
            return 4;
          } else {
            return 8;
          }
        }
        return 4;
      case 'LA':
        // LA expands to AUIPC + ADDI
        return 8;
      case 'CALL':
      case 'TAIL':
        // CALL/TAIL expand to AUIPC + JALR
        return 8;
      default:
        return 4;
    }
  }

  private pass2(ast: AST): void {
    this.pc = 0;

    for (const stmt of ast.statements) {
      switch (stmt.type) {
        case NodeType.LABEL:
          // Labels don't emit bytes
          break;
        case NodeType.DIRECTIVE:
          this.pass2Directive(stmt);
          break;
        case NodeType.INSTRUCTION:
          this.pass2Instruction(stmt);
          break;
      }
    }
  }

  private pass2Directive(node: DirectiveNode): void {
    switch (node.name) {
      case '.ORG':
        const targetPc = node.args[0] as number;
        // Pad output to reach target address
        while (this.output.length < targetPc) {
          this.output.push(0);
        }
        this.pc = targetPc;
        break;
      case '.EQU':
      case '.SET':
      case '.EQUIV':
      case '.GLOBAL':
      case '.GLOBL':
      case '.LOCAL':
      case '.SECTION':
      case '.TEXT':
      case '.DATA':
      case '.BSS':
      case '.RODATA':
        // No output
        break;
      case '.BYTE':
        for (const arg of node.args) {
          this.emit8(arg as number);
        }
        break;
      case '.HALF':
        for (const arg of node.args) {
          this.emit16(arg as number);
        }
        break;
      case '.WORD':
        for (const arg of node.args) {
          this.emit32(arg as number);
        }
        break;
      case '.ASCII':
        for (const char of node.args[0] as string) {
          this.emit8(char.charCodeAt(0));
        }
        break;
      case '.ASCIIZ':
      case '.STRING':
        for (const char of node.args[0] as string) {
          this.emit8(char.charCodeAt(0));
        }
        this.emit8(0); // null terminator
        break;
      case '.SPACE':
      case '.ZERO':
        for (let i = 0; i < (node.args[0] as number); i++) {
          this.emit8(0);
        }
        break;
      case '.ALIGN':
        const alignment = 1 << (node.args[0] as number);
        while (this.pc % alignment !== 0) {
          this.emit8(0);
        }
        break;
    }
  }

  private pass2Instruction(node: InstructionNode): void {
    // Handle pseudo-instructions first
    if (this.emitPseudoInstruction(node)) {
      return;
    }

    // Resolve label if present
    let imm = node.imm ?? 0;
    if (node.label) {
      const labelValue = this.symbols.get(node.label);
      if (labelValue === undefined) {
        this.errors.push({
          message: `Undefined label '${node.label}'`,
          line: node.line,
          column: node.column,
        });
        this.emit32(0); // Emit placeholder
        return;
      }
      // For branches and jumps, calculate PC-relative offset
      // For I-type ALU instructions (ADDI, etc.), use the direct symbol value
      if (node.instructionType === InstructionType.B || node.instructionType === InstructionType.J) {
        imm = labelValue - this.pc;
      } else {
        // For ALU instructions, use the symbol value directly (e.g., .equ constants)
        imm = labelValue;
      }
    }

    // Encode and emit instruction
    let encoded: number;
    switch (node.instructionType) {
      case InstructionType.R:
        encoded = Encoder.encodeR(node.mnemonic, node.rd!, node.rs1!, node.rs2!);
        break;
      case InstructionType.I:
        encoded = Encoder.encodeI(node.mnemonic, node.rd ?? 0, node.rs1 ?? 0, imm);
        break;
      case InstructionType.S:
        encoded = Encoder.encodeS(node.mnemonic, node.rs1!, node.rs2!, imm);
        break;
      case InstructionType.B:
        encoded = Encoder.encodeB(node.mnemonic, node.rs1!, node.rs2!, imm);
        break;
      case InstructionType.U:
        encoded = Encoder.encodeU(node.mnemonic, node.rd!, imm);
        break;
      case InstructionType.J:
        encoded = Encoder.encodeJ(node.mnemonic, node.rd!, imm);
        break;
      default:
        encoded = 0;
    }

    this.emit32(encoded);
  }

  private emitPseudoInstruction(node: InstructionNode): boolean {
    switch (node.mnemonic) {
      case 'NOP':
        // ADDI x0, x0, 0
        this.emit32(Encoder.encodeI('ADDI', 0, 0, 0));
        return true;

      case 'LI': {
        const rd = node.rd!;
        const imm = node.imm!;
        if (imm >= -2048 && imm < 2048) {
          // Small immediate: ADDI rd, x0, imm
          this.emit32(Encoder.encodeI('ADDI', rd, 0, imm));
        } else {
          // Large immediate: LUI + ADDI
          const upper = ((imm + 0x800) >> 12) & 0xfffff;
          const lower = imm - (upper << 12);
          this.emit32(Encoder.encodeU('LUI', rd, upper));
          this.emit32(Encoder.encodeI('ADDI', rd, rd, lower));
        }
        return true;
      }

      case 'LA': {
        const rd = node.rd!;
        const labelAddr = this.symbols.get(node.label!);
        if (labelAddr === undefined) {
          this.errors.push({
            message: `Undefined label '${node.label}'`,
            line: node.line,
            column: node.column,
          });
          this.emit32(0);
          this.emit32(0);
          return true;
        }
        // AUIPC + ADDI for PC-relative address
        const offset = labelAddr - this.pc;
        const upper = ((offset + 0x800) >> 12) & 0xfffff;
        const lower = offset - (upper << 12);
        this.emit32(Encoder.encodeU('AUIPC', rd, upper));
        this.emit32(Encoder.encodeI('ADDI', rd, rd, lower));
        return true;
      }

      case 'MV':
        // ADDI rd, rs1, 0
        this.emit32(Encoder.encodeI('ADDI', node.rd!, node.rs1!, 0));
        return true;

      case 'NOT':
        // XORI rd, rs1, -1
        this.emit32(Encoder.encodeI('XORI', node.rd!, node.rs1!, -1));
        return true;

      case 'NEG':
        // SUB rd, x0, rs1
        this.emit32(Encoder.encodeR('SUB', node.rd!, 0, node.rs1!));
        return true;

      case 'SEQZ':
        // SLTIU rd, rs1, 1
        this.emit32(Encoder.encodeI('SLTIU', node.rd!, node.rs1!, 1));
        return true;

      case 'SNEZ':
        // SLTU rd, x0, rs1
        this.emit32(Encoder.encodeR('SLTU', node.rd!, 0, node.rs1!));
        return true;

      case 'J': {
        // JAL x0, offset
        const labelAddr = this.symbols.get(node.label!);
        if (labelAddr === undefined) {
          this.errors.push({
            message: `Undefined label '${node.label}'`,
            line: node.line,
            column: node.column,
          });
          this.emit32(0);
          return true;
        }
        const offset = labelAddr - this.pc;
        this.emit32(Encoder.encodeJ('JAL', 0, offset));
        return true;
      }

      case 'JR':
        // JALR x0, 0(rs1)
        this.emit32(Encoder.encodeI('JALR', 0, node.rs1!, 0));
        return true;

      case 'RET':
        // JALR x0, 0(ra)
        this.emit32(Encoder.encodeI('JALR', 0, 1, 0)); // x1 = ra
        return true;

      case 'CALL': {
        // AUIPC ra, upper; JALR ra, lower(ra)
        const labelAddr = this.symbols.get(node.label!);
        if (labelAddr === undefined) {
          this.errors.push({
            message: `Undefined label '${node.label}'`,
            line: node.line,
            column: node.column,
          });
          this.emit32(0);
          this.emit32(0);
          return true;
        }
        const offset = labelAddr - this.pc;
        const upper = ((offset + 0x800) >> 12) & 0xfffff;
        const lower = offset - (upper << 12);
        this.emit32(Encoder.encodeU('AUIPC', 1, upper)); // ra = x1
        this.emit32(Encoder.encodeI('JALR', 1, 1, lower));
        return true;
      }

      case 'TAIL': {
        // AUIPC t1, upper; JALR x0, lower(t1)
        const labelAddr = this.symbols.get(node.label!);
        if (labelAddr === undefined) {
          this.errors.push({
            message: `Undefined label '${node.label}'`,
            line: node.line,
            column: node.column,
          });
          this.emit32(0);
          this.emit32(0);
          return true;
        }
        const offset = labelAddr - this.pc;
        const upper = ((offset + 0x800) >> 12) & 0xfffff;
        const lower = offset - (upper << 12);
        this.emit32(Encoder.encodeU('AUIPC', 6, upper)); // t1 = x6
        this.emit32(Encoder.encodeI('JALR', 0, 6, lower));
        return true;
      }

      case 'BEQZ': {
        // BEQ rs1, x0, offset
        let offset = node.imm ?? 0;
        if (node.label) {
          const labelAddr = this.symbols.get(node.label);
          if (labelAddr === undefined) {
            this.errors.push({
              message: `Undefined label '${node.label}'`,
              line: node.line,
              column: node.column,
            });
            this.emit32(0);
            return true;
          }
          offset = labelAddr - this.pc;
        }
        this.emit32(Encoder.encodeB('BEQ', node.rs1!, 0, offset));
        return true;
      }

      case 'BNEZ': {
        // BNE rs1, x0, offset
        let offset = node.imm ?? 0;
        if (node.label) {
          const labelAddr = this.symbols.get(node.label);
          if (labelAddr === undefined) {
            this.errors.push({
              message: `Undefined label '${node.label}'`,
              line: node.line,
              column: node.column,
            });
            this.emit32(0);
            return true;
          }
          offset = labelAddr - this.pc;
        }
        this.emit32(Encoder.encodeB('BNE', node.rs1!, 0, offset));
        return true;
      }

      default:
        return false;
    }
  }

  private emit8(value: number): void {
    // Pad output if necessary
    while (this.output.length < this.pc) {
      this.output.push(0);
    }
    this.output.push(value & 0xff);
    this.pc++;
  }

  private emit16(value: number): void {
    this.emit8(value & 0xff);
    this.emit8((value >> 8) & 0xff);
  }

  private emit32(value: number): void {
    this.emit8(value & 0xff);
    this.emit8((value >> 8) & 0xff);
    this.emit8((value >> 16) & 0xff);
    this.emit8((value >> 24) & 0xff);
  }
}
