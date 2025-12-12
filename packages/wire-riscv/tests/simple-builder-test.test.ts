import { describe, it } from 'vitest';
import { ExecutableBuilder } from '../src/emulator/program-loader.js';

describe('ExecutableBuilder Test', () => {
  it('should create executable with correct header', () => {
    const code = new Uint8Array([0x13, 0x05, 0xA0, 0x02, 0x73, 0x00, 0x00, 0x00]); // ADDI + ECALL

    const exe = new ExecutableBuilder()
      .setCode(code)
      .setStackSize(1024)
      .build();

    console.log('Executable size:', exe.length);
    console.log('Header bytes:', Array.from(exe.slice(0, 24)).map(b => b.toString(16).padStart(2, '0')).join(' '));

    // Decode header
    const magic = exe[0] | (exe[1] << 8) | (exe[2] << 16) | (exe[3] << 24);
    const entryOffset = exe[4] | (exe[5] << 8) | (exe[6] << 16) | (exe[7] << 24);
    const codeSize = exe[8] | (exe[9] << 8) | (exe[10] << 16) | (exe[11] << 24);
    const dataSize = exe[12] | (exe[13] << 8) | (exe[14] << 16) | (exe[15] << 24);
    const bssSize = exe[16] | (exe[17] << 8) | (exe[18] << 16) | (exe[19] << 24);
    const stackSize = exe[20] | (exe[21] << 8) | (exe[22] << 16) | (exe[23] << 24);

    console.log('Magic:', '0x' + magic.toString(16));
    console.log('Entry offset:', entryOffset);
    console.log('Code size:', codeSize);
    console.log('Data size:', dataSize);
    console.log('BSS size:', bssSize);
    console.log('Stack size:', stackSize);
  });
});
