#!/usr/bin/env npx tsx
// Script to bundle wire files into a TypeScript module for browser use

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const WIRE_DIR = './wire';
const OUTPUT_FILE = './src/vfs/bundled-wire-files.ts';

// CPU source files in load order
const CPU_SOURCES = [
  'gates.wire',
  'arithmetic.wire',
  'registers.wire',
  'mux8.wire',
  'mux4way8.wire',
  'mux8way8.wire',
  'mux16.wire',
  'adder16.wire',
  'inc16.wire',
  'register16.wire',
  'decoder.wire',
  'alu8.wire',
  'pc.wire',
  'cpu_minimal.wire',
];

function main() {
  console.log('Bundling wire files...');

  const files: Record<string, string> = {};

  // Read all wire files
  const wireFiles = readdirSync(WIRE_DIR).filter(f => f.endsWith('.wire'));

  for (const file of wireFiles) {
    const path = join(WIRE_DIR, file);
    const content = readFileSync(path, 'utf-8');
    files[`wire/${file}`] = content;
  }

  console.log(`Bundled ${Object.keys(files).length} wire files`);

  // Generate TypeScript module
  const output = `// Auto-generated wire file bundle
// Run: npx tsx scripts/bundle-wire-files.ts

export const WIRE_FILES: Record<string, string> = ${JSON.stringify(files, null, 2)};

export const CPU_SOURCES = ${JSON.stringify(CPU_SOURCES)};

export function getCpuSource(): string {
  return CPU_SOURCES.map(file => WIRE_FILES[\`wire/\${file}\`]).join('\\n');
}
`;

  writeFileSync(OUTPUT_FILE, output);
  console.log(`Written to ${OUTPUT_FILE}`);
}

main();
