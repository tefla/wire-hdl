#!/usr/bin/env bun
/**
 * RISC-V Assembler CLI
 *
 * Usage: riscv-asm <input.asm> [-o output.bin] [--hex]
 */

import { readFileSync, writeFileSync } from 'fs';
import { Assembler } from './assembler.js';

interface CliOptions {
  inputFile: string;
  outputFile: string;
  hexDump: boolean;
}

function parseArgs(args: string[]): CliOptions | null {
  const cliArgs = args.slice(2); // Skip bun and script path

  if (cliArgs.length === 0) {
    return null;
  }

  let inputFile = '';
  let outputFile = '';
  let hexDump = false;

  for (let i = 0; i < cliArgs.length; i++) {
    const arg = cliArgs[i];

    if (arg === '-o' || arg === '--output') {
      if (i + 1 >= cliArgs.length) {
        console.error('Error: -o requires an output filename');
        return null;
      }
      outputFile = cliArgs[++i];
    } else if (arg === '--hex') {
      hexDump = true;
    } else if (arg === '-h' || arg === '--help') {
      return null;
    } else if (!arg.startsWith('-')) {
      inputFile = arg;
    } else {
      console.error(`Error: Unknown option '${arg}'`);
      return null;
    }
  }

  if (!inputFile) {
    console.error('Error: No input file specified');
    return null;
  }

  // Default output file
  if (!outputFile) {
    outputFile = inputFile.replace(/\.(asm|s)$/i, '') + '.bin';
  }

  return { inputFile, outputFile, hexDump };
}

function printUsage(): void {
  console.log(`RISC-V Assembler

Usage: riscv-asm <input.asm> [-o output.bin] [--hex]

Options:
  -o, --output <file>  Output file (default: <input>.bin)
  --hex                Print hex dump of output
  -h, --help           Show this help message

Examples:
  riscv-asm program.asm
  riscv-asm program.asm -o rom.bin
  riscv-asm program.asm --hex`);
}

function formatHexDump(bytes: Uint8Array): string {
  const lines: string[] = [];

  for (let offset = 0; offset < bytes.length; offset += 16) {
    const line: string[] = [];

    // Address
    line.push(offset.toString(16).padStart(8, '0'));
    line.push(': ');

    // Hex bytes
    const hexParts: string[] = [];
    const asciiParts: string[] = [];

    for (let i = 0; i < 16; i++) {
      if (offset + i < bytes.length) {
        const byte = bytes[offset + i];
        hexParts.push(byte.toString(16).padStart(2, '0'));
        asciiParts.push(byte >= 32 && byte < 127 ? String.fromCharCode(byte) : '.');
      } else {
        hexParts.push('  ');
        asciiParts.push(' ');
      }

      // Add space between groups of 4
      if (i === 3 || i === 7 || i === 11) {
        hexParts.push('');
      }
    }

    line.push(hexParts.join(' '));
    line.push('  |');
    line.push(asciiParts.join(''));
    line.push('|');

    lines.push(line.join(''));
  }

  return lines.join('\n');
}

export function main(args: string[] = process.argv): number {
  const options = parseArgs(args);

  if (!options) {
    printUsage();
    return args.some(a => a === '-h' || a === '--help') ? 0 : 1;
  }

  // Read input file
  let source: string;
  try {
    source = readFileSync(options.inputFile, 'utf-8');
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      console.error(`Error: File not found: ${options.inputFile}`);
    } else {
      console.error(`Error: Cannot read file: ${options.inputFile}`);
    }
    return 1;
  }

  // Assemble
  const assembler = new Assembler(source);
  const result = assembler.assemble();

  // Check for errors
  if (result.errors.length > 0) {
    for (const error of result.errors) {
      console.error(`${options.inputFile}:${error.line}:${error.column}: ${error.message}`);
    }
    return 1;
  }

  // Write output
  try {
    writeFileSync(options.outputFile, result.bytes);
    console.log(`Assembled ${result.bytes.length} bytes to ${options.outputFile}`);
  } catch (e) {
    console.error(`Error: Cannot write file: ${options.outputFile}`);
    return 1;
  }

  // Print hex dump if requested
  if (options.hexDump) {
    console.log('\nHex dump:');
    console.log(formatHexDump(result.bytes));
  }

  // Print symbol table summary
  if (result.symbols.size > 0) {
    console.log(`\nSymbols: ${result.symbols.size}`);
  }

  return 0;
}

// Run if executed directly
if (import.meta.main) {
  process.exit(main());
}
