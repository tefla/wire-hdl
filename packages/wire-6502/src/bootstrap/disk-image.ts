// Floppy Disk Image Builder for WireOS
// Creates a bootable floppy disk with shell and utilities
//
// Standard WireFS Disk Layout (same for floppy and HDD):
//   Sector 0        Boot sector (boot loader code)
//   Sectors 1-3     Directory (48 entries × 32 bytes)
//   Sectors 4-19    Allocation bitmap
//   Sectors 20+     File data
//
// Root files:
//   SHELL.COM   - WireOS Shell (loaded by boot loader)
//   ASM.COM     - Stage 1 Assembler (self-hosting, assembled from asm.asm)
//   ASM0.COM    - Stage 0 Assembler placeholder
//   EDIT.COM    - Text Editor
//   CD.COM      - Change Directory
//   MKDIR.COM   - Make Directory
//   HELLO.ASM   - Hello World example
//   TEST.ASM    - Test program example
//   BEEP.ASM    - Sound example
//
// SRC/ directory (source code):
//   SHELL.ASM   - Shell source
//   ASM.ASM     - Full assembler source
//   ASM0.ASM    - Stage 0 assembler source
//   EDIT.ASM    - Editor source
//   BOOTLOAD.ASM - Boot loader source
//   HEXLOAD.ASM - Hex loader source
//   CD.ASM      - CD command source
//   MKDIR.ASM   - MKDIR command source
//   HELLO.ASM   - Hello World source

import { assembleShell, SHELL_ENTRY } from './shell.js';
import { assembleStage0 } from './asm0.js';
import { assembleEdit } from './edit.js';
import { assemble } from '../assembler/stage0.js';
import { WIREFS } from '../system/wirefs.js';
import { DISK } from '../system/disk.js';

// Import ASM source files from /asm folder
import HELLO_ASM from '../../asm/hello.asm?raw';
import TEST_ASM from '../../asm/test.asm?raw';
import BEEP_ASM from '../../asm/beep.asm?raw';
import CD_ASM from '../../asm/cd.asm?raw';
import MKDIR_ASM from '../../asm/mkdir.asm?raw';
// ASM2 and test files
import ASM2_ASM from '../../asm/asm2.asm?raw';
import TESTNOP_ASM from '../../asm/testnop.asm?raw';
import TESTLDA_ASM from '../../asm/testlda.asm?raw';
import TESTBR_ASM from '../../asm/testbr.asm?raw';
import TESTERR_ASM from '../../asm/testerr.asm?raw';
import TESTDB_ASM from '../../asm/testdb.asm?raw';
import TESTDB2_ASM from '../../asm/testdb2.asm?raw';
import TESTFWD_ASM from '../../asm/testfwd.asm?raw';
import TESTDW_ASM from '../../asm/testdw.asm?raw';
import TESTBIG_ASM from '../../asm/testbig.asm?raw';
import TESTSTR_ASM from '../../asm/teststr.asm?raw';
import TESTFWDLO_ASM from '../../asm/testfwdlo.asm?raw';
// Source code for distribution
import SHELL_ASM from '../../asm/shell-boot.asm?raw';
import ASM_ASM from '../../asm/asm.asm?raw';
import ASM0_ASM from '../../asm/asm0-boot.asm?raw';
import EDIT_ASM from '../../asm/edit.asm?raw';
import BOOTLOAD_ASM from '../../asm/boot-loader.asm?raw';
import HEXLOAD_ASM from '../../asm/hex-loader.asm?raw';

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

// File attributes
const ATTR = {
  READONLY: 0x01,
  HIDDEN: 0x02,
  SYSTEM: 0x04,
  DIRECTORY: 0x10,
};

interface FileEntry {
  name: string; // 8 chars max
  ext: string; // 3 chars max
  data: Uint8Array;
  startSector?: number;
  isDirectory?: boolean;
  parentIndex?: number;  // Entry index of parent directory (0xFFFF for root)
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
  const sectorCount = Math.ceil(size / DISK.SECTOR_SIZE) || 0;
  data[0x12] = sectorCount & 0xff;
  data[0x13] = (sectorCount >> 8) & 0xff;

  // Attributes
  data[0x14] = entry.isDirectory ? ATTR.DIRECTORY : 0x00;

