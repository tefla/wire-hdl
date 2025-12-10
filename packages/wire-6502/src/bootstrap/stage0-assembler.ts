// Stage 0 Assembler - Bootstrap assembler generator
// Assembles the stage0.asm file and produces hex output

import { assemble } from '../assembler/stage0.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Stage 0 assembler entry point
export const STAGE0_ENTRY = 0x0800;

/**
 * Assemble the stage0.asm file
 */
export function assembleStage0(): { bytes: Uint8Array; origin: number } {
  const asmPath = join(__dirname, '../../asm/stage0.asm');
  const source = readFileSync(asmPath, 'utf-8');

  const result = assemble(source);
  return {
    bytes: result.bytes,
    origin: STAGE0_ENTRY,
  };
}

/**
 * Generate hex dump of the assembled code
 */
export function hexDump(bytes: Uint8Array, origin: number, bytesPerLine: number = 16): string {
  const lines: string[] = [];

  for (let i = 0; i < bytes.length; i += bytesPerLine) {
    const addr = origin + i;
    const lineBytes = bytes.slice(i, Math.min(i + bytesPerLine, bytes.length));
    const hex = Array.from(lineBytes)
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');

    lines.push(`${addr.toString(16).padStart(4, '0').toUpperCase()}: ${hex}`);
  }

  return lines.join('\n');
}

/**
 * Generate Intel HEX format output
 */
export function intelHex(bytes: Uint8Array, origin: number): string {
  const lines: string[] = [];
  const BYTES_PER_LINE = 16;

  for (let i = 0; i < bytes.length; i += BYTES_PER_LINE) {
    const addr = origin + i;
    const lineBytes = bytes.slice(i, Math.min(i + BYTES_PER_LINE, bytes.length));
    const count = lineBytes.length;

    // Calculate checksum
    let sum = count + (addr >> 8) + (addr & 0xff) + 0x00; // 0x00 = data record
    for (const b of lineBytes) {
      sum += b;
    }
    const checksum = (~sum + 1) & 0xff;

    const hex = Array.from(lineBytes)
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join('');

    lines.push(
      `:${count.toString(16).padStart(2, '0').toUpperCase()}` +
        `${addr.toString(16).padStart(4, '0').toUpperCase()}` +
        `00${hex}` +
        `${checksum.toString(16).padStart(2, '0').toUpperCase()}`
    );
  }

  // End of file record
  lines.push(':00000001FF');

  return lines.join('\n');
}

/**
 * Export stage0 as a TypeScript module with the bytes
 */
export function generateStage0Module(): string {
  const { bytes, origin } = assembleStage0();

  const hexArray = Array.from(bytes)
    .map((b) => `0x${b.toString(16).padStart(2, '0')}`)
    .join(', ');

  return `// Auto-generated Stage 0 Assembler bytes
// Generated from asm/stage0.asm

export const STAGE0_BYTES = new Uint8Array([${hexArray}]);
export const STAGE0_ORIGIN = 0x${origin.toString(16).padStart(4, '0')};
export const STAGE0_SIZE = ${bytes.length};
`;
}

// CLI mode
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const { bytes, origin } = assembleStage0();

    console.log(`Stage 0 Assembler`);
    console.log(`=================`);
    console.log(`Origin: $${origin.toString(16).toUpperCase()}`);
    console.log(`Size: ${bytes.length} bytes`);
    console.log();
    console.log('Hex dump:');
    console.log(hexDump(bytes, origin));
  } catch (error) {
    console.error('Assembly error:', error);
    process.exit(1);
  }
}
