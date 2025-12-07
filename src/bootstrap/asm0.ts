// ASM0.COM - Stage 0 Assembler as .COM file
// A minimal 6502 assembler that runs on the Wire computer
//
// This is the TypeScript stage0 assembler compiled to a machine code
// program that can run on the emulated 6502.
//
// For now, we output a placeholder program that prints "ASM0 v1"
// until we have a fully hand-coded machine language assembler.

import { assemble } from '../assembler/stage0.js';

// Import assembler source from asm folder
import ASM0_SOURCE from '../../asm/asm0-boot.asm?raw';

export { ASM0_SOURCE };
export const ASM0_ENTRY = 0x0800;

/**
 * Assemble the stage0 assembler placeholder
 */
export function assembleStage0(): { bytes: Uint8Array; origin: number } {
  const result = assemble(ASM0_SOURCE);
  return {
    bytes: result.bytes,
    origin: ASM0_ENTRY,
  };
}

/**
 * Get the stage0 assembler info
 */
export function getAsm0Info(): string {
  const result = assembleStage0();
  return `ASM0.COM - Stage 0 Assembler
Size: ${result.bytes.length} bytes
Origin: $${result.origin.toString(16).toUpperCase()}`;
}
