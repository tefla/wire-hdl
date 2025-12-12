import { describe, it, expect } from 'vitest';
import { RiscVCpu } from '../src/emulator/cpu.js';
import { InteractiveSystem } from '../src/emulator/boot-disk.js';

describe('Interactive EDIT - Keyboard Input', () => {
  it('should launch and show prompt', () => {
    const cpu = new RiscVCpu(64 * 1024);
    const system = new InteractiveSystem(cpu);

    system.boot();

    // Queue up keys: type "Hello" then ESC
    'Hello'.split('').forEach(ch => cpu.keyboard.keyPress(ch.charCodeAt(0)));
    cpu.keyboard.keyPress(0x1B); // ESC

    // Type "edit" to launch editor
    'edit'.split('').forEach(ch => system.keyPress(ch.charCodeAt(0)));
    system.keyPress(0x0D); // Enter

    const output = cpu.consoleOutput;
    console.log('=== Output ===');
    console.log(output);

    // Verify editor launched and showed its prompt
    expect(output).toContain('EDIT - Type text');
    expect(output).toContain('ESC to exit');

    // Should have echoed the queued keys
    expect(output).toContain('Hello');
    expect(output).toContain('Goodbye');
  });

  it('should be testable manually in browser', () => {
    // This is a marker test - the interactive editor needs to be tested
    // manually in the browser at http://localhost:5179
    //
    // Test procedure:
    // 1. Open http://localhost:5179
    // 2. Type: edit
    // 3. Type some text, try backspace, press enter for new lines
    // 4. Press ESC to exit
    // 5. Verify typed text appeared and editing worked

    expect(true).toBe(true);
    console.log('\n========================================');
    console.log('MANUAL TEST REQUIRED');
    console.log('========================================');
    console.log('Open http://localhost:5179');
    console.log('Type: edit');
    console.log('Try typing, backspace, enter, then ESC');
    console.log('========================================\n');
  });
});
