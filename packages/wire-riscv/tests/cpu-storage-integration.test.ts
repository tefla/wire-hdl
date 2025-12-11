import { describe, it, expect, beforeEach } from 'vitest';
import { RiscVCpu } from '../src/emulator/cpu.js';
import { StorageController, STORAGE_BASE, STORAGE_REGS, StorageCommand, StorageStatus, DeviceType } from '../src/emulator/storage-controller.js';

describe('CPU Storage Integration', () => {
  let cpu: RiscVCpu;

  beforeEach(() => {
    cpu = new RiscVCpu({ memorySize: 64 * 1024 });
  });

  describe('storage controller attachment', () => {
    it('should have storage controller attached', () => {
      expect(cpu.storage).toBeInstanceOf(StorageController);
    });

    it('should be able to get storage controller', () => {
      const storage = cpu.getStorageController();
      expect(storage).toBeInstanceOf(StorageController);
    });
  });

  describe('register access via CPU', () => {
    it('should write to DEVICE_SELECT register via CPU store', () => {
      // Select CD-ROM (device 1)
      cpu.writeWord(STORAGE_BASE + STORAGE_REGS.DEVICE_SELECT, DeviceType.CDROM);
      expect(cpu.storage.readRegister(STORAGE_REGS.DEVICE_SELECT)).toBe(DeviceType.CDROM);
    });

    it('should read STATUS register via CPU load', () => {
      // Initial status should be READY
      const status = cpu.readWord(STORAGE_BASE + STORAGE_REGS.STATUS);
      expect(status & StorageStatus.READY).toBe(StorageStatus.READY);
    });

    it('should write to SECTOR_LO register', () => {
      cpu.writeWord(STORAGE_BASE + STORAGE_REGS.SECTOR_LO, 0x12345678);
      expect(cpu.storage.readRegister(STORAGE_REGS.SECTOR_LO)).toBe(0x12345678);
    });

    it('should write to COUNT register', () => {
      cpu.writeWord(STORAGE_BASE + STORAGE_REGS.COUNT, 8);
      expect(cpu.storage.readRegister(STORAGE_REGS.COUNT)).toBe(8);
    });

    it('should read back written values', () => {
      cpu.writeWord(STORAGE_BASE + STORAGE_REGS.DEVICE_SELECT, DeviceType.USB);
      cpu.writeWord(STORAGE_BASE + STORAGE_REGS.SECTOR_LO, 100);
      cpu.writeWord(STORAGE_BASE + STORAGE_REGS.COUNT, 4);

      expect(cpu.readWord(STORAGE_BASE + STORAGE_REGS.DEVICE_SELECT)).toBe(DeviceType.USB);
      expect(cpu.readWord(STORAGE_BASE + STORAGE_REGS.SECTOR_LO)).toBe(100);
      expect(cpu.readWord(STORAGE_BASE + STORAGE_REGS.COUNT)).toBe(4);
    });
  });

  describe('DMA buffer access via CPU', () => {
    it('should write to DMA buffer via CPU store', () => {
      const dmaBase = STORAGE_BASE + 0x10000; // DMA_BUFFER_OFFSET
      cpu.writeWord(dmaBase, 0xDEADBEEF);

      const buffer = cpu.storage.getDMABuffer();
      expect(buffer[0]).toBe(0xEF);
      expect(buffer[1]).toBe(0xBE);
      expect(buffer[2]).toBe(0xAD);
      expect(buffer[3]).toBe(0xDE);
    });

    it('should read from DMA buffer via CPU load', () => {
      const buffer = cpu.storage.getDMABuffer();
      buffer[0] = 0x12;
      buffer[1] = 0x34;
      buffer[2] = 0x56;
      buffer[3] = 0x78;

      const dmaBase = STORAGE_BASE + 0x10000;
      expect(cpu.readWord(dmaBase)).toBe(0x78563412);
    });

    it('should support byte access to DMA buffer', () => {
      const dmaBase = STORAGE_BASE + 0x10000;
      cpu.writeByte(dmaBase, 0xAA);
      cpu.writeByte(dmaBase + 1, 0xBB);

      expect(cpu.readByte(dmaBase)).toBe(0xAA);
      expect(cpu.readByte(dmaBase + 1)).toBe(0xBB);
    });

    it('should support halfword access to DMA buffer', () => {
      const dmaBase = STORAGE_BASE + 0x10000;
      cpu.writeHalfword(dmaBase, 0x1234);

      expect(cpu.readHalfword(dmaBase)).toBe(0x1234);
    });
  });

  describe('storage operations via CPU instructions', () => {
    it('should execute read command via CPU', () => {
      // First, write some data to HDD sector 0
      const hdd = (cpu.storage as any).hdd;
      const testData = new Uint8Array(512);
      testData.fill(0x42); // Fill with 'B'
      hdd.write(0, testData);

      // Now use CPU to read it:
      // 1. Select HDD (device 0)
      cpu.writeWord(STORAGE_BASE + STORAGE_REGS.DEVICE_SELECT, DeviceType.HDD);
      // 2. Set sector
      cpu.writeWord(STORAGE_BASE + STORAGE_REGS.SECTOR_LO, 0);
      // 3. Set count
      cpu.writeWord(STORAGE_BASE + STORAGE_REGS.COUNT, 1);
      // 4. Execute READ command
      cpu.writeWord(STORAGE_BASE + STORAGE_REGS.COMMAND, StorageCommand.READ);

      // Verify status has DRQ set
      const status = cpu.readWord(STORAGE_BASE + STORAGE_REGS.STATUS);
      expect(status & StorageStatus.DRQ).toBe(StorageStatus.DRQ);

      // Read from DMA buffer
      const dmaBase = STORAGE_BASE + 0x10000;
      expect(cpu.readByte(dmaBase)).toBe(0x42);
      expect(cpu.readByte(dmaBase + 100)).toBe(0x42);
    });

    it('should execute write command via CPU', () => {
      // Write test data to DMA buffer
      const dmaBase = STORAGE_BASE + 0x10000;
      for (let i = 0; i < 512; i++) {
        cpu.writeByte(dmaBase + i, i & 0xFF);
      }

      // Execute write:
      // 1. Select HDD
      cpu.writeWord(STORAGE_BASE + STORAGE_REGS.DEVICE_SELECT, DeviceType.HDD);
      // 2. Set sector 5
      cpu.writeWord(STORAGE_BASE + STORAGE_REGS.SECTOR_LO, 5);
      // 3. Set count
      cpu.writeWord(STORAGE_BASE + STORAGE_REGS.COUNT, 1);
      // 4. Execute WRITE command
      cpu.writeWord(STORAGE_BASE + STORAGE_REGS.COMMAND, StorageCommand.WRITE);

      // Verify by reading back
      const hdd = (cpu.storage as any).hdd;
      const readBack = hdd.read(5, 1);
      expect(readBack[0]).toBe(0);
      expect(readBack[100]).toBe(100);
      expect(readBack[255]).toBe(255);
    });
  });

  describe('address routing', () => {
    it('should route storage addresses to controller', () => {
      cpu.writeWord(STORAGE_BASE + STORAGE_REGS.DEVICE_SELECT, DeviceType.CDROM);
      expect(cpu.storage.readRegister(STORAGE_REGS.DEVICE_SELECT)).toBe(DeviceType.CDROM);
    });

    it('should route RAM addresses to memory', () => {
      cpu.writeWord(0x100, 0xCAFEBABE);
      expect(cpu.readWord(0x100)).toBe(0xCAFEBABE);
    });

    it('should not affect RAM when writing to storage', () => {
      cpu.memory.fill(0xFF, 0, 0x100);
      cpu.writeWord(STORAGE_BASE, 1);
      expect(cpu.memory[0]).toBe(0xFF);
    });

    it('should distinguish between graphics and storage ranges', () => {
      // Write to graphics (0x10000000)
      cpu.writeWord(0x10000000, 1);
      expect(cpu.gpu.getMode()).toBe(1);

      // Write to storage (0x20000000)
      cpu.writeWord(STORAGE_BASE + STORAGE_REGS.DEVICE_SELECT, DeviceType.USB);
      expect(cpu.storage.readRegister(STORAGE_REGS.DEVICE_SELECT)).toBe(DeviceType.USB);
    });
  });

  describe('assembly program storage access', () => {
    it('should access storage via assembly program', () => {
      // Program to select HDD and read status
      // lui a0, 0x20000   ; a0 = 0x20000000 (STORAGE_BASE)
      // sw x0, 0(a0)      ; Select device 0 (HDD)
      // lw t0, 8(a0)      ; Load STATUS register
      // ecall
      const program = new Uint8Array([
        0x37, 0x05, 0x00, 0x20, // lui a0, 0x20000
        0x23, 0x20, 0x05, 0x00, // sw x0, 0(a0)
        0x83, 0x22, 0x85, 0x00, // lw t0, 8(a0)
        0x73, 0x00, 0x00, 0x00, // ecall
      ]);

      cpu.loadProgram(program);
      cpu.run();

      // t0 (x5) should have STATUS (should have READY bit set)
      expect(cpu.getReg(5) & StorageStatus.READY).toBe(StorageStatus.READY);
    });

    it('should write to DMA buffer via assembly program', () => {
      // Program to write 0x42 to DMA buffer
      // lui a0, 0x20010   ; a0 = 0x20010000 (DMA base)
      // addi t0, x0, 0x42 ; t0 = 0x42
      // sb t0, 0(a0)      ; Store to DMA buffer
      // ecall
      const program = new Uint8Array([
        0x37, 0x05, 0x01, 0x20, // lui a0, 0x20010
        0x93, 0x02, 0x20, 0x04, // addi t0, x0, 0x42
        0x23, 0x00, 0x55, 0x00, // sb t0, 0(a0)
        0x73, 0x00, 0x00, 0x00, // ecall
      ]);

      cpu.loadProgram(program);
      cpu.run();

      const buffer = cpu.storage.getDMABuffer();
      expect(buffer[0]).toBe(0x42);
    });
  });
});
