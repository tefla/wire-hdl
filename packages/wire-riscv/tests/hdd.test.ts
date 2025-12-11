import { describe, it, expect, beforeEach } from 'vitest';
import {
  HardDiskDrive,
  MBR_SIGNATURE,
  parseMBRPartitionTable,
  createEmptyMBR,
} from '../src/emulator/hdd.js';
import { BlockDeviceError } from '../src/emulator/block-device.js';

describe('HardDiskDrive', () => {
  describe('creation', () => {
    it('should create HDD with default 64MB size', () => {
      const hdd = new HardDiskDrive();
      expect(hdd.sectorSize).toBe(512);
      expect(hdd.sectorCount).toBe(64 * 1024 * 2); // 64MB / 512
      expect(hdd.isReadOnly).toBe(false);
    });

    it('should create HDD with custom size', () => {
      const hdd = new HardDiskDrive(128 * 1024 * 1024); // 128MB
      expect(hdd.sectorCount).toBe(128 * 1024 * 2);
    });

    it('should create HDD with minimum size', () => {
      const hdd = new HardDiskDrive(512); // 1 sector
      expect(hdd.sectorCount).toBe(1);
    });

    it('should round down size to sector boundary', () => {
      const hdd = new HardDiskDrive(1000); // Not aligned to 512
      expect(hdd.sectorCount).toBe(1); // 512 bytes = 1 sector
    });
  });

  describe('geometry', () => {
    let hdd: HardDiskDrive;

    beforeEach(() => {
      hdd = new HardDiskDrive();
    });

    it('should have 512-byte sectors', () => {
      expect(hdd.sectorSize).toBe(512);
    });

    it('should report correct total size', () => {
      expect(hdd.getTotalBytes()).toBe(64 * 1024 * 1024);
    });

    it('should not be read-only', () => {
      expect(hdd.isReadOnly).toBe(false);
    });
  });

  describe('basic operations', () => {
    let hdd: HardDiskDrive;

    beforeEach(() => {
      hdd = new HardDiskDrive(1024 * 1024); // 1MB for faster tests
    });

    it('should read sector 0 (boot sector)', () => {
      const data = hdd.read(0, 1);
      expect(data.length).toBe(512);
    });

    it('should write and read sector 0', () => {
      const testData = new Uint8Array(512);
      for (let i = 0; i < 512; i++) testData[i] = i & 0xff;

      hdd.write(0, testData);
      const readData = hdd.read(0, 1);

      expect(readData).toEqual(testData);
    });

    it('should read multiple consecutive sectors', () => {
      const data = hdd.read(0, 8);
      expect(data.length).toBe(512 * 8);
    });

    it('should write multiple consecutive sectors', () => {
      const testData = new Uint8Array(512 * 4);
      for (let i = 0; i < testData.length; i++) testData[i] = (i * 3) & 0xff;

      hdd.write(10, testData);
      const readData = hdd.read(10, 4);

      expect(readData).toEqual(testData);
    });

    it('should support random access read/write', () => {
      const sector100 = new Uint8Array(512).fill(0xaa);
      const sector500 = new Uint8Array(512).fill(0xbb);
      const sector1000 = new Uint8Array(512).fill(0xcc);

      hdd.write(100, sector100);
      hdd.write(500, sector500);
      hdd.write(1000, sector1000);

      expect(hdd.read(100, 1)).toEqual(sector100);
      expect(hdd.read(500, 1)).toEqual(sector500);
      expect(hdd.read(1000, 1)).toEqual(sector1000);
    });
  });

  describe('disk image operations', () => {
    let hdd: HardDiskDrive;

    beforeEach(() => {
      hdd = new HardDiskDrive(4096); // Small disk for testing
    });

    it('should export disk image', () => {
      const testData = new Uint8Array(512).fill(0x42);
      hdd.write(0, testData);

      const image = hdd.exportImage();
      expect(image.length).toBe(4096);
      expect(image.slice(0, 512)).toEqual(testData);
    });

    it('should import disk image', () => {
      const image = new Uint8Array(4096);
      for (let i = 0; i < 4096; i++) image[i] = i & 0xff;

      hdd.importImage(image);
      const readData = hdd.read(0, 8);

      expect(readData).toEqual(image);
    });

    it('should create disk from image', () => {
      const image = new Uint8Array(2048);
      image.fill(0x55);

      const newHdd = HardDiskDrive.fromImage(image);
      expect(newHdd.sectorCount).toBe(4);
      expect(newHdd.read(0, 1)[0]).toBe(0x55);
    });
  });

  describe('error handling', () => {
    let hdd: HardDiskDrive;

    beforeEach(() => {
      hdd = new HardDiskDrive(1024 * 1024);
    });

    it('should throw on read beyond disk size', () => {
      expect(() => hdd.read(hdd.sectorCount, 1)).toThrow(BlockDeviceError);
    });

    it('should throw on write beyond disk size', () => {
      const data = new Uint8Array(512);
      expect(() => hdd.write(hdd.sectorCount, data)).toThrow(BlockDeviceError);
    });

    it('should throw on negative sector number', () => {
      expect(() => hdd.read(-1, 1)).toThrow(BlockDeviceError);
    });

    it('should throw on invalid count', () => {
      expect(() => hdd.read(0, 0)).toThrow(BlockDeviceError);
    });

    it('should throw on image import size mismatch', () => {
      const wrongSize = new Uint8Array(1000); // Not matching disk size
      expect(() => hdd.importImage(wrongSize)).toThrow();
    });
  });

  describe('flush', () => {
    it('should complete flush without error', () => {
      const hdd = new HardDiskDrive(4096);
      hdd.write(0, new Uint8Array(512).fill(0xff));
      expect(() => hdd.flush()).not.toThrow();
    });
  });
});

