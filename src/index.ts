// Wire-HDL - 6502 Emulator and Bootstrap OS
// Self-hosting assembler and WireOS

// CPU Emulator
export { CPU6502 } from './emulator/cpu.js';

// Stage 0 Assembler (TypeScript reference implementation)
export {
  assemble,
  createRomImage,
  OPCODES,
  HELLO_WORLD,
  COUNTER,
  type AssemblerOutput,
} from './assembler/stage0.js';

// BIOS ROM
export {
  assembleBios,
  getBiosRom,
  BIOS,
  BIOS_SOURCE,
} from './assembler/bios.js';

// Monitor/Debug ROM
export {
  assembleMonitor,
  getMonitorRom,
  MONITOR,
  MONITOR_SOURCE,
} from './assembler/monitor.js';

// Bootstrap - Hex Loader
export {
  assembleHexLoader,
  createHexLoaderRom,
  HEX_LOADER_ZP,
  HEX_LOADER_ENTRY,
  HEX_LOADER_SOURCE,
} from './bootstrap/hex-loader.js';

// Bootstrap - Boot Loader
export {
  assembleBootLoader,
  createBootSector,
  createBootImage,
  createBootRom,
  BOOT_LOADER_ENTRY,
  BOOT_SECTOR,
  DEFAULT_LOAD_ADDRESS,
  DISK_IO,
  DISK_CMD,
  BOOT_LOADER_SOURCE,
} from './bootstrap/boot-loader.js';

// Bootstrap - Stage 0 Assembler
export {
  assembleStage0,
  hexDump,
  intelHex,
  generateStage0Module,
  STAGE0_ENTRY,
} from './bootstrap/stage0-assembler.js';

// WireFS Filesystem
export {
  WireFS,
  WIREFS,
  formatSize,
  formatFilename,
  type DirEntry,
  type FileHandle,
} from './system/wirefs.js';

// Disk abstraction
export { Disk, DISK } from './system/disk.js';
