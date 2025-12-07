// Floppy Disk Image Builder for WireOS
// Creates a bootable floppy disk with shell and utilities
//
// Disk Layout (WireFS):
//   Sector 0        Boot sector (magic "WF", entry point, etc.)
//   Sectors 1-3     Directory (48 entries × 32 bytes)
//   Sectors 4-19    Allocation bitmap
//   Sectors 20+     File data
//
// Files included:
//   SHELL.COM   - WireOS Shell
//   ASM0.COM    - Stage 0 Assembler
//   EDIT.COM    - Text Editor
//   HELLO.ASM   - Hello World example source
//   TEST.ASM    - Test program source

import { assembleShell, SHELL_ENTRY } from './shell.js';
import { assembleStage0 } from './asm0.js';
import { assembleEdit } from './edit.js';
import { WIREFS } from '../system/wirefs.js';
import { DISK } from '../system/disk.js';
import { createBootSector } from './boot-loader.js';

// Import ASM source files from /asm folder
import HELLO_ASM from '../../asm/hello.asm?raw';
import TEST_ASM from '../../asm/test.asm?raw';
import BEEP_ASM from '../../asm/beep.asm?raw';

// Convert string to Uint8Array
function textToBytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    bytes[i] = text.charCodeAt(i);
  }
  return bytes;
}

// Directory entry size
const ENTRY_SIZE = 32;

// Directory entry status values
const STATUS = {
  DELETED: 0x00,
  UNUSED: 0xe5,
  ACTIVE: 0x01,
};

interface FileEntry {
  name: string; // 8 chars max
  ext: string; // 3 chars max
  data: Uint8Array;
  startSector?: number;
}

/**
 * Create a directory entry in raw bytes
 */
function createDirEntry(
  entry: FileEntry,
  startSector: number,
  status: number = STATUS.ACTIVE
): Uint8Array {
  const data = new Uint8Array(ENTRY_SIZE);

  // Status
  data[0] = status;

  // Filename (8 chars, space-padded)
  for (let i = 0; i < 8; i++) {
    data[1 + i] = i < entry.name.length ? entry.name.charCodeAt(i) : 0x20;
  }

  // Extension (3 chars, space-padded)
  for (let i = 0; i < 3; i++) {
    data[9 + i] = i < entry.ext.length ? entry.ext.charCodeAt(i) : 0x20;
  }

  // Start sector (little-endian)
  data[0x0c] = startSector & 0xff;
  data[0x0d] = (startSector >> 8) & 0xff;

  // File size in bytes (little-endian, 32-bit)
  const size = entry.data.length;
  data[0x0e] = size & 0xff;
  data[0x0f] = (size >> 8) & 0xff;
  data[0x10] = (size >> 16) & 0xff;
  data[0x11] = (size >> 24) & 0xff;

  // Sector count
  const sectorCount = Math.ceil(size / DISK.SECTOR_SIZE);
  data[0x12] = sectorCount & 0xff;
  data[0x13] = (sectorCount >> 8) & 0xff;

  // Attributes (0 = normal)
  data[0x14] = 0x00;

  // Reserved bytes are already 0

  return data;
}

/**
 * Create an unused directory entry
 */
function createUnusedEntry(): Uint8Array {
  const data = new Uint8Array(ENTRY_SIZE);
  data.fill(0);
  data[0] = STATUS.UNUSED;
  return data;
}

/**
 * Create allocation bitmap for the disk
 * Marks system sectors (0-19) and file sectors as used
 */
function createBitmap(usedSectors: number[]): Uint8Array[] {
  const bitmapSectors: Uint8Array[] = [];
  const bitmap = new Uint8Array(WIREFS.BITMAP_SECTORS * DISK.SECTOR_SIZE);

  // Mark all used sectors
  for (const sector of usedSectors) {
    const byteIndex = Math.floor(sector / 8);
    const bitIndex = sector % 8;
    if (byteIndex < bitmap.length) {
      bitmap[byteIndex] |= 1 << bitIndex;
    }
  }

  // Split into sectors
  for (let i = 0; i < WIREFS.BITMAP_SECTORS; i++) {
    const sectorData = new Uint8Array(DISK.SECTOR_SIZE);
    for (let j = 0; j < DISK.SECTOR_SIZE; j++) {
      sectorData[j] = bitmap[i * DISK.SECTOR_SIZE + j];
    }
    bitmapSectors.push(sectorData);
  }

  return bitmapSectors;
}