  // Parent entry index (0xFFFF for root)
  const parentIndex = entry.parentIndex ?? 0xFFFF;
  data[0x15] = parentIndex & 0xff;
  data[0x16] = (parentIndex >> 8) & 0xff;

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
 * Marks system sectors and file sectors as used
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
 * Create a boot sector that loads SHELL.COM from the filesystem
 *
 * Boot sector format:
 *   $00-$01  Magic "WF"
 *   $02-$03  Entry point (where to jump after loading)
 *   $04-$05  Load address (where to load SHELL.COM)
 *   $06      Shell start sector (from directory)
 *   $07      Shell sector count (from directory)
 *   $08+     Boot code
 */
function createFilesystemBootSector(shellStartSector: number, shellSectorCount: number): Uint8Array {
  const sector = new Uint8Array(512);

  // Magic bytes
  sector[0] = 0x57; // 'W'
  sector[1] = 0x46; // 'F'

  // Entry point (SHELL_ENTRY = $0800)
  sector[2] = SHELL_ENTRY & 0xff;
  sector[3] = (SHELL_ENTRY >> 8) & 0xff;

  // Load address (same as entry point)
  sector[4] = SHELL_ENTRY & 0xff;
  sector[5] = (SHELL_ENTRY >> 8) & 0xff;

  // Shell location info (for boot loader to use)
  sector[6] = shellStartSector & 0xff;
  sector[7] = shellSectorCount & 0xff;

  // Boot code starts at offset 8
  // This minimal boot code just signals that we need filesystem boot
  // The ROM boot loader will read this and load SHELL.COM from the directory

  return sector;
}

/**
 * Create a bootable WireOS floppy disk image
 * Returns array of sectors
 *
 * Standard WireFS Layout:
 *   Sector 0        Boot sector
 *   Sectors 1-3     Directory (48 entries)
 *   Sectors 4-19    Allocation bitmap (16 sectors)
 *   Sectors 20+     File data
 */
export function createFloppyDisk(): Uint8Array[] {
  const sectors: Uint8Array[] = [];

  // Get files to include
  const shellResult = assembleShell();
  const asm0Result = assembleStage0();
  const asmResult = assemble(ASM_ASM);  // Stage 1 assembler (self-hosting)
  const asm2Result = assemble(ASM2_ASM); // Stage 2 assembler (compiled by stage0)
  const editResult = assembleEdit();
  const cdResult = assemble(CD_ASM);
  const mkdirResult = assemble(MKDIR_ASM);

  // Standard WireFS layout constants
  const DIR_START = WIREFS.DIR_START;      // 1
  const DIR_SECTORS = WIREFS.DIR_SECTORS;  // 3
  const BITMAP_START = WIREFS.BITMAP_START; // 4
  const BITMAP_SECTORS = WIREFS.BITMAP_SECTORS; // 16
  const DATA_START = WIREFS.DATA_START;    // 20

  // Index 16 will be SRC directory (after the first 16 files 0-15)
  const SRC_DIR_INDEX = 20;
  const files: FileEntry[] = [
    // Root files (indices 0-15)
    // SHELL.COM must be first so boot loader can find it easily
    { name: 'SHELL', ext: 'COM', data: shellResult.bytes },       // 0
    { name: 'ASM', ext: 'COM', data: asmResult.bytes },           // 1 - Stage 1 assembler
    { name: 'ASM0', ext: 'COM', data: asm0Result.bytes },         // 2 - Placeholder
    { name: 'ASM2', ext: 'COM', data: asm2Result.bytes },         // 3 - Stage 2 assembler
    { name: 'EDIT', ext: 'COM', data: editResult.bytes },         // 4
    { name: 'CD', ext: 'COM', data: cdResult.bytes },             // 5
    { name: 'MKDIR', ext: 'COM', data: mkdirResult.bytes },       // 6
    { name: 'HELLO', ext: 'ASM', data: textToBytes(HELLO_ASM) },  // 7
    { name: 'TEST', ext: 'ASM', data: textToBytes(TEST_ASM) },    // 8
    { name: 'BEEP', ext: 'ASM', data: textToBytes(BEEP_ASM) },    // 9
    // ASM2 test files for Stage 2 assembler
    { name: 'TESTNOP', ext: 'ASM', data: textToBytes(TESTNOP_ASM) }, // 10
    { name: 'TESTLDA', ext: 'ASM', data: textToBytes(TESTLDA_ASM) }, // 11
    { name: 'TESTBR', ext: 'ASM', data: textToBytes(TESTBR_ASM) },   // 12
    { name: 'TESTERR', ext: 'ASM', data: textToBytes(TESTERR_ASM) }, // 13
    { name: 'TESTDB', ext: 'ASM', data: textToBytes(TESTDB_ASM) },   // 14
    { name: 'TESTDB2', ext: 'ASM', data: textToBytes(TESTDB2_ASM) }, // 15
    { name: 'TESTFWD', ext: 'ASM', data: textToBytes(TESTFWD_ASM) }, // 16
    { name: 'TESTDW', ext: 'ASM', data: textToBytes(TESTDW_ASM) },   // 17
    { name: 'TESTBIG', ext: 'ASM', data: textToBytes(TESTBIG_ASM) }, // 18
    { name: 'TESTSTR', ext: 'ASM', data: textToBytes(TESTSTR_ASM) }, // 19
    { name: 'TESTFWDL', ext: 'ASM', data: textToBytes(TESTFWDLO_ASM) }, // 20 - forward ref with < >
    // SRC directory (index 20)
    { name: 'SRC', ext: '', data: new Uint8Array(0), isDirectory: true },
    // Files in SRC/ (indices 15+)
    // ASM.ASM included for self-hosting demo (75KB)
    { name: 'ASM', ext: 'ASM', data: textToBytes(ASM_ASM), parentIndex: SRC_DIR_INDEX },
    { name: 'ASM2', ext: 'ASM', data: textToBytes(ASM2_ASM), parentIndex: SRC_DIR_INDEX },
    { name: 'ASM0', ext: 'ASM', data: textToBytes(ASM0_ASM), parentIndex: SRC_DIR_INDEX },
    { name: 'BOOTLOAD', ext: 'ASM', data: textToBytes(BOOTLOAD_ASM), parentIndex: SRC_DIR_INDEX },
    { name: 'HEXLOAD', ext: 'ASM', data: textToBytes(HEXLOAD_ASM), parentIndex: SRC_DIR_INDEX },
    { name: 'CD', ext: 'ASM', data: textToBytes(CD_ASM), parentIndex: SRC_DIR_INDEX },
    { name: 'MKDIR', ext: 'ASM', data: textToBytes(MKDIR_ASM), parentIndex: SRC_DIR_INDEX },
    { name: 'HELLO', ext: 'ASM', data: textToBytes(HELLO_ASM), parentIndex: SRC_DIR_INDEX },
  ];

  // Calculate sector assignments for files in data area
  // Directories don't need sectors allocated
  let nextDataSector = DATA_START;
  for (const file of files) {
    if (file.isDirectory) {
      file.startSector = 0;  // Directories don't have data
      continue;
    }
    file.startSector = nextDataSector;
    const sectorsNeeded = Math.ceil(file.data.length / DISK.SECTOR_SIZE) || 1;
    nextDataSector += sectorsNeeded;
  }

  // Get SHELL.COM location for boot sector
  const shellFile = files[0];
  const shellStartSector = shellFile.startSector!;
  const shellSectorCount = Math.ceil(shellFile.data.length / DISK.SECTOR_SIZE);

  // Sector 0: Boot sector with shell location info
  sectors[0] = createFilesystemBootSector(shellStartSector, shellSectorCount);

  // Directory sectors (1-3)
  const entriesPerSector = DISK.SECTOR_SIZE / ENTRY_SIZE; // 16

  for (let dirSector = 0; dirSector < DIR_SECTORS; dirSector++) {
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

    sectors[DIR_START + dirSector] = sectorData;
  }

  // Track all used sectors for bitmap
  const usedSectors: number[] = [];
  // Boot sector
  usedSectors.push(0);
  // Directory
  for (let s = 0; s < DIR_SECTORS; s++) {
    usedSectors.push(DIR_START + s);
  }
  // Bitmap
  for (let s = 0; s < BITMAP_SECTORS; s++) {
    usedSectors.push(BITMAP_START + s);
  }
  // File data (skip directories)
  for (const file of files) {
    if (file.isDirectory) continue;
    const sectorsNeeded = Math.ceil(file.data.length / DISK.SECTOR_SIZE) || 1;
    for (let s = 0; s < sectorsNeeded; s++) {
      usedSectors.push(file.startSector! + s);
    }
  }

  // Create bitmap sectors (4-19)
  const bitmapSectors = createBitmap(usedSectors);
  for (let i = 0; i < BITMAP_SECTORS; i++) {
    sectors[BITMAP_START + i] = bitmapSectors[i];
  }

  // File data sectors (20+)
  for (const file of files) {
    if (file.isDirectory) continue;
    const sectorsNeeded = Math.ceil(file.data.length / DISK.SECTOR_SIZE) || 1;

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
  const maxSector = Math.max(...usedSectors) + 1;
  for (let i = 0; i < maxSector; i++) {
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

  return `WireOS Installation Floppy (Standard WireFS Layout)
========================
Layout:
  Sector 0:     Boot sector
  Sectors 1-3:  Directory
  Sectors 4-19: Bitmap
  Sectors 20+:  File data

Files:
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
