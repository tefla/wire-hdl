import { describe, it } from 'vitest';
import { RiscVCpu } from '../src/emulator/cpu.js';
import { InteractiveSystem } from '../src/emulator/boot-disk.js';

describe('EDIT Run Test', () => {
  it('should run edit and show debug output', () => {
    const cpu = new RiscVCpu(64 * 1024);
    const system = new InteractiveSystem(cpu);

    system.boot();

    // Type "edit" command
    'edit'.split('').forEach(ch => system.keyPress(ch.charCodeAt(0)));
    system.keyPress(0x0D);

    const output = cpu.consoleOutput;
    console.log('=== Output ===');
    console.log(output);
    console.log('=== End Output ===');

    // Check PC and registers
    console.log('\n=== CPU State ===');
    console.log('PC:', '0x' + cpu.pc.toString(16));
    console.log('Halted:', cpu.halted);
    console.log('a0:', cpu.x[10]);
    console.log('a7:', cpu.x[17]);
    console.log('sp:', '0x' + cpu.x[2].toString(16));

    // Check memory at 0x1000 (where program should be loaded)
    console.log('\n=== Memory at 0x1000 ===');
    const mem = [];
    for (let i = 0; i < 32; i++) {
      mem.push(cpu.readByte(0x1000 + i).toString(16).padStart(2, '0'));
    }
    console.log(mem.join(' '));
  });
});
