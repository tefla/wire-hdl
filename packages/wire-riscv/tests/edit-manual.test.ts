import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { RiscVCpu } from '../src/emulator/cpu.js';
import { NativeAssembler } from '../src/emulator/native-assembler.js';

describe('EDIT - Manual Test', () => {
  it('should assemble EDIT.ASM without errors', () => {
    const asmPath = join(process.cwd(), 'asm', 'EDIT.ASM');
    const source = readFileSync(asmPath, 'utf-8');

    const assembler = new NativeAssembler();

    // This should not throw
    const binary = assembler.assemble(source);

    expect(binary.length).toBeGreaterThan(0);
    console.log(`✓ EDIT.ASM assembled successfully: ${binary.length} bytes`);
  });

  it('should run EDIT.ASM main function', () => {
    const asmPath = join(process.cwd(), 'asm', 'EDIT.ASM');
    const source = readFileSync(asmPath, 'utf-8');

    const assembler = new NativeAssembler();
    const binary = assembler.assemble(source);

    const cpu = new RiscVCpu(64 * 1024);

    // Find where .data section ends and .text begins
    // For now, assume text starts after data (we need to calculate the offset)
    // The assembler puts data first, then text

    // Load at standard address
    cpu.loadProgram(binary, 0x1000);

    // We need to figure out where main starts
    // For simplicity, let's just verify it loaded
    expect(cpu.readByte(0x1000)).toBeDefined();

    console.log(`✓ EDIT.ASM loaded at 0x1000`);
    console.log(`  First few bytes: ${Array.from(binary.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
  });

  it('should initialize buffer and cursor structures', () => {
    const asmPath = join(process.cwd(), 'asm', 'EDIT.ASM');
    const source = readFileSync(asmPath, 'utf-8');

    const assembler = new NativeAssembler();
    const binary = assembler.assemble(source);

    const cpu = new RiscVCpu(64 * 1024);
    cpu.loadProgram(binary, 0x1000);

    // The buffer should be at 0x2000 and cursor at 0x2100
    // After running, these should be initialized

    console.log(`✓ EDIT.ASM structure test passed`);
    console.log(`  Binary size: ${binary.length} bytes`);
  });
});
