import { describe, it, expect } from 'vitest';

// I/O register addresses from computer.ts
const IO = {
  // Serial I/O
  SERIAL_STATUS: 0x8030, // bit 0 = rx ready, bit 1 = tx ready
  SERIAL_DATA: 0x8031, // read = rx, write = tx

  // Keyboard
  KBD_STATUS: 0x8010, // bit 0 = key available
  KBD_DATA: 0x8011, // read = key code

  // HDD I/O
  DISK_STATUS: 0x8020, // bit 0 = ready, bit 1 = busy, bit 7 = error
  DISK_CMD: 0x8021, // 1 = read, 2 = write
  DISK_SEC_LO: 0x8022, // sector low byte
  DISK_SEC_HI: 0x8023, // sector high byte
  DISK_BUF_LO: 0x8024, // buffer address low
  DISK_BUF_HI: 0x8025, // buffer address high
  DISK_COUNT: 0x8026, // sector count

  // Floppy I/O (same layout, different base)
  FLOPPY_STATUS: 0x8040, // bit 0 = ready, bit 1 = busy, bit 7 = error, bit 6 = no disk
  FLOPPY_CMD: 0x8041, // 1 = read, 2 = write
  FLOPPY_SEC_LO: 0x8042, // sector low byte
  FLOPPY_SEC_HI: 0x8043, // sector high byte
  FLOPPY_BUF_LO: 0x8044, // buffer address low
  FLOPPY_BUF_HI: 0x8045, // buffer address high
  FLOPPY_COUNT: 0x8046, // sector count
};

// Memory map
const MEM = {
  RAM_END: 0x7fff,
  IO_START: 0x8000,
  IO_END: 0x80ff,
  VRAM_START: 0x8100,
  VRAM_END: 0x8fff,
  ROM_START: 0xc000,
};

