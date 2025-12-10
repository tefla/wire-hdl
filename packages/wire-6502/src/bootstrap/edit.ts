// EDIT.COM - Text Editor for WireOS
// Simple line-based text editor for the wire-hdl computer system

import { assemble } from '../assembler/stage0.js';
import EDIT_SOURCE from '../../asm/edit.asm?raw';

// Editor memory map
export const EDIT_MEM = {
  LOAD_ADDR: 0x0800,      // Editor code loads here
  TEXT_BUF: 0x2000,       // Text buffer start (16KB)
  TEXT_END: 0x5FFF,       // Text buffer end
  LINE_BUF: 0x0100,       // Line input buffer (256 bytes in stack page area)
  FILENAME: 0x0700,       // Filename buffer (16 bytes)
};

// Assembly source for the text editor
export { EDIT_SOURCE };

/**
 * Assemble the editor
 */
export function assembleEdit(): { bytes: Uint8Array; startAddr: number } {
  const result = assemble(EDIT_SOURCE);
  return {
    bytes: result.bytes,
    startAddr: EDIT_MEM.LOAD_ADDR,
  };
}

// Get editor as sectors for floppy disk (512 bytes per sector)
export function getEditSectors(): Uint8Array[] {
  const { bytes } = assembleEdit();
  const sectors: Uint8Array[] = [];

  // Pad to sector boundary
  const paddedLength = Math.ceil(bytes.length / 512) * 512;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);

  // Split into sectors
  for (let i = 0; i < paddedLength; i += 512) {
    sectors.push(padded.slice(i, i + 512));
  }

  return sectors;
}
