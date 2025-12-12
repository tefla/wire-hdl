import { describe, it } from 'vitest';
import { NativeAssembler } from '../src/emulator/native-assembler.js';
import { ExecutableBuilder } from '../src/emulator/program-loader.js';
import editAsmSource from '../asm/EDIT.ASM?raw';

describe('EDIT Header Check', () => {
  it('should show EDIT executable structure', () => {
    const asm = new NativeAssembler();
    const code = asm.assemble(editAsmSource);

    console.log('Assembled code size:', code.length);
    console.log('First 60 bytes (hex):');
    const hex = [];
    for (let i = 0; i < Math.min(60, code.length); i++) {
      hex.push(code[i].toString(16).padStart(2, '0'));
    }
    console.log(hex.join(' '));

    console.log('\nFirst 60 bytes (ASCII):');
    let ascii = '';
    for (let i = 0; i < Math.min(60, code.length); i++) {
      ascii += (code[i] >= 0x20 && code[i] < 0x7F) ? String.fromCharCode(code[i]) : '.';
    }
    console.log(ascii);

    const exe = new ExecutableBuilder()
      .setCode(code)
      .setStackSize(1024)
      .build();

    console.log('\n=== Executable ===');
    console.log('Total size:', exe.length);

    // Decode header
    const magic = exe[0] | (exe[1] << 8) | (exe[2] << 16) | (exe[3] << 24);
    const codeSize = exe[4] | (exe[5] << 8) | (exe[6] << 16) | (exe[7] << 24);
    const dataSize = exe[8] | (exe[9] << 8) | (exe[10] << 16) | (exe[11] << 24);
    const bssSize = exe[12] | (exe[13] << 8) | (exe[14] << 16) | (exe[15] << 24);
    const stackSize = exe[16] | (exe[17] << 8) | (exe[18] << 16) | (exe[19] << 24);
    const entryOffset = exe[20] | (exe[21] << 8) | (exe[22] << 16) | (exe[23] << 24);

    console.log('Magic:', '0x' + magic.toString(16));
    console.log('Code size:', codeSize);
    console.log('Data size:', dataSize);
    console.log('BSS size:', bssSize);
    console.log('Stack size:', stackSize);
    console.log('Entry offset:', entryOffset, '(0x' + entryOffset.toString(16) + ')');

    console.log('\nCode section (first 60 bytes after header):');
    const codeHex = [];
    for (let i = 0; i < Math.min(60, codeSize); i++) {
      codeHex.push(exe[32 + i].toString(16).padStart(2, '0'));
    }
    console.log(codeHex.join(' '));
  });
});