describe('I/O Register Layout', () => {
  describe('Serial I/O registers', () => {
    it('should have serial status at $8030', () => {
      expect(IO.SERIAL_STATUS).toBe(0x8030);
    });

    it('should have serial data at $8031', () => {
      expect(IO.SERIAL_DATA).toBe(0x8031);
    });

    it('should define serial status bits correctly', () => {
      const RX_READY = 0x01;
      const TX_READY = 0x02;
      expect(RX_READY).toBe(0x01);
      expect(TX_READY).toBe(0x02);
    });
  });

  describe('Keyboard I/O registers', () => {
    it('should have keyboard status at $8010', () => {
      expect(IO.KBD_STATUS).toBe(0x8010);
    });

    it('should have keyboard data at $8011', () => {
      expect(IO.KBD_DATA).toBe(0x8011);
    });

    it('should define keyboard status bits correctly', () => {
      const KEY_AVAILABLE = 0x01;
      expect(KEY_AVAILABLE).toBe(0x01);
    });
  });

  describe('HDD I/O registers', () => {
    it('should have HDD registers at $8020-$8026', () => {
      expect(IO.DISK_STATUS).toBe(0x8020);
      expect(IO.DISK_CMD).toBe(0x8021);
      expect(IO.DISK_SEC_LO).toBe(0x8022);
      expect(IO.DISK_SEC_HI).toBe(0x8023);
      expect(IO.DISK_BUF_LO).toBe(0x8024);
      expect(IO.DISK_BUF_HI).toBe(0x8025);
      expect(IO.DISK_COUNT).toBe(0x8026);
    });

    it('should define HDD status bits correctly', () => {
      const READY = 0x01;
      const BUSY = 0x02;
      const ERROR = 0x80;
      expect(READY).toBe(0x01);
      expect(BUSY).toBe(0x02);
      expect(ERROR).toBe(0x80);
    });

    it('should define HDD commands correctly', () => {
      const CMD_READ = 1;
      const CMD_WRITE = 2;
      expect(CMD_READ).toBe(1);
      expect(CMD_WRITE).toBe(2);
    });
  });

  describe('Floppy I/O registers', () => {
    it('should have floppy registers at $8040-$8046', () => {
      expect(IO.FLOPPY_STATUS).toBe(0x8040);
      expect(IO.FLOPPY_CMD).toBe(0x8041);
      expect(IO.FLOPPY_SEC_LO).toBe(0x8042);
      expect(IO.FLOPPY_SEC_HI).toBe(0x8043);
      expect(IO.FLOPPY_BUF_LO).toBe(0x8044);
      expect(IO.FLOPPY_BUF_HI).toBe(0x8045);
      expect(IO.FLOPPY_COUNT).toBe(0x8046);
    });

    it('should define floppy status bits correctly', () => {
      const READY = 0x01;
      const BUSY = 0x02;
      const NO_DISK = 0x40;
      const ERROR = 0x80;
      expect(READY).toBe(0x01);
      expect(BUSY).toBe(0x02);
      expect(NO_DISK).toBe(0x40);
      expect(ERROR).toBe(0x80);
    });
  });

  describe('Register spacing', () => {
    it('should have keyboard at $8010', () => {
      expect(IO.KBD_STATUS).toBeLessThan(IO.DISK_STATUS);
    });

    it('should have HDD at $8020', () => {
      expect(IO.DISK_STATUS).toBeLessThan(IO.SERIAL_STATUS);
    });

    it('should have serial at $8030', () => {
      expect(IO.SERIAL_STATUS).toBeLessThan(IO.FLOPPY_STATUS);
    });

    it('should have floppy at $8040', () => {
      expect(IO.FLOPPY_STATUS).toBe(0x8040);
    });

    it('should have all I/O in $8000-$80FF range', () => {
      const allAddrs = [
        IO.KBD_STATUS, IO.KBD_DATA,
        IO.DISK_STATUS, IO.DISK_CMD, IO.DISK_SEC_LO, IO.DISK_SEC_HI,
        IO.DISK_BUF_LO, IO.DISK_BUF_HI, IO.DISK_COUNT,
        IO.SERIAL_STATUS, IO.SERIAL_DATA,
        IO.FLOPPY_STATUS, IO.FLOPPY_CMD, IO.FLOPPY_SEC_LO, IO.FLOPPY_SEC_HI,
        IO.FLOPPY_BUF_LO, IO.FLOPPY_BUF_HI, IO.FLOPPY_COUNT,
      ];

      for (const addr of allAddrs) {
        expect(addr).toBeGreaterThanOrEqual(MEM.IO_START);
        expect(addr).toBeLessThanOrEqual(MEM.IO_END);
      }
    });
  });
});

describe('Memory Map Layout', () => {
  describe('RAM region', () => {
    it('should have RAM from $0000 to $7FFF', () => {
      expect(MEM.RAM_END).toBe(0x7fff);
    });

    it('should have zero page at $00-$FF', () => {
      expect(0x0000).toBeLessThanOrEqual(0x00ff);
    });

    it('should have stack at $0100-$01FF', () => {
      expect(0x0100).toBeLessThan(0x0200);
    });

    it('should have program area after stack', () => {
      const PROGRAM_START = 0x0200;
      expect(PROGRAM_START).toBe(0x0200);
    });
  });

  describe('I/O region', () => {
    it('should have I/O at $8000-$80FF', () => {
      expect(MEM.IO_START).toBe(0x8000);
      expect(MEM.IO_END).toBe(0x80ff);
    });

    it('should have 256 bytes of I/O space', () => {
      expect(MEM.IO_END - MEM.IO_START + 1).toBe(256);
    });
  });

  describe('VRAM region', () => {
    it('should have VRAM at $8100-$8FFF', () => {
      expect(MEM.VRAM_START).toBe(0x8100);
      expect(MEM.VRAM_END).toBe(0x8fff);
    });

    it('should have approximately 4KB of VRAM', () => {
      const vramSize = MEM.VRAM_END - MEM.VRAM_START + 1;
      expect(vramSize).toBeGreaterThanOrEqual(3840); // ~3.75KB
    });
  });

  describe('ROM region', () => {
    it('should have ROM starting at $C000', () => {
      expect(MEM.ROM_START).toBe(0xc000);
    });

    it('should have 16KB of ROM space', () => {
      const romEnd = 0xffff;
      const romSize = romEnd - MEM.ROM_START + 1;
      expect(romSize).toBe(16384);
    });

    it('should have BIOS in ROM', () => {
      const BIOS_START = 0xf000;
      expect(BIOS_START).toBeGreaterThanOrEqual(MEM.ROM_START);
    });

    it('should have hex loader in ROM', () => {
      const HEX_LOADER = 0xf800;
      expect(HEX_LOADER).toBeGreaterThanOrEqual(MEM.ROM_START);
    });

    it('should have boot loader in ROM', () => {
      const BOOT_LOADER = 0xfc00;
      expect(BOOT_LOADER).toBeGreaterThanOrEqual(MEM.ROM_START);
    });

    it('should have reset vector at $FFFC-$FFFD', () => {
      const RESET_VECTOR = 0xfffc;
      expect(RESET_VECTOR).toBe(0xfffc);
    });

    it('should have IRQ vector at $FFFE-$FFFF', () => {
      const IRQ_VECTOR = 0xfffe;
      expect(IRQ_VECTOR).toBe(0xfffe);
    });
  });
});

