import { describe, it, expect } from 'vitest';
import { RiscVCpu } from '../src/emulator/cpu.js';
import { InteractiveSystem } from '../src/emulator/boot-disk.js';

describe('ASM Hello Duplicate Output Bug', () => {
  it('should not print "Hi" twice when running asm hello.asm then run hello', () => {
    const cpu = new RiscVCpu(64 * 1024);
    const system = new InteractiveSystem(cpu);

    system.boot();

    // Clear initial output
    const initialOutput = cpu.consoleOutput;
    console.log('=== Initial output ===');
    console.log(initialOutput);

    // Type "asm hello.asm"
    'asm hello.asm'.split('').forEach(ch => system.keyPress(ch.charCodeAt(0)));
    system.keyPress(0x0D); // Enter

    const afterAsm = cpu.consoleOutput;
    console.log('\n=== After asm hello.asm ===');
    console.log(afterAsm.substring(initialOutput.length));

    // Type "run hello"
    'run hello'.split('').forEach(ch => system.keyPress(ch.charCodeAt(0)));
    system.keyPress(0x0D); // Enter

    const afterRun = cpu.consoleOutput;
    console.log('\n=== After run hello ===');
    console.log(afterRun.substring(afterAsm.length));

    // Count how many times "Hi" appears in the output after "run hello"
    const outputAfterRun = afterRun.substring(afterAsm.length);
    const hiCount = (outputAfterRun.match(/Hi/g) || []).length;

    console.log('\n=== Analysis ===');
    console.log('"Hi" appears', hiCount, 'time(s) after "run hello"');
    console.log('Expected: 1');
    console.log('Full output after run:', JSON.stringify(outputAfterRun));

    // Should only appear once
    expect(hiCount).toBe(1);
  });
});
