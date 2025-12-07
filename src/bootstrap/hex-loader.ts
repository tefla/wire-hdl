// Hex Loader ROM for Wire-HDL Computer
// A minimal monitor for entering and running machine code
//
// Commands:
//   L xxxx - Set load address to $xxxx
//   D xxxx - Dump 16 bytes starting at $xxxx
//   E      - Execute at load address
//   R      - Reset load address to $0200
//   ?      - Show help
//   xx xx  - Enter hex bytes (stored at load address, auto-increments)
//
// Located at $F800-$FEFF in ROM (uses BIOS routines for I/O)

import { assemble } from '../assembler/stage0.js';
import HEX_LOADER_SOURCE from '../../asm/hex-loader.asm?raw';

// Hex loader zero page variables ($F0-$FF)
export const HEX_LOADER_ZP = {
  LOAD_LO: 0xf0,      // Load address low byte
  LOAD_HI: 0xf1,      // Load address high byte
  INPUT_BUF: 0x80,    // Input buffer (64 bytes: $80-$BF)
  INPUT_LEN: 0x02,    // Input length (at $02)
  TEMP: 0x03,         // Temp storage
  TEMP2: 0x04,        // Temp storage 2
};

// Hex loader entry point
export const HEX_LOADER_ENTRY = 0xf800;

// Assembly source for the hex loader
export { HEX_LOADER_SOURCE };

/**
 * Assemble the hex loader and return the bytes
 */
export function assembleHexLoader(): { bytes: Uint8Array; origin: number } {
  const result = assemble(HEX_LOADER_SOURCE);
  return {
    bytes: result.bytes,
    origin: HEX_LOADER_ENTRY,
  };
}

/**
 * Generate a hex dump of the assembled hex loader for manual entry
 */
export function hexDump(bytes: Uint8Array, origin: number, bytesPerLine = 16): string {
  const lines: string[] = [];
  for (let i = 0; i < bytes.length; i += bytesPerLine) {
    const addr = (origin + i).toString(16).toUpperCase().padStart(4, '0');
    const hex = Array.from(bytes.slice(i, i + bytesPerLine))
      .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
      .join(' ');
    lines.push(`${addr}: ${hex}`);
  }
  return lines.join('\n');
}

/**
 * Create ROM image with hex loader integrated
 * Combines BIOS ($F000-$F7FF) with Hex Loader ($F800-$FEFF)
 */
export function createHexLoaderRom(): Uint8Array {
  const rom = new Uint8Array(0x4000); // 16KB ROM ($C000-$FFFF)
  rom.fill(0xff); // Fill with $FF (like unprogrammed EPROM)

  const { bytes, origin } = assembleHexLoader();

  // Copy hex loader to ROM
  const romOffset = origin - 0xc000;
  for (let i = 0; i < bytes.length && romOffset + i < rom.length; i++) {
    rom[romOffset + i] = bytes[i];
  }

  // Set reset vector to hex loader entry
  rom[0x3ffc] = HEX_LOADER_ENTRY & 0xff;        // $FFFC low byte
  rom[0x3ffd] = (HEX_LOADER_ENTRY >> 8) & 0xff; // $FFFD high byte

  return rom;
}

// Export for testing
export { HEX_LOADER_SOURCE as source };
