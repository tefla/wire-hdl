import { describe, it, expect } from 'vitest';
import { RiscVCpu } from '../src/emulator/cpu.js';
import { InteractiveSystem } from '../src/emulator/boot-disk.js';

describe('Interactive EDIT Command', () => {
  it('should run edit command and display output on screen', () => {
    const cpu = new RiscVCpu(64 * 1024);
    const system = new InteractiveSystem(cpu);

    // Boot the system
    system.boot();

    // Verify system is booted
    expect(system.isRunning()).toBe(true);

    // Get initial console output
    const initialOutput = cpu.consoleOutput;
    console.log('Initial output:', initialOutput);

    // Type "edit" command
    system.keyPress('e'.charCodeAt(0));
    system.keyPress('d'.charCodeAt(0));
    system.keyPress('i'.charCodeAt(0));
    system.keyPress('t'.charCodeAt(0));

    // Press Enter to execute
    system.keyPress(0x0D);

    // Get output after running edit
    const finalOutput = cpu.consoleOutput;
    console.log('Final output:', finalOutput);

    // Check that output contains EDIT's text
    expect(finalOutput).toContain('EDIT');
    expect(finalOutput).toContain('Line 1');
    expect(finalOutput).toContain('quick brown fox');

    // Check GPU text VRAM for the output
    // The text should be visible on screen
    let screenText = '';
    for (let y = 0; y < 25; y++) {
      for (let x = 0; x < 80; x++) {
        const { char } = cpu.gpu.readTextVram(x, y);
        if (char >= 0x20 && char < 0x7F) {
          screenText += String.fromCharCode(char);
        }
      }
    }
    console.log('Screen text:', screenText.substring(0, 200));

    // Verify text is on screen
    expect(screenText).toContain('EDIT');
  });

  it('should run ls command and show EDIT.BIN', () => {
    const cpu = new RiscVCpu(64 * 1024);
    const system = new InteractiveSystem(cpu);

    system.boot();

    // Type "ls" command
    system.keyPress('l'.charCodeAt(0));
    system.keyPress('s'.charCodeAt(0));
    system.keyPress(0x0D);

    const output = cpu.consoleOutput;
    console.log('ls output:', output);

    // Should show EDIT.BIN
    expect(output).toContain('EDIT');
    expect(output).toContain('BIN');
  });

  it('should display help showing available commands', () => {
    const cpu = new RiscVCpu(64 * 1024);
    const system = new InteractiveSystem(cpu);

    system.boot();

    // Type "help" command
    system.keyPress('h'.charCodeAt(0));
    system.keyPress('e'.charCodeAt(0));
    system.keyPress('l'.charCodeAt(0));
    system.keyPress('p'.charCodeAt(0));
    system.keyPress(0x0D);

    const output = cpu.consoleOutput;
    console.log('help output:', output);

    expect(output).toContain('help');
    expect(output).toContain('ls');
    expect(output).toContain('cat');
  });
});