/**
 * Create a bootable WireOS floppy disk image
 * Returns array of sectors
 *
 * Boot Floppy Layout (different from standard WireFS):
 *   Sector 0        Boot sector (magic + first 504 bytes of shell)
 *   Sectors 1-N     Shell continuation (rest of shell code)
 *   After shell     Directory (3 sectors)
 *   After dir       Bitmap (16 sectors)
 *   After bitmap    File data (ASM0.COM etc, but NOT shell since it's in boot area)
 */
export function createFloppyDisk(): Uint8Array[] {
  const sectors: Uint8Array[] = [];

  // Get files to include
  const shellResult = assembleShell();
  const asm0Result = assembleStage0();
  const editResult = assembleEdit();

  // Calculate how many sectors shell needs
  // Boot sector has 504 bytes of code (512 - 8 byte header)
  const shellInBootSector = Math.min(504, shellResult.bytes.length);
  const shellRemaining = shellResult.bytes.length - shellInBootSector;
  const shellContSectors = Math.ceil(shellRemaining / DISK.SECTOR_SIZE);

  // Layout:
  // Sector 0: Boot
  // Sectors 1 to shellContSectors: Shell continuation
  // After that: Directory (3), Bitmap (16), Data
  const dirStart = 1 + shellContSectors;
  const bitmapStart = dirStart + WIREFS.DIR_SECTORS;
  const dataStart = bitmapStart + WIREFS.BITMAP_SECTORS;

  // Files other than shell (shell is embedded in boot sectors)
  const files: FileEntry[] = [
    { name: 'SHELL', ext: 'COM', data: shellResult.bytes, startSector: dataStart },
    { name: 'ASM0', ext: 'COM', data: asm0Result.bytes },
    { name: 'EDIT', ext: 'COM', data: editResult.bytes },
    { name: 'HELLO', ext: 'ASM', data: textToBytes(HELLO_ASM) },
    { name: 'TEST', ext: 'ASM', data: textToBytes(TEST_ASM) },
    { name: 'BEEP', ext: 'ASM', data: textToBytes(BEEP_ASM) },
  ];

  // Calculate sector assignments for files in data area
  // Note: SHELL.COM is also in data area for DIR command to find it
  let nextDataSector = dataStart;
  for (const file of files) {
    file.startSector = nextDataSector;
    const sectorsNeeded = Math.ceil(file.data.length / DISK.SECTOR_SIZE);
    nextDataSector += sectorsNeeded;
  }

  // Sector 0: Boot sector with shell code
  const bootSector = createBootSector(shellResult.bytes, SHELL_ENTRY, SHELL_ENTRY);
  sectors[0] = bootSector;

  // Sectors 1-N: Shell continuation (code that didn't fit in boot sector)
  if (shellRemaining > 0) {
    for (let s = 0; s < shellContSectors; s++) {
      const sectorData = new Uint8Array(DISK.SECTOR_SIZE);
      const srcOffset = shellInBootSector + s * DISK.SECTOR_SIZE;
      const copyLen = Math.min(DISK.SECTOR_SIZE, shellResult.bytes.length - srcOffset);

      for (let i = 0; i < copyLen; i++) {
        sectorData[i] = shellResult.bytes[srcOffset + i];
      }

      sectors[1 + s] = sectorData;
    }
  }

  // Directory sectors
  const entriesPerSector = DISK.SECTOR_SIZE / ENTRY_SIZE; // 16

  for (let dirSector = 0; dirSector < WIREFS.DIR_SECTORS; dirSector++) {
    const sectorData = new Uint8Array(DISK.SECTOR_SIZE);

    for (let entryIndex = 0; entryIndex < entriesPerSector; entryIndex++) {
      const globalEntryIndex = dirSector * entriesPerSector + entryIndex;

      let entryData: Uint8Array;
      if (globalEntryIndex < files.length) {
        // Active file entry
        const file = files[globalEntryIndex];
        entryData = createDirEntry(file, file.startSector!);
      } else {
        // Unused entry
        entryData = createUnusedEntry();
      }

      // Copy entry to sector
      const offset = entryIndex * ENTRY_SIZE;
      for (let i = 0; i < ENTRY_SIZE; i++) {
        sectorData[offset + i] = entryData[i];
      }
    }

    sectors[dirStart + dirSector] = sectorData;
  }

  // Track all used sectors for bitmap
  const usedSectors: number[] = [];
  // Boot + shell continuation
  for (let s = 0; s <= shellContSectors; s++) {
    usedSectors.push(s);
  }
  // Directory
  for (let s = 0; s < WIREFS.DIR_SECTORS; s++) {
    usedSectors.push(dirStart + s);
  }
  // Bitmap
  for (let s = 0; s < WIREFS.BITMAP_SECTORS; s++) {
    usedSectors.push(bitmapStart + s);
  }
  // File data
  for (const file of files) {
    const sectorsNeeded = Math.ceil(file.data.length / DISK.SECTOR_SIZE);
    for (let s = 0; s < sectorsNeeded; s++) {
      usedSectors.push(file.startSector! + s);
    }
  }

  // Create bitmap
  const bitmapSectors = createBitmap(usedSectors);
  for (let i = 0; i < WIREFS.BITMAP_SECTORS; i++) {
    sectors[bitmapStart + i] = bitmapSectors[i];
  }

  // File data sectors
  for (const file of files) {
    const sectorsNeeded = Math.ceil(file.data.length / DISK.SECTOR_SIZE);

    for (let s = 0; s < sectorsNeeded; s++) {
      const sectorData = new Uint8Array(DISK.SECTOR_SIZE);
      const dataOffset = s * DISK.SECTOR_SIZE;
      const copyLen = Math.min(DISK.SECTOR_SIZE, file.data.length - dataOffset);

      for (let i = 0; i < copyLen; i++) {
        sectorData[i] = file.data[dataOffset + i];
      }

      sectors[file.startSector! + s] = sectorData;
    }
  }

  // Fill any gaps with empty sectors
  for (let i = 0; i < sectors.length; i++) {
    if (!sectors[i]) {
      sectors[i] = new Uint8Array(DISK.SECTOR_SIZE);
    }
  }

  return sectors;
}

