import { describe, it, expect } from 'vitest';
import { Parser, InstructionType, NodeType } from '../../src/assembler/parser.js';

describe('Parser', () => {
  describe('empty input', () => {
    it('should parse empty source', () => {
      const parser = new Parser('');
      const ast = parser.parse();
      expect(ast.statements).toHaveLength(0);
    });

    it('should parse whitespace-only source', () => {
      const parser = new Parser('   \n\n   ');
      const ast = parser.parse();
      expect(ast.statements).toHaveLength(0);
    });

    it('should parse comment-only source', () => {
      const parser = new Parser('; just a comment\n# another comment');
      const ast = parser.parse();
      expect(ast.statements).toHaveLength(0);
    });
  });

  describe('R-type instructions', () => {
    it('should parse ADD instruction', () => {
      const parser = new Parser('ADD x1, x2, x3');
      const ast = parser.parse();
      expect(ast.statements).toHaveLength(1);
      const stmt = ast.statements[0];
      expect(stmt.type).toBe(NodeType.INSTRUCTION);
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('ADD');
        expect(stmt.instructionType).toBe(InstructionType.R);
        expect(stmt.rd).toBe(1);
        expect(stmt.rs1).toBe(2);
        expect(stmt.rs2).toBe(3);
      }
    });

    it('should parse SUB instruction', () => {
      const parser = new Parser('SUB x3, x1, x2');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('SUB');
        expect(stmt.instructionType).toBe(InstructionType.R);
        expect(stmt.rd).toBe(3);
        expect(stmt.rs1).toBe(1);
        expect(stmt.rs2).toBe(2);
      }
    });

    it('should parse AND instruction', () => {
      const parser = new Parser('AND x4, x5, x6');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('AND');
        expect(stmt.rd).toBe(4);
        expect(stmt.rs1).toBe(5);
        expect(stmt.rs2).toBe(6);
      }
    });

    it('should parse OR instruction', () => {
      const parser = new Parser('OR a0, a1, a2');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('OR');
        expect(stmt.rd).toBe(10); // a0
        expect(stmt.rs1).toBe(11); // a1
        expect(stmt.rs2).toBe(12); // a2
      }
    });

    it('should parse XOR instruction', () => {
      const parser = new Parser('XOR t0, t1, t2');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('XOR');
        expect(stmt.rd).toBe(5); // t0
        expect(stmt.rs1).toBe(6); // t1
        expect(stmt.rs2).toBe(7); // t2
      }
    });

    it('should parse SLL instruction', () => {
      const parser = new Parser('SLL x1, x2, x3');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('SLL');
      }
    });

    it('should parse SRL instruction', () => {
      const parser = new Parser('SRL x1, x2, x3');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('SRL');
      }
    });

    it('should parse SRA instruction', () => {
      const parser = new Parser('SRA x1, x2, x3');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('SRA');
      }
    });

    it('should parse SLT instruction', () => {
      const parser = new Parser('SLT x1, x2, x3');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('SLT');
      }
    });

    it('should parse SLTU instruction', () => {
      const parser = new Parser('SLTU x1, x2, x3');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('SLTU');
      }
    });
  });

  describe('I-type ALU instructions', () => {
    it('should parse ADDI instruction', () => {
      const parser = new Parser('ADDI x1, x2, 100');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('ADDI');
        expect(stmt.instructionType).toBe(InstructionType.I);
        expect(stmt.rd).toBe(1);
        expect(stmt.rs1).toBe(2);
        expect(stmt.imm).toBe(100);
      }
    });

    it('should parse ADDI with negative immediate', () => {
      const parser = new Parser('ADDI x1, x0, -1');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.imm).toBe(-1);
      }
    });

    it('should parse ADDI with hex immediate', () => {
      const parser = new Parser('ADDI x1, x0, 0xFF');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.imm).toBe(255);
      }
    });

    it('should parse SLTI instruction', () => {
      const parser = new Parser('SLTI x1, x2, 50');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('SLTI');
        expect(stmt.imm).toBe(50);
      }
    });

    it('should parse SLTIU instruction', () => {
      const parser = new Parser('SLTIU x1, x2, 50');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('SLTIU');
      }
    });

    it('should parse XORI instruction', () => {
      const parser = new Parser('XORI x1, x2, 0xFF');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('XORI');
        expect(stmt.imm).toBe(255);
      }
    });

    it('should parse ORI instruction', () => {
      const parser = new Parser('ORI x1, x2, 0x0F');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('ORI');
      }
    });

    it('should parse ANDI instruction', () => {
      const parser = new Parser('ANDI x1, x2, 0xFF');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('ANDI');
      }
    });

    it('should parse SLLI instruction', () => {
      const parser = new Parser('SLLI x1, x2, 4');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('SLLI');
        expect(stmt.imm).toBe(4);
      }
    });

    it('should parse SRLI instruction', () => {
      const parser = new Parser('SRLI x1, x2, 4');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('SRLI');
      }
    });

    it('should parse SRAI instruction', () => {
      const parser = new Parser('SRAI x1, x2, 4');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('SRAI');
      }
    });
  });

  describe('Load instructions (I-type)', () => {
    it('should parse LW with offset(base) syntax', () => {
      const parser = new Parser('LW x1, 4(x2)');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('LW');
        expect(stmt.instructionType).toBe(InstructionType.I);
        expect(stmt.rd).toBe(1);
        expect(stmt.rs1).toBe(2);
        expect(stmt.imm).toBe(4);
      }
    });

    it('should parse LW with zero offset', () => {
      const parser = new Parser('LW x1, 0(x2)');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.imm).toBe(0);
      }
    });

    it('should parse LW with negative offset', () => {
      const parser = new Parser('LW x1, -4(x2)');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.imm).toBe(-4);
      }
    });

    it('should parse LB instruction', () => {
      const parser = new Parser('LB x1, 0(x2)');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('LB');
      }
    });

    it('should parse LH instruction', () => {
      const parser = new Parser('LH x1, 2(x2)');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('LH');
      }
    });

    it('should parse LBU instruction', () => {
      const parser = new Parser('LBU x1, 0(x2)');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('LBU');
      }
    });

    it('should parse LHU instruction', () => {
      const parser = new Parser('LHU x1, 0(x2)');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('LHU');
      }
    });
  });

  describe('Store instructions (S-type)', () => {
    it('should parse SW instruction', () => {
      const parser = new Parser('SW x1, 4(x2)');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('SW');
        expect(stmt.instructionType).toBe(InstructionType.S);
        expect(stmt.rs2).toBe(1); // source register
        expect(stmt.rs1).toBe(2); // base register
        expect(stmt.imm).toBe(4);
      }
    });

    it('should parse SW with negative offset', () => {
      const parser = new Parser('SW x1, -8(sp)');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.rs1).toBe(2); // sp
        expect(stmt.imm).toBe(-8);
      }
    });

    it('should parse SB instruction', () => {
      const parser = new Parser('SB x1, 0(x2)');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('SB');
      }
    });

    it('should parse SH instruction', () => {
      const parser = new Parser('SH x1, 2(x2)');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('SH');
      }
    });
  });

  describe('Branch instructions (B-type)', () => {
    it('should parse BEQ with numeric offset', () => {
      const parser = new Parser('BEQ x1, x2, 8');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('BEQ');
        expect(stmt.instructionType).toBe(InstructionType.B);
        expect(stmt.rs1).toBe(1);
        expect(stmt.rs2).toBe(2);
        expect(stmt.imm).toBe(8);
      }
    });

    it('should parse BEQ with label', () => {
      const parser = new Parser('BEQ x1, x2, loop');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('BEQ');
        expect(stmt.label).toBe('loop');
      }
    });

    it('should parse BNE instruction', () => {
      const parser = new Parser('BNE x1, x2, 12');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('BNE');
      }
    });

    it('should parse BLT instruction', () => {
      const parser = new Parser('BLT x1, x2, skip');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('BLT');
      }
    });

    it('should parse BGE instruction', () => {
      const parser = new Parser('BGE x1, x2, done');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('BGE');
      }
    });

    it('should parse BLTU instruction', () => {
      const parser = new Parser('BLTU x1, x2, 8');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('BLTU');
      }
    });

    it('should parse BGEU instruction', () => {
      const parser = new Parser('BGEU x1, x2, 8');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('BGEU');
      }
    });
  });

  describe('U-type instructions', () => {
    it('should parse LUI instruction', () => {
      const parser = new Parser('LUI x1, 0x12345');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('LUI');
        expect(stmt.instructionType).toBe(InstructionType.U);
        expect(stmt.rd).toBe(1);
        expect(stmt.imm).toBe(0x12345);
      }
    });

    it('should parse AUIPC instruction', () => {
      const parser = new Parser('AUIPC x1, 0x12345');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('AUIPC');
        expect(stmt.instructionType).toBe(InstructionType.U);
      }
    });
  });

  describe('J-type instructions', () => {
    it('should parse JAL with offset', () => {
      const parser = new Parser('JAL x1, 100');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('JAL');
        expect(stmt.instructionType).toBe(InstructionType.J);
        expect(stmt.rd).toBe(1);
        expect(stmt.imm).toBe(100);
      }
    });

    it('should parse JAL with label', () => {
      const parser = new Parser('JAL ra, main');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('JAL');
        expect(stmt.rd).toBe(1); // ra
        expect(stmt.label).toBe('main');
      }
    });
  });

  describe('JALR instruction', () => {
    it('should parse JALR with offset(base)', () => {
      const parser = new Parser('JALR x1, 4(x2)');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('JALR');
        expect(stmt.instructionType).toBe(InstructionType.I);
        expect(stmt.rd).toBe(1);
        expect(stmt.rs1).toBe(2);
        expect(stmt.imm).toBe(4);
      }
    });

    it('should parse JALR with 0(base)', () => {
      const parser = new Parser('JALR x1, 0(x2)');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.imm).toBe(0);
      }
    });
  });

  describe('System instructions', () => {
    it('should parse ECALL', () => {
      const parser = new Parser('ECALL');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('ECALL');
        expect(stmt.instructionType).toBe(InstructionType.I);
      }
    });

    it('should parse EBREAK', () => {
      const parser = new Parser('EBREAK');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('EBREAK');
      }
    });

    it('should parse FENCE', () => {
      const parser = new Parser('FENCE');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('FENCE');
      }
    });
  });

  describe('Pseudo-instructions', () => {
    it('should parse NOP', () => {
      const parser = new Parser('NOP');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('NOP');
      }
    });

    it('should parse LI with small immediate', () => {
      const parser = new Parser('LI x1, 42');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('LI');
        expect(stmt.rd).toBe(1);
        expect(stmt.imm).toBe(42);
      }
    });

    it('should parse LI with large immediate', () => {
      const parser = new Parser('LI x1, 0x12345678');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.imm).toBe(0x12345678);
      }
    });

    it('should parse MV instruction', () => {
      const parser = new Parser('MV x1, x2');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('MV');
        expect(stmt.rd).toBe(1);
        expect(stmt.rs1).toBe(2);
      }
    });

    it('should parse J instruction', () => {
      const parser = new Parser('J loop');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('J');
        expect(stmt.label).toBe('loop');
      }
    });

    it('should parse RET instruction', () => {
      const parser = new Parser('RET');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('RET');
      }
    });

    it('should parse CALL instruction', () => {
      const parser = new Parser('CALL func');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.INSTRUCTION) {
        expect(stmt.mnemonic).toBe('CALL');
        expect(stmt.label).toBe('func');
      }
    });
  });

  describe('Label definitions', () => {
    it('should parse label definition', () => {
      const parser = new Parser('main:');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      expect(stmt.type).toBe(NodeType.LABEL);
      if (stmt.type === NodeType.LABEL) {
        expect(stmt.name).toBe('main');
      }
    });

    it('should parse label with instruction on same line', () => {
      const parser = new Parser('loop: ADD x1, x2, x3');
      const ast = parser.parse();
      expect(ast.statements).toHaveLength(2);
      expect(ast.statements[0].type).toBe(NodeType.LABEL);
      expect(ast.statements[1].type).toBe(NodeType.INSTRUCTION);
    });

    it('should parse multiple labels', () => {
      const parser = new Parser(`
main:
    NOP
loop:
    ADD x1, x2, x3
`);
      const ast = parser.parse();
      const labels = ast.statements.filter(s => s.type === NodeType.LABEL);
      expect(labels).toHaveLength(2);
    });
  });

  describe('Directives', () => {
    it('should parse .org directive', () => {
      const parser = new Parser('.org 0x1000');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      expect(stmt.type).toBe(NodeType.DIRECTIVE);
      if (stmt.type === NodeType.DIRECTIVE) {
        expect(stmt.name).toBe('.ORG');
        expect(stmt.args).toEqual([0x1000]);
      }
    });

    it('should parse .byte directive with single value', () => {
      const parser = new Parser('.byte 0x42');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.DIRECTIVE) {
        expect(stmt.name).toBe('.BYTE');
        expect(stmt.args).toEqual([0x42]);
      }
    });

    it('should parse .byte directive with multiple values', () => {
      const parser = new Parser('.byte 1, 2, 3, 4');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.DIRECTIVE) {
        expect(stmt.args).toEqual([1, 2, 3, 4]);
      }
    });

    it('should parse .half directive', () => {
      const parser = new Parser('.half 0x1234');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.DIRECTIVE) {
        expect(stmt.name).toBe('.HALF');
        expect(stmt.args).toEqual([0x1234]);
      }
    });

    it('should parse .word directive', () => {
      const parser = new Parser('.word 0xDEADBEEF');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.DIRECTIVE) {
        expect(stmt.name).toBe('.WORD');
        expect(stmt.args).toEqual([0xDEADBEEF]);
      }
    });

    it('should parse .word directive with multiple values', () => {
      const parser = new Parser('.word 1, 2, 3');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.DIRECTIVE) {
        expect(stmt.args).toEqual([1, 2, 3]);
      }
    });

    it('should parse .ascii directive', () => {
      const parser = new Parser('.ascii "Hello"');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.DIRECTIVE) {
        expect(stmt.name).toBe('.ASCII');
        expect(stmt.args).toEqual(['Hello']);
      }
    });

    it('should parse .asciiz directive', () => {
      const parser = new Parser('.asciiz "Hello"');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.DIRECTIVE) {
        expect(stmt.name).toBe('.ASCIIZ');
        expect(stmt.args).toEqual(['Hello']);
      }
    });

    it('should parse .align directive', () => {
      const parser = new Parser('.align 4');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.DIRECTIVE) {
        expect(stmt.name).toBe('.ALIGN');
        expect(stmt.args).toEqual([4]);
      }
    });

    it('should parse .space directive', () => {
      const parser = new Parser('.space 100');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.DIRECTIVE) {
        expect(stmt.name).toBe('.SPACE');
        expect(stmt.args).toEqual([100]);
      }
    });

    it('should parse .equ directive', () => {
      const parser = new Parser('.equ BUFFER_SIZE, 256');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.DIRECTIVE) {
        expect(stmt.name).toBe('.EQU');
        expect(stmt.args[0]).toBe('BUFFER_SIZE');
        expect(stmt.args[1]).toBe(256);
      }
    });

    it('should parse .global directive', () => {
      const parser = new Parser('.global main');
      const ast = parser.parse();
      const stmt = ast.statements[0];
      if (stmt.type === NodeType.DIRECTIVE) {
        expect(stmt.name).toBe('.GLOBAL');
        expect(stmt.args).toEqual(['main']);
      }
    });
  });

  describe('Complex programs', () => {
    it('should parse a simple program', () => {
      const program = `
.org 0x0000

_start:
    ADDI x1, x0, 5
    ADDI x2, x0, 10
    ADD x3, x1, x2
    ECALL
`;
      const parser = new Parser(program);
      const ast = parser.parse();

      const labels = ast.statements.filter(s => s.type === NodeType.LABEL);
      const instructions = ast.statements.filter(s => s.type === NodeType.INSTRUCTION);
      const directives = ast.statements.filter(s => s.type === NodeType.DIRECTIVE);

      expect(labels).toHaveLength(1);
      expect(instructions).toHaveLength(4);
      expect(directives).toHaveLength(1);
    });

    it('should parse a loop program', () => {
      const program = `
    LI x1, 10
loop:
    ADDI x1, x1, -1
    BNE x1, x0, loop
    EBREAK
`;
      const parser = new Parser(program);
      const ast = parser.parse();
      expect(ast.statements.length).toBeGreaterThan(3);
    });
  });

  describe('Error handling', () => {
    it('should error on missing operand', () => {
      const parser = new Parser('ADD x1, x2');
      expect(() => parser.parse()).toThrow();
    });

    it('should error on invalid register', () => {
      const parser = new Parser('ADD x99, x2, x3');
      expect(() => parser.parse()).toThrow();
    });

    it('should error on missing comma', () => {
      const parser = new Parser('ADD x1 x2, x3');
      expect(() => parser.parse()).toThrow();
    });

    it('should include line number in error', () => {
      const parser = new Parser('NOP\nADD x1, x2');
      try {
        parser.parse();
        expect.fail('Should have thrown');
      } catch (e: unknown) {
        expect((e as Error).message).toMatch(/line 2/i);
      }
    });
  });

  describe('Source location tracking', () => {
    it('should track line numbers on statements', () => {
      const program = `NOP
ADD x1, x2, x3
SUB x4, x5, x6`;
      const parser = new Parser(program);
      const ast = parser.parse();

      expect(ast.statements[0].line).toBe(1);
      expect(ast.statements[1].line).toBe(2);
      expect(ast.statements[2].line).toBe(3);
    });
  });
});
