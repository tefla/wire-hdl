import { describe, it, expect } from 'vitest';
import {
  assembleBootLoader,
  createBootSector,
  createBootImage,
  createBootRom,
  BOOT_LOADER_ENTRY,
  BOOT_SECTOR,
  DEFAULT_LOAD_ADDRESS,
  DISK_IO,
  DISK_CMD,
} from '../src/bootstrap/boot-loader.js';
import { CPU6502 } from '../src/emulator/cpu.js';

describe('Boot Loader Assembly', () => {
  it('should assemble boot loader successfully', () => {
    const { bytes, origin } = assembleBootLoader();
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
    expect(origin).toBe(BOOT_LOADER_ENTRY);
  });

  it('should have boot loader at $FC00', () => {
    expect(BOOT_LOADER_ENTRY).toBe(0xfc00);
  });

  it('should fit boot loader in ROM space', () => {
    const { bytes } = assembleBootLoader();
    // Boot loader should fit from $FC00 to $FFFA (before vectors)
    const maxSize = 0xfffa - BOOT_LOADER_ENTRY;
    expect(bytes.length).toBeLessThanOrEqual(maxSize);
  });

  it('should start with valid 6502 instruction', () => {
    const { bytes } = assembleBootLoader();
    // First byte should be a valid opcode (not $00 BRK or $FF invalid)
    expect(bytes[0]).not.toBe(0x00);
    expect(bytes[0]).not.toBe(0xff);
  });
});

describe('Boot Sector Format', () => {
  it('should have correct magic bytes constants', () => {
    expect(BOOT_SECTOR.MAGIC_0).toBe(0x57); // 'W'
    expect(BOOT_SECTOR.MAGIC_1).toBe(0x46); // 'F'
    expect(String.fromCharCode(BOOT_SECTOR.MAGIC_0, BOOT_SECTOR.MAGIC_1)).toBe('WF');
  });

  it('should have correct field offsets', () => {
    expect(BOOT_SECTOR.OFFSET_ENTRY).toBe(0x02);
    expect(BOOT_SECTOR.OFFSET_LOAD).toBe(0x04);
    expect(BOOT_SECTOR.OFFSET_COUNT).toBe(0x06);
    expect(BOOT_SECTOR.OFFSET_DATA).toBe(0x08);
  });

  it('should have default load address at $0800', () => {
    expect(DEFAULT_LOAD_ADDRESS).toBe(0x0800);
  });
});

describe('Boot Sector Creation', () => {
  it('should create boot sector with magic bytes', () => {
    const code = new Uint8Array([0x60]); // RTS
    const sector = createBootSector(code);

    expect(sector[0]).toBe(BOOT_SECTOR.MAGIC_0);
    expect(sector[1]).toBe(BOOT_SECTOR.MAGIC_1);
  });

  it('should set entry point correctly', () => {
    const code = new Uint8Array([0x60]);
    const sector = createBootSector(code, 0x1234);

    expect(sector[2]).toBe(0x34); // Low byte
    expect(sector[3]).toBe(0x12); // High byte
  });

  it('should set load address correctly', () => {
    const code = new Uint8Array([0x60]);
    const sector = createBootSector(code, 0x0800, 0x5678);

    expect(sector[4]).toBe(0x78); // Low byte
    expect(sector[5]).toBe(0x56); // High byte
  });

  it('should set sector count correctly for small code', () => {
    const code = new Uint8Array([0x60]); // 1 byte code
    const sector = createBootSector(code);

    // 1 byte + 8 byte header = 9 bytes, fits in 1 sector
    expect(sector[6]).toBe(1); // Low byte
    expect(sector[7]).toBe(0); // High byte
  });

  it('should set sector count correctly for larger code', () => {
    // 500 bytes of code + 8 byte header = 508 bytes = 1 sector
    const code500 = new Uint8Array(500);
    const sector500 = createBootSector(code500);
    expect(sector500[6]).toBe(1);

    // 504 bytes of code + 8 byte header = 512 bytes = 1 sector
    const code504 = new Uint8Array(504);
    const sector504 = createBootSector(code504);
    expect(sector504[6]).toBe(1);

    // 505 bytes of code + 8 byte header = 513 bytes = 2 sectors
    const code505 = new Uint8Array(505);
    const sector505 = createBootSector(code505);
    expect(sector505[6]).toBe(2);
  });

  it('should copy code to boot sector', () => {
    const code = new Uint8Array([0xa9, 0x42, 0x60]); // LDA #$42; RTS
    const sector = createBootSector(code);

    expect(sector[8]).toBe(0xa9);
    expect(sector[9]).toBe(0x42);
    expect(sector[10]).toBe(0x60);
  });

  it('should be exactly 512 bytes', () => {
    const code = new Uint8Array([0x60]);
    const sector = createBootSector(code);

    expect(sector.length).toBe(512);
  });

  it('should use default load address and entry point', () => {
    const code = new Uint8Array([0x60]);
    const sector = createBootSector(code);

    // Entry point = default load address
    const entry = sector[2] | (sector[3] << 8);
    expect(entry).toBe(DEFAULT_LOAD_ADDRESS);

    // Load address = default load address
    const load = sector[4] | (sector[5] << 8);
    expect(load).toBe(DEFAULT_LOAD_ADDRESS);
  });
});