/**
 * Get info about the floppy disk contents
 */
export function getFloppyInfo(): string {
  const shellResult = assembleShell();
  const asm0Result = assembleStage0();
  const editResult = assembleEdit();

  const shellSectors = Math.ceil(shellResult.bytes.length / DISK.SECTOR_SIZE);
  const asm0Sectors = Math.ceil(asm0Result.bytes.length / DISK.SECTOR_SIZE);
  const editSectors = Math.ceil(editResult.bytes.length / DISK.SECTOR_SIZE);

  return `WireOS Installation Floppy
========================
SHELL.COM  ${shellResult.bytes.length} bytes (${shellSectors} sectors)
ASM0.COM   ${asm0Result.bytes.length} bytes (${asm0Sectors} sectors)
EDIT.COM   ${editResult.bytes.length} bytes (${editSectors} sectors)
------------------------
Total: ${shellResult.bytes.length + asm0Result.bytes.length + editResult.bytes.length} bytes`;
}

/**
 * Export floppy disk as raw binary
 */
export function exportFloppyBinary(): Uint8Array {
  const sectors = createFloppyDisk();
  const totalSize = sectors.length * DISK.SECTOR_SIZE;
  const binary = new Uint8Array(totalSize);

  for (let i = 0; i < sectors.length; i++) {
    binary.set(sectors[i], i * DISK.SECTOR_SIZE);
  }

  return binary;
}
