import { describe, it, expect } from 'vitest';
import { Lexer, TokenType, Token } from '../../src/assembler/lexer.js';

describe('Lexer', () => {
  describe('basic tokenization', () => {
    it('should tokenize an empty string', () => {
      const lexer = new Lexer('');
      const tokens = lexer.tokenize();
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe(TokenType.EOF);
    });

    it('should skip whitespace', () => {
      const lexer = new Lexer('   \t   ');
      const tokens = lexer.tokenize();
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe(TokenType.EOF);
    });

    it('should handle newlines', () => {
      const lexer = new Lexer('\n\n');
      const tokens = lexer.tokenize();
      expect(tokens.filter(t => t.type === TokenType.NEWLINE)).toHaveLength(2);
    });
  });

  describe('comments', () => {
    it('should skip semicolon comments', () => {
      const lexer = new Lexer('; this is a comment');
      const tokens = lexer.tokenize();
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe(TokenType.EOF);
    });

    it('should skip hash comments', () => {
      const lexer = new Lexer('# this is a comment');
      const tokens = lexer.tokenize();
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe(TokenType.EOF);
    });

    it('should handle inline comments', () => {
      const lexer = new Lexer('ADD x1, x2, x3 ; add registers');
      const tokens = lexer.tokenize();
      const nonEof = tokens.filter(t => t.type !== TokenType.EOF);
      expect(nonEof.some(t => t.value === 'ADD')).toBe(true);
      expect(nonEof.some(t => t.value === 'add')).toBe(false); // comment not tokenized
    });
  });

  describe('instructions', () => {
    it('should tokenize instruction mnemonics', () => {
      const lexer = new Lexer('ADD');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.INSTRUCTION);
      expect(tokens[0].value).toBe('ADD');
    });

    it('should tokenize lowercase instructions', () => {
      const lexer = new Lexer('add');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.INSTRUCTION);
      expect(tokens[0].value).toBe('ADD'); // Should be normalized to uppercase
    });

    it('should recognize all RV32I instructions', () => {
      const instructions = [
        'LUI', 'AUIPC', 'JAL', 'JALR',
        'BEQ', 'BNE', 'BLT', 'BGE', 'BLTU', 'BGEU',
        'LB', 'LH', 'LW', 'LBU', 'LHU',
        'SB', 'SH', 'SW',
        'ADDI', 'SLTI', 'SLTIU', 'XORI', 'ORI', 'ANDI', 'SLLI', 'SRLI', 'SRAI',
        'ADD', 'SUB', 'SLL', 'SLT', 'SLTU', 'XOR', 'SRL', 'SRA', 'OR', 'AND',
        'ECALL', 'EBREAK', 'FENCE',
      ];
      for (const instr of instructions) {
        const lexer = new Lexer(instr);
        const tokens = lexer.tokenize();
        expect(tokens[0].type).toBe(TokenType.INSTRUCTION);
        expect(tokens[0].value).toBe(instr);
      }
    });

    it('should recognize pseudo-instructions', () => {
      const pseudoInstructions = ['NOP', 'LI', 'LA', 'MV', 'NOT', 'NEG', 'J', 'JR', 'RET', 'CALL'];
      for (const instr of pseudoInstructions) {
        const lexer = new Lexer(instr);
        const tokens = lexer.tokenize();
        expect(tokens[0].type).toBe(TokenType.INSTRUCTION);
      }
    });
  });

  describe('registers', () => {
    it('should tokenize numeric registers x0-x31', () => {
      for (let i = 0; i <= 31; i++) {
        const lexer = new Lexer(`x${i}`);
        const tokens = lexer.tokenize();
        expect(tokens[0].type).toBe(TokenType.REGISTER);
        expect(tokens[0].value).toBe(i);
      }
    });

    it('should tokenize zero register alias', () => {
      const lexer = new Lexer('zero');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.REGISTER);
      expect(tokens[0].value).toBe(0);
    });

    it('should tokenize ra (return address) register', () => {
      const lexer = new Lexer('ra');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.REGISTER);
      expect(tokens[0].value).toBe(1);
    });

    it('should tokenize sp (stack pointer) register', () => {
      const lexer = new Lexer('sp');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.REGISTER);
      expect(tokens[0].value).toBe(2);
    });

    it('should tokenize gp (global pointer) register', () => {
      const lexer = new Lexer('gp');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.REGISTER);
      expect(tokens[0].value).toBe(3);
    });

    it('should tokenize tp (thread pointer) register', () => {
      const lexer = new Lexer('tp');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.REGISTER);
      expect(tokens[0].value).toBe(4);
    });

    it('should tokenize temporary registers t0-t6', () => {
      const expected = [5, 6, 7, 28, 29, 30, 31];
      for (let i = 0; i <= 6; i++) {
        const lexer = new Lexer(`t${i}`);
        const tokens = lexer.tokenize();
        expect(tokens[0].type).toBe(TokenType.REGISTER);
        expect(tokens[0].value).toBe(expected[i]);
      }
    });

    it('should tokenize saved registers s0-s11', () => {
      const expected = [8, 9, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27];
      for (let i = 0; i <= 11; i++) {
        const lexer = new Lexer(`s${i}`);
        const tokens = lexer.tokenize();
        expect(tokens[0].type).toBe(TokenType.REGISTER);
        expect(tokens[0].value).toBe(expected[i]);
      }
    });

    it('should tokenize argument registers a0-a7', () => {
      const expected = [10, 11, 12, 13, 14, 15, 16, 17];
      for (let i = 0; i <= 7; i++) {
        const lexer = new Lexer(`a${i}`);
        const tokens = lexer.tokenize();
        expect(tokens[0].type).toBe(TokenType.REGISTER);
        expect(tokens[0].value).toBe(expected[i]);
      }
    });

    it('should tokenize fp (frame pointer, alias for s0)', () => {
      const lexer = new Lexer('fp');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.REGISTER);
      expect(tokens[0].value).toBe(8);
    });
  });

  describe('numeric literals', () => {
    it('should tokenize decimal numbers', () => {
      const lexer = new Lexer('42');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].value).toBe(42);
    });

    it('should tokenize negative decimal numbers', () => {
      const lexer = new Lexer('-42');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].value).toBe(-42);
    });

    it('should tokenize hexadecimal numbers with 0x prefix', () => {
      const lexer = new Lexer('0x2A');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].value).toBe(42);
    });

    it('should tokenize hexadecimal numbers with 0X prefix', () => {
      const lexer = new Lexer('0X2a');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].value).toBe(42);
    });

    it('should tokenize binary numbers with 0b prefix', () => {
      const lexer = new Lexer('0b101010');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].value).toBe(42);
    });

    it('should tokenize binary numbers with 0B prefix', () => {
      const lexer = new Lexer('0B101010');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].value).toBe(42);
    });

    it('should tokenize zero', () => {
      const lexer = new Lexer('0');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].value).toBe(0);
    });

    it('should tokenize large hex numbers', () => {
      const lexer = new Lexer('0xDEADBEEF');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].value).toBe(0xDEADBEEF);
    });
  });

  describe('labels', () => {
    it('should tokenize label definitions', () => {
      const lexer = new Lexer('main:');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.LABEL_DEF);
      expect(tokens[0].value).toBe('main');
    });

    it('should tokenize labels with underscores', () => {
      const lexer = new Lexer('_start:');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.LABEL_DEF);
      expect(tokens[0].value).toBe('_start');
    });

    it('should tokenize labels with numbers', () => {
      const lexer = new Lexer('loop1:');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.LABEL_DEF);
      expect(tokens[0].value).toBe('loop1');
    });

    it('should tokenize label references (identifiers)', () => {
      const lexer = new Lexer('JAL ra, main');
      const tokens = lexer.tokenize();
      const identToken = tokens.find(t => t.type === TokenType.IDENTIFIER);
      expect(identToken).toBeDefined();
      expect(identToken!.value).toBe('main');
    });
  });

  describe('directives', () => {
    it('should tokenize .org directive', () => {
      const lexer = new Lexer('.org');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.DIRECTIVE);
      expect(tokens[0].value).toBe('.ORG');
    });

    it('should tokenize .byte directive', () => {
      const lexer = new Lexer('.byte');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.DIRECTIVE);
      expect(tokens[0].value).toBe('.BYTE');
    });

    it('should tokenize .half directive', () => {
      const lexer = new Lexer('.half');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.DIRECTIVE);
      expect(tokens[0].value).toBe('.HALF');
    });

    it('should tokenize .word directive', () => {
      const lexer = new Lexer('.word');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.DIRECTIVE);
      expect(tokens[0].value).toBe('.WORD');
    });

    it('should tokenize .ascii directive', () => {
      const lexer = new Lexer('.ascii');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.DIRECTIVE);
      expect(tokens[0].value).toBe('.ASCII');
    });

    it('should tokenize .asciiz directive', () => {
      const lexer = new Lexer('.asciiz');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.DIRECTIVE);
      expect(tokens[0].value).toBe('.ASCIIZ');
    });

    it('should tokenize .string directive', () => {
      const lexer = new Lexer('.string');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.DIRECTIVE);
      expect(tokens[0].value).toBe('.STRING');
    });

    it('should tokenize .align directive', () => {
      const lexer = new Lexer('.align');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.DIRECTIVE);
      expect(tokens[0].value).toBe('.ALIGN');
    });

    it('should tokenize .space directive', () => {
      const lexer = new Lexer('.space');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.DIRECTIVE);
      expect(tokens[0].value).toBe('.SPACE');
    });

    it('should tokenize .equ directive', () => {
      const lexer = new Lexer('.equ');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.DIRECTIVE);
      expect(tokens[0].value).toBe('.EQU');
    });

    it('should tokenize .global directive', () => {
      const lexer = new Lexer('.global');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.DIRECTIVE);
      expect(tokens[0].value).toBe('.GLOBAL');
    });

    it('should tokenize .section directive', () => {
      const lexer = new Lexer('.section');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.DIRECTIVE);
      expect(tokens[0].value).toBe('.SECTION');
    });
  });

  describe('string literals', () => {
    it('should tokenize simple strings', () => {
      const lexer = new Lexer('"Hello"');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.STRING);
      expect(tokens[0].value).toBe('Hello');
    });

    it('should tokenize strings with spaces', () => {
      const lexer = new Lexer('"Hello World"');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.STRING);
      expect(tokens[0].value).toBe('Hello World');
    });

    it('should handle escape sequences', () => {
      const lexer = new Lexer('"Hello\\nWorld"');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.STRING);
      expect(tokens[0].value).toBe('Hello\nWorld');
    });

    it('should handle tab escape', () => {
      const lexer = new Lexer('"A\\tB"');
      const tokens = lexer.tokenize();
      expect(tokens[0].value).toBe('A\tB');
    });

    it('should handle carriage return escape', () => {
      const lexer = new Lexer('"A\\rB"');
      const tokens = lexer.tokenize();
      expect(tokens[0].value).toBe('A\rB');
    });

    it('should handle escaped backslash', () => {
      const lexer = new Lexer('"A\\\\B"');
      const tokens = lexer.tokenize();
      expect(tokens[0].value).toBe('A\\B');
    });

    it('should handle escaped quote', () => {
      const lexer = new Lexer('"Say \\"Hi\\""');
      const tokens = lexer.tokenize();
      expect(tokens[0].value).toBe('Say "Hi"');
    });

    it('should handle null escape', () => {
      const lexer = new Lexer('"End\\0"');
      const tokens = lexer.tokenize();
      expect(tokens[0].value).toBe('End\0');
    });

    it('should tokenize empty strings', () => {
      const lexer = new Lexer('""');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.STRING);
      expect(tokens[0].value).toBe('');
    });
  });

  describe('operators and punctuation', () => {
    it('should tokenize comma', () => {
      const lexer = new Lexer(',');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.COMMA);
    });

    it('should tokenize left parenthesis', () => {
      const lexer = new Lexer('(');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.LPAREN);
    });

    it('should tokenize right parenthesis', () => {
      const lexer = new Lexer(')');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.RPAREN);
    });
  });

  describe('complex expressions', () => {
    it('should tokenize a complete R-type instruction', () => {
      const lexer = new Lexer('ADD x1, x2, x3');
      const tokens = lexer.tokenize();
      const types = tokens.map(t => t.type);
      expect(types).toContain(TokenType.INSTRUCTION);
      expect(types).toContain(TokenType.REGISTER);
      expect(types).toContain(TokenType.COMMA);
    });

    it('should tokenize a complete I-type instruction', () => {
      const lexer = new Lexer('ADDI x1, x2, 100');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.INSTRUCTION);
      expect(tokens[0].value).toBe('ADDI');
      expect(tokens[1].type).toBe(TokenType.REGISTER);
      expect(tokens[1].value).toBe(1);
      expect(tokens[2].type).toBe(TokenType.COMMA);
      expect(tokens[3].type).toBe(TokenType.REGISTER);
      expect(tokens[3].value).toBe(2);
      expect(tokens[4].type).toBe(TokenType.COMMA);
      expect(tokens[5].type).toBe(TokenType.NUMBER);
      expect(tokens[5].value).toBe(100);
    });

    it('should tokenize memory addressing syntax', () => {
      const lexer = new Lexer('LW x1, 4(x2)');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.INSTRUCTION);
      expect(tokens[1].type).toBe(TokenType.REGISTER);
      expect(tokens[2].type).toBe(TokenType.COMMA);
      expect(tokens[3].type).toBe(TokenType.NUMBER);
      expect(tokens[3].value).toBe(4);
      expect(tokens[4].type).toBe(TokenType.LPAREN);
      expect(tokens[5].type).toBe(TokenType.REGISTER);
      expect(tokens[6].type).toBe(TokenType.RPAREN);
    });

    it('should tokenize a directive with argument', () => {
      const lexer = new Lexer('.org 0x1000');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.DIRECTIVE);
      expect(tokens[0].value).toBe('.ORG');
      expect(tokens[1].type).toBe(TokenType.NUMBER);
      expect(tokens[1].value).toBe(0x1000);
    });

    it('should tokenize .word with multiple values', () => {
      const lexer = new Lexer('.word 1, 2, 3, 0xDEAD');
      const tokens = lexer.tokenize();
      const numbers = tokens.filter(t => t.type === TokenType.NUMBER);
      expect(numbers).toHaveLength(4);
      expect(numbers[0].value).toBe(1);
      expect(numbers[1].value).toBe(2);
      expect(numbers[2].value).toBe(3);
      expect(numbers[3].value).toBe(0xDEAD);
    });

    it('should tokenize .ascii with string', () => {
      const lexer = new Lexer('.ascii "Hello"');
      const tokens = lexer.tokenize();
      expect(tokens[0].type).toBe(TokenType.DIRECTIVE);
      expect(tokens[1].type).toBe(TokenType.STRING);
      expect(tokens[1].value).toBe('Hello');
    });
  });

  describe('line and column tracking', () => {
    it('should track line numbers', () => {
      const lexer = new Lexer('ADD\nSUB\nAND');
      const tokens = lexer.tokenize();
      const instructions = tokens.filter(t => t.type === TokenType.INSTRUCTION);
      expect(instructions[0].line).toBe(1);
      expect(instructions[1].line).toBe(2);
      expect(instructions[2].line).toBe(3);
    });

    it('should track column numbers', () => {
      const lexer = new Lexer('ADD x1, x2, x3');
      const tokens = lexer.tokenize();
      expect(tokens[0].column).toBe(1); // ADD
      expect(tokens[1].column).toBe(5); // x1
    });

    it('should reset column on newline', () => {
      const lexer = new Lexer('ADD\n  SUB');
      const tokens = lexer.tokenize();
      const instructions = tokens.filter(t => t.type === TokenType.INSTRUCTION);
      expect(instructions[1].column).toBe(3); // SUB after 2 spaces
    });
  });

  describe('error handling', () => {
    it('should error on unterminated string', () => {
      const lexer = new Lexer('"unterminated');
      expect(() => lexer.tokenize()).toThrow(/unterminated string/i);
    });

    it('should error on invalid character', () => {
      const lexer = new Lexer('@');
      expect(() => lexer.tokenize()).toThrow(/unexpected character/i);
    });

    it('should include line number in error', () => {
      const lexer = new Lexer('ADD\n@');
      try {
        lexer.tokenize();
        expect.fail('Should have thrown');
      } catch (e: unknown) {
        expect((e as Error).message).toMatch(/line 2/i);
      }
    });
  });

  describe('full program tokenization', () => {
    it('should tokenize a complete assembly program', () => {
      const program = `
; RISC-V Hello CPU
.org 0x0000

_start:
    li x1, 42      ; Load immediate
    addi x2, x1, 1 ; x2 = 43
    ebreak         ; Stop

.org 0x0100
message:
    .asciiz "Hello"
`;
      const lexer = new Lexer(program);
      const tokens = lexer.tokenize();

      // Should have tokenized without errors
      expect(tokens.length).toBeGreaterThan(10);

      // Check key tokens are present
      const types = tokens.map(t => t.type);
      expect(types).toContain(TokenType.DIRECTIVE);
      expect(types).toContain(TokenType.LABEL_DEF);
      expect(types).toContain(TokenType.INSTRUCTION);
      expect(types).toContain(TokenType.REGISTER);
      expect(types).toContain(TokenType.NUMBER);
      expect(types).toContain(TokenType.STRING);
    });
  });
});