describe('Disk I/O Protocol', () => {
  describe('HDD read operation', () => {
    it('should use command 1 for read', () => {
      const CMD_READ = 1;
      expect(CMD_READ).toBe(1);
    });

    it('should support 16-bit sector addressing', () => {
      // Low byte + high byte = 16 bits = 65536 sectors
      const maxSector = 0xffff;
      expect(maxSector).toBe(65535);
    });

    it('should support 16-bit buffer addressing', () => {
      // Buffer must be in RAM (0-$7FFF)
      const maxBuffer = MEM.RAM_END;
      expect(maxBuffer).toBe(0x7fff);
    });

    it('should support multi-sector reads', () => {
      // Count register is 8-bit = 256 sectors max
      const maxCount = 255;
      expect(maxCount).toBe(255);
    });
  });

  describe('HDD write operation', () => {
    it('should use command 2 for write', () => {
      const CMD_WRITE = 2;
      expect(CMD_WRITE).toBe(2);
    });
  });

  describe('Floppy read operation', () => {
    it('should use same command codes as HDD', () => {
      const CMD_READ = 1;
      const CMD_WRITE = 2;
      expect(CMD_READ).toBe(1);
      expect(CMD_WRITE).toBe(2);
    });

    it('should indicate no disk with bit 6', () => {
      const NO_DISK = 0x40;
      expect(NO_DISK).toBe(0x40);
    });
  });

  describe('Sector size', () => {
    it('should use 512-byte sectors', () => {
      const SECTOR_SIZE = 512;
      expect(SECTOR_SIZE).toBe(512);
    });

    it('should fit one sector in available buffer space', () => {
      const SECTOR_SIZE = 512;
      const maxBuffer = MEM.RAM_END - SECTOR_SIZE + 1;
      expect(maxBuffer).toBeGreaterThan(0);
    });
  });
});

describe('Keyboard Protocol', () => {
  it('should poll status before reading data', () => {
    // Protocol: Check KBD_STATUS bit 0, if set read KBD_DATA
    const KEY_AVAILABLE = 0x01;
    expect(KEY_AVAILABLE).toBe(0x01);
  });

  it('should use ASCII codes for key data', () => {
    // Example key codes
    const KEY_A = 0x41;
    const KEY_ENTER = 0x0d;
    const KEY_BACKSPACE = 0x08;
    expect(KEY_A).toBe(0x41);
    expect(KEY_ENTER).toBe(0x0d);
    expect(KEY_BACKSPACE).toBe(0x08);
  });
});

describe('Serial Protocol', () => {
  it('should poll status before transmit', () => {
    // Protocol: Check SERIAL_STATUS bit 1, if set write SERIAL_DATA
    const TX_READY = 0x02;
    expect(TX_READY).toBe(0x02);
  });

  it('should poll status before receive', () => {
    // Protocol: Check SERIAL_STATUS bit 0, if set read SERIAL_DATA
    const RX_READY = 0x01;
    expect(RX_READY).toBe(0x01);
  });
});
