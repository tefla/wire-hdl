// Simple WireOS Shell
// Loads at $0800 and provides basic command interface
// Commands: HELP, VER, HEX, MEM

import { assemble } from '../assembler/stage0.js';

// Import shell source from asm folder
import SHELL_SOURCE from '../../asm/shell-boot.asm?raw';

export { SHELL_SOURCE };
export const SHELL_ENTRY = 0x0800;

/**
 * Assemble the shell and return bytes
 */
export function assembleShell(): { bytes: Uint8Array; origin: number } {
  const result = assemble(SHELL_SOURCE);
  return {
    bytes: result.bytes,
    origin: SHELL_ENTRY,
  };
}

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