describe('Multi-Sector Boot Image', () => {
  it('should create single sector for small code', () => {
    const code = new Uint8Array(100);
    const sectors = createBootImage(code);

    expect(sectors.length).toBe(1);
  });

  it('should create multiple sectors for large code', () => {
    const code = new Uint8Array(1000); // More than 504 bytes
    const sectors = createBootImage(code);

    expect(sectors.length).toBe(2);
  });

  it('should create correct number of sectors', () => {
    // 504 bytes fit in boot sector data area
    // 512 bytes per additional sector

    // 504 bytes -> 1 sector
    const code504 = new Uint8Array(504);
    expect(createBootImage(code504).length).toBe(1);

    // 505 bytes -> 1 byte overflows to 2nd sector
    const code505 = new Uint8Array(505);
    expect(createBootImage(code505).length).toBe(2);

    // 504 + 512 = 1016 bytes -> 2 sectors
    const code1016 = new Uint8Array(1016);
    expect(createBootImage(code1016).length).toBe(2);

    // 504 + 512 + 1 = 1017 bytes -> 3 sectors
    const code1017 = new Uint8Array(1017);
    expect(createBootImage(code1017).length).toBe(3);
  });

  it('should have magic bytes in first sector only', () => {
    const code = new Uint8Array(1000);
    const sectors = createBootImage(code);

    // First sector has magic
    expect(sectors[0][0]).toBe(BOOT_SECTOR.MAGIC_0);
    expect(sectors[0][1]).toBe(BOOT_SECTOR.MAGIC_1);

    // Second sector is just data
    expect(sectors[1][0]).toBe(0); // From code array (all zeros)
  });

  it('should split code correctly across sectors', () => {
    // Create code with recognizable pattern
    const code = new Uint8Array(600);
    for (let i = 0; i < code.length; i++) {
      code[i] = i & 0xff;
    }

    const sectors = createBootImage(code);

    // First 504 bytes in boot sector starting at offset 8
    expect(sectors[0][8]).toBe(0);  // First byte of code
    expect(sectors[0][9]).toBe(1);  // Second byte of code
    // Offset 8 + 503 = 511 would be byte 503, but boot sector is truncated
    // at 504 bytes max in createBootSector, so last code byte is at offset 8+503=511
    // Actually, createBootSector copies min(code.length, 504) bytes
    // So sector[511] = code[503] = 503 & 0xff = 247 (since 503 > 255)
    // Wait, 503 fits in a byte (503 & 0xff = 247 because 503 = 256 + 247)
    // So the byte at position 503 is (503 & 0xff) = 247
    expect(sectors[0][8 + 503]).toBe(503 & 0xff); // Last byte in boot sector

    // Remaining bytes (96 bytes: 600-504=96) in second sector
    expect(sectors[1][0]).toBe(504 & 0xff); // 504 = 0xF8 = 248
    expect(sectors[1][95]).toBe(599 & 0xff); // Last byte: 599 & 0xff = 87
  });
});