describe('MBR Partition Table', () => {
  describe('createEmptyMBR', () => {
    it('should create valid MBR with signature', () => {
      const mbr = createEmptyMBR();
      expect(mbr.length).toBe(512);
      expect(mbr[510]).toBe(0x55);
      expect(mbr[511]).toBe(0xaa);
    });

    it('should have empty partition table', () => {
      const mbr = createEmptyMBR();
      const partitions = parseMBRPartitionTable(mbr);
      expect(partitions.length).toBe(4);
      expect(partitions.every((p) => !p.active && p.type === 0)).toBe(true);
    });
  });

  describe('parseMBRPartitionTable', () => {
    it('should parse empty MBR', () => {
      const mbr = createEmptyMBR();
      const partitions = parseMBRPartitionTable(mbr);

      expect(partitions.length).toBe(4);
      partitions.forEach((p) => {
        expect(p.type).toBe(0);
        expect(p.lbaStart).toBe(0);
        expect(p.sectorCount).toBe(0);
      });
    });

    it('should detect boot signature', () => {
      const mbr = createEmptyMBR();
      expect(mbr[510]).toBe(MBR_SIGNATURE & 0xff);
      expect(mbr[511]).toBe((MBR_SIGNATURE >> 8) & 0xff);
    });

    it('should parse partition with data', () => {
      const mbr = createEmptyMBR();

      // Set up first partition: FAT32 LBA, starting at sector 2048, 102400 sectors
      const partOffset = 446; // First partition entry
      mbr[partOffset + 0] = 0x80; // Active
      mbr[partOffset + 4] = 0x0c; // FAT32 LBA
      mbr[partOffset + 8] = 0x00; // LBA start low
      mbr[partOffset + 9] = 0x08;
      mbr[partOffset + 10] = 0x00;
      mbr[partOffset + 11] = 0x00;
      mbr[partOffset + 12] = 0x00; // Sector count low
      mbr[partOffset + 13] = 0x90;
      mbr[partOffset + 14] = 0x01;
      mbr[partOffset + 15] = 0x00;

      const partitions = parseMBRPartitionTable(mbr);

      expect(partitions[0].active).toBe(true);
      expect(partitions[0].type).toBe(0x0c);
      expect(partitions[0].lbaStart).toBe(2048);
      expect(partitions[0].sectorCount).toBe(102400);
    });

    it('should return empty partitions for non-MBR data', () => {
      const notMbr = new Uint8Array(512);
      // No boot signature
      const partitions = parseMBRPartitionTable(notMbr);

      expect(partitions.length).toBe(4);
      expect(partitions.every((p) => p.type === 0)).toBe(true);
    });
  });

  describe('HDD with MBR', () => {
    it('should initialize with empty MBR', () => {
      const hdd = new HardDiskDrive(64 * 1024 * 1024);
      hdd.initializeMBR();

      const mbr = hdd.read(0, 1);
      expect(mbr[510]).toBe(0x55);
      expect(mbr[511]).toBe(0xaa);
    });

    it('should read partition table from sector 0', () => {
      const hdd = new HardDiskDrive(64 * 1024 * 1024);
      hdd.initializeMBR();

      const partitions = hdd.getPartitionTable();
      expect(partitions.length).toBe(4);
    });
  });
});
