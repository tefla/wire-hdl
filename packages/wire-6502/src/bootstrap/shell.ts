// Simple WireOS Shell
// Provides basic command interface
// Commands: HELP, VER, HEX, MEM

import { assemble } from '../assembler/stage0.js';

// Import shell source from asm folder
import SHELL_SOURCE from '../../asm/shell-boot.asm?raw';

export { SHELL_SOURCE };

/**
 * Assemble the shell and return bytes
 */
export function assembleShell(): { bytes: Uint8Array; origin: number } {
  const result = assemble(SHELL_SOURCE);
  return {
    bytes: result.bytes,
    origin: result.origin,  // Use actual origin from assembler
  };
}

// Export the shell entry point after assembly
export const SHELL_ENTRY = assembleShell().origin;

/**
 * Get shell as hex string for typing into hex loader
 */
export function getShellHex(): string {
  const { bytes } = assembleShell();
  return Array.from(bytes)
    .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ');
}

/**
 * Get shell bytes as array of hex pairs (for entering via hex loader)
 */
export function getShellHexPairs(): string[] {
  const { bytes } = assembleShell();
  return Array.from(bytes).map(b => b.toString(16).toUpperCase().padStart(2, '0'));
}