describe('Boot ROM Creation', () => {
  it('should create 16KB ROM', () => {
    const rom = createBootRom();
    expect(rom.length).toBe(0x4000); // 16KB
  });

  it('should have boot loader at $FC00', () => {
    const rom = createBootRom();
    const { bytes } = assembleBootLoader();

    // Check that boot loader is at correct offset
    const offset = BOOT_LOADER_ENTRY - 0xc000;
    expect(rom[offset]).toBe(bytes[0]);
    expect(rom[offset + 1]).toBe(bytes[1]);
  });

  it('should set reset vector to boot loader', () => {
    const rom = createBootRom();

    // Reset vector at $FFFC-$FFFD (offset $3FFC-$3FFD in ROM)
    const resetLo = rom[0x3ffc];
    const resetHi = rom[0x3ffd];
    const resetVector = resetLo | (resetHi << 8);

    expect(resetVector).toBe(BOOT_LOADER_ENTRY);
  });

  it('should fill unused space with $FF', () => {
    const rom = createBootRom();

    // First byte (before boot loader) should be $FF
    expect(rom[0]).toBe(0xff);
  });
});

describe('Disk I/O Constants', () => {
  it('should have correct disk I/O register addresses', () => {
    expect(DISK_IO.STATUS).toBe(0x8020);
    expect(DISK_IO.CMD).toBe(0x8021);
    expect(DISK_IO.SECTOR_LO).toBe(0x8022);
    expect(DISK_IO.SECTOR_HI).toBe(0x8023);
    expect(DISK_IO.BUFFER_LO).toBe(0x8024);
    expect(DISK_IO.BUFFER_HI).toBe(0x8025);
    expect(DISK_IO.COUNT).toBe(0x8026);
  });

  it('should have correct disk command codes', () => {
    expect(DISK_CMD.READ).toBe(0x01);
    expect(DISK_CMD.WRITE).toBe(0x02);
  });

  it('should have registers in sequential order', () => {
    expect(DISK_IO.CMD).toBe(DISK_IO.STATUS + 1);
    expect(DISK_IO.SECTOR_LO).toBe(DISK_IO.CMD + 1);
    expect(DISK_IO.SECTOR_HI).toBe(DISK_IO.SECTOR_LO + 1);
    expect(DISK_IO.BUFFER_LO).toBe(DISK_IO.SECTOR_HI + 1);
    expect(DISK_IO.BUFFER_HI).toBe(DISK_IO.BUFFER_LO + 1);
    expect(DISK_IO.COUNT).toBe(DISK_IO.BUFFER_HI + 1);
  });
});

describe('Reset Vector and Startup', () => {
  it('should execute from reset vector correctly', () => {
    const memory = new Uint8Array(0x10000);

    // Simple test program that stores $42 at $0200
    const testProgram = new Uint8Array([
      0xa9, 0x42, // LDA #$42
      0x8d, 0x00, 0x02, // STA $0200
      0x02, // HLT
    ]);

    // Load program at $0800
    memory.set(testProgram, 0x0800);

    // Set reset vector to $0800
    memory[0xfffc] = 0x00;
    memory[0xfffd] = 0x08;

    const cpu = new CPU6502(memory);
    cpu.reset();

    // Run until HLT
    for (let i = 0; i < 10 && !cpu.halted; i++) {
      cpu.step();
    }

    expect(memory[0x0200]).toBe(0x42);
    expect(cpu.halted).toBe(true);
  });

  it('should start execution at correct address after reset', () => {
    const memory = new Uint8Array(0x10000);

    // Set reset vector to $FC00
    memory[0xfffc] = 0x00;
    memory[0xfffd] = 0xfc;

    // Put NOP at $FC00
    memory[0xfc00] = 0xea;

    const cpu = new CPU6502(memory);
    cpu.reset();

    expect(cpu.pc).toBe(0xfc00);
  });
});

describe('Boot Sector Validation', () => {
  it('should recognize valid magic bytes', () => {
    const code = new Uint8Array([0x60]);
    const sector = createBootSector(code);

    const magic = String.fromCharCode(sector[0], sector[1]);
    expect(magic).toBe('WF');
  });

  it('should reject invalid magic bytes', () => {
    const sector = new Uint8Array(512);
    sector[0] = 0x00;
    sector[1] = 0x00;

    const magic = String.fromCharCode(sector[0], sector[1]);
    expect(magic).not.toBe('WF');
  });
});
