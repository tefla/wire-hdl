import { describe, it } from 'vitest';
import { NativeAssembler } from '../src/emulator/native-assembler.js';
import { ExecutableBuilder } from '../src/emulator/program-loader.js';

describe('Debug EDIT Structure', () => {
  it('should show where code starts', () => {
    const asm = new NativeAssembler();

    const editCode = asm.assemble(`
; EDIT - Simple text viewer
        .data
        line1: .string "Line 1: Test"
        msg:   .string "EDIT"

        .text
        main:
          LUI a0, 0x1
          ADDI a7, zero, 3    ; PUTS
          ECALL
          ADDI a7, zero, 0    ; EXIT
          ECALL
`);

    console.log('=== Assembled Code ===');
    console.log('Code bytes:', editCode.length);
    console.log('First 40 bytes:', Array.from(editCode.slice(0, 40)).map(b =>
      (b >= 0x20 && b < 0x7F) ? String.fromCharCode(b) : '.'
    ).join(''));
    console.log('First 40 bytes (hex):', Array.from(editCode.slice(0, 40)).map(b =>
      b.toString(16).padStart(2, '0')
    ).join(' '));

    // Find where "Line 1:" string ends (that's where code should start)
    let dataEnd = 0;
    for (let i = 0; i < editCode.length - 1; i++) {
      if (editCode[i] === 0 && editCode[i+1] !== 0) {
        // Found end of a null-terminated string
        const nextWord = editCode[i+1] | (editCode[i+2] << 8) | (editCode[i+3] << 16) | (editCode[i+4] << 24);
        console.log(`Possible code start at offset ${i+1}, first instruction: 0x${nextWord.toString(16)}`);
        if (dataEnd === 0) dataEnd = i + 1;
      }
    }

    console.log('\n=== Executable ===');
    const exe = new ExecutableBuilder()
      .setCode(editCode)
      .setStackSize(1024)
      .build();

    console.log('Executable total bytes:', exe.length);
    console.log('Header (32 bytes):', Array.from(exe.slice(0, 32)).map(b =>
      b.toString(16).padStart(2, '0')
    ).join(' '));

    // Decode header
    const magic = exe[0] | (exe[1] << 8) | (exe[2] << 16) | (exe[3] << 24);
    const codeSize = exe[4] | (exe[5] << 8) | (exe[6] << 16) | (exe[7] << 24);
    const dataSize = exe[8] | (exe[9] << 8) | (exe[10] << 16) | (exe[11] << 24);
    const bssSize = exe[12] | (exe[13] << 8) | (exe[14] << 16) | (exe[15] << 24);
    const stackSize = exe[16] | (exe[17] << 8) | (exe[18] << 16) | (exe[19] << 24);
    const entryOffset = exe[20] | (exe[21] << 8) | (exe[22] << 16) | (exe[23] << 24);

    console.log('\nHeader decoded:');
    console.log(`  Magic: 0x${magic.toString(16)}`);
    console.log(`  Code size: ${codeSize} bytes`);
    console.log(`  Data size: ${dataSize} bytes`);
    console.log(`  BSS size: ${bssSize} bytes`);
    console.log(`  Stack size: ${stackSize} bytes`);
    console.log(`  Entry offset: ${entryOffset} (0x${entryOffset.toString(16)})`);

    console.log('\nFirst few bytes of code section (after header):');
    console.log(Array.from(exe.slice(32, 72)).map(b => b.toString(16).padStart(2, '0')).join(' '));
  });
});
