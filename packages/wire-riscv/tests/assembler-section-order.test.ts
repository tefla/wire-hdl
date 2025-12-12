import { describe, it } from 'vitest';
import { NativeAssembler } from '../src/emulator/native-assembler.js';

describe('Assembler Section Order', () => {
  it('should output .text before .data when .text comes first', () => {
    const asm = new NativeAssembler();

    const code = asm.assemble(`
        .text
        main:
          ADDI a0, zero, 42
          ECALL
        .data
        msg: .string "Hello"
`);

    console.log('Total bytes:', code.length);
    console.log('First 20 bytes (hex):', Array.from(code.slice(0, 20)).map(b =>
      b.toString(16).padStart(2, '0')
    ).join(' '));
    console.log('First 20 bytes (ascii):', Array.from(code.slice(0, 20)).map(b =>
      (b >= 0x20 && b < 0x7F) ? String.fromCharCode(b) : '.'
    ).join(''));

    // ADDI a0, zero, 42 = 0x02A00513
    // Should be: 13 05 A0 02 (little endian)
    console.log('\nExpected: 13 05 a0 02 (ADDI a0, zero, 42)');
    console.log('Got:     ', code.slice(0, 4).map(b => b.toString(16).padStart(2, '0')).join(' '));
  });

  it('should output .data before .text when .data comes first', () => {
    const asm = new NativeAssembler();

    const code = asm.assemble(`
        .data
        msg: .string "Hello"
        .text
        main:
          ADDI a0, zero, 42
          ECALL
`);

    console.log('\n=== Data first ===');
    console.log('Total bytes:', code.length);
    console.log('First 20 bytes (hex):', Array.from(code.slice(0, 20)).map(b =>
      b.toString(16).padStart(2, '0')
    ).join(' '));
    console.log('First 20 bytes (ascii):', Array.from(code.slice(0, 20)).map(b =>
      (b >= 0x20 && b < 0x7F) ? String.fromCharCode(b) : '.'
    ).join(''));

    // Should start with "Hello\0" = 48 65 6c 6c 6f 00
    console.log('\nExpected: 48 65 6c 6c 6f 00 (Hello)');
    console.log('Got:     ', code.slice(0, 6).map(b => b.toString(16).padStart(2, '0')).join(' '));
  });
});
