// Boot Loader ROM for Wire-HDL Computer
// Reads boot sector from disk, validates, and boots the system
//
// Located at $FC00 in ROM
//
// Boot Sector Format (512 bytes):
//   $00-$01  Magic "WF" (0x57, 0x46)
//   $02-$03  Entry point (little-endian)
//   $04-$05  Load address (little-endian)
//   $06-$07  Sector count (little-endian)
//   $08+     Code/data
//
// Memory Map:
//   $0800 - Default load address for boot sectors
//   $4800 - Disk buffer (512 bytes)
//
// Disk I/O Registers:
//   $8020 - Status (1=ready, 2=busy, 0x80=error)
//   $8021 - Command (1=read, 2=write)
//   $8022 - Sector low
//   $8023 - Sector high
//   $8024 - Buffer address low
//   $8025 - Buffer address high
//   $8026 - Sector count

import { assemble } from '../assembler/stage0.js';
import BOOT_LOADER_SOURCE from '../../asm/boot-loader.asm?raw';

// Boot loader entry point
export const BOOT_LOADER_ENTRY = 0xfc00;

// Boot sector constants
export const BOOT_SECTOR = {
  MAGIC_0: 0x57, // 'W'
  MAGIC_1: 0x46, // 'F'
  OFFSET_ENTRY: 0x02,
  OFFSET_LOAD: 0x04,
  OFFSET_COUNT: 0x06,
  OFFSET_DATA: 0x08,
};

// Default load address
export const DEFAULT_LOAD_ADDRESS = 0x0800;

// Disk I/O registers
export const DISK_IO = {
  STATUS: 0x8020,
  CMD: 0x8021,
  SECTOR_LO: 0x8022,
  SECTOR_HI: 0x8023,
  BUFFER_LO: 0x8024,
  BUFFER_HI: 0x8025,
  COUNT: 0x8026,
};

// Disk commands
export const DISK_CMD = {
  READ: 0x01,
  WRITE: 0x02,
};

// Assembly source for the boot loader
export { BOOT_LOADER_SOURCE };

/**
 * Assemble the boot loader and return the bytes
 */
export function assembleBootLoader(): { bytes: Uint8Array; origin: number } {
  const result = assemble(BOOT_LOADER_SOURCE);
  return {
    bytes: result.bytes,
    origin: BOOT_LOADER_ENTRY,
  };
}

/**
 * Create a boot sector with the given code
 */
export function createBootSector(
  code: Uint8Array,
  entryPoint: number = DEFAULT_LOAD_ADDRESS,
  loadAddress: number = DEFAULT_LOAD_ADDRESS
): Uint8Array {
  const sector = new Uint8Array(512);

  // Magic bytes
  sector[0] = BOOT_SECTOR.MAGIC_0; // 'W'
  sector[1] = BOOT_SECTOR.MAGIC_1; // 'F'

  // Entry point (little-endian)
  sector[2] = entryPoint & 0xff;
  sector[3] = (entryPoint >> 8) & 0xff;

  // Load address (little-endian)
  sector[4] = loadAddress & 0xff;
  sector[5] = (loadAddress >> 8) & 0xff;

  // Sector count (how many sectors including boot sector)
  const totalSectors = Math.ceil((code.length + 8) / 512);
  sector[6] = totalSectors & 0xff;
  sector[7] = (totalSectors >> 8) & 0xff;

  // Copy code to boot sector (starting at offset 8)
  const maxBootCode = 512 - 8; // 504 bytes max in boot sector
  const bootCodeSize = Math.min(code.length, maxBootCode);
  for (let i = 0; i < bootCodeSize; i++) {
    sector[8 + i] = code[i];
  }

  return sector;
}

/**
 * Create a multi-sector boot image
 * Returns array of sectors to write to disk
 */
export function createBootImage(
  code: Uint8Array,
  entryPoint: number = DEFAULT_LOAD_ADDRESS,
  loadAddress: number = DEFAULT_LOAD_ADDRESS
): Uint8Array[] {
  const sectors: Uint8Array[] = [];

  // Create boot sector (sector 0)
  const bootSector = createBootSector(code, entryPoint, loadAddress);
  sectors.push(bootSector);

  // If code is larger than what fits in boot sector, create additional sectors
  const maxBootCode = 512 - 8; // 504 bytes in boot sector
  if (code.length > maxBootCode) {
    const remainingCode = code.subarray(maxBootCode);
    const additionalSectors = Math.ceil(remainingCode.length / 512);

    for (let s = 0; s < additionalSectors; s++) {
      const sector = new Uint8Array(512);
      const offset = s * 512;
      const size = Math.min(512, remainingCode.length - offset);
      for (let i = 0; i < size; i++) {
        sector[i] = remainingCode[offset + i];
      }
      sectors.push(sector);
    }
  }

  return sectors;
}

/**
 * Create combined ROM with hex loader and boot loader
 */
export function createBootRom(): Uint8Array {
  const rom = new Uint8Array(0x4000); // 16KB ROM ($C000-$FFFF)
  rom.fill(0xff); // Fill with $FF (like unprogrammed EPROM)

  // Add boot loader at $FC00
  const { bytes: bootBytes, origin: bootOrigin } = assembleBootLoader();
  const bootOffset = bootOrigin - 0xc000;
  for (let i = 0; i < bootBytes.length && bootOffset + i < rom.length; i++) {
    rom[bootOffset + i] = bootBytes[i];
  }

  // Set reset vector to boot loader
  rom[0x3ffc] = BOOT_LOADER_ENTRY & 0xff;        // $FFFC low byte
  rom[0x3ffd] = (BOOT_LOADER_ENTRY >> 8) & 0xff; // $FFFD high byte

  return rom;
}

// Export source for debugging
export { BOOT_LOADER_SOURCE as source };
