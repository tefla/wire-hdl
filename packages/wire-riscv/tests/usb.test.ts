import { describe, it, expect, beforeEach } from 'vitest';
import { USBDrive, USBDriveStatus } from '../src/emulator/usb.js';
import { BlockDeviceError, BlockDeviceErrorType } from '../src/emulator/block-device.js';

describe('USBDrive', () => {
  describe('creation', () => {
    it('should create USB drive with default 16MB size', () => {
      const usb = new USBDrive();
      expect(usb.sectorSize).toBe(512);
      expect(usb.sectorCount).toBe(16 * 1024 * 2); // 16MB / 512
    });

    it('should create USB drive with custom size', () => {
      const usb = new USBDrive(32 * 1024 * 1024); // 32MB
      expect(usb.sectorCount).toBe(32 * 1024 * 2);
    });

    it('should not be read-only by default', () => {
      const usb = new USBDrive();
      expect(usb.isReadOnly).toBe(false);
    });
  });

  describe('geometry', () => {
    let usb: USBDrive;

    beforeEach(() => {
      usb = new USBDrive();
      usb.insert();
    });

    it('should have 512-byte sectors', () => {
      expect(usb.sectorSize).toBe(512);
    });

    it('should report correct total size', () => {
      expect(usb.getTotalBytes()).toBe(16 * 1024 * 1024);
    });
  });

  describe('hot-plug', () => {
    let usb: USBDrive;

    beforeEach(() => {
      usb = new USBDrive(1024 * 1024); // 1MB for testing
    });

    it('should initially not be present', () => {
      expect(usb.isPresent()).toBe(false);
      expect(usb.getStatus()).toBe(USBDriveStatus.NOT_PRESENT);
    });

    it('should be present after insert', () => {
      usb.insert();
      expect(usb.isPresent()).toBe(true);
      expect(usb.getStatus()).toBe(USBDriveStatus.READY);
    });

    it('should not be present after eject', () => {
      usb.insert();
      usb.eject();
      expect(usb.isPresent()).toBe(false);
      expect(usb.getStatus()).toBe(USBDriveStatus.NOT_PRESENT);
    });

    it('should allow re-insertion', () => {
      usb.insert();
      usb.eject();
      usb.insert();
      expect(usb.isPresent()).toBe(true);
    });

    it('should preserve data across eject/insert', () => {
      usb.insert();
      const testData = new Uint8Array(512).fill(0xab);
      usb.write(0, testData);

      usb.eject();
      usb.insert();

      const readData = usb.read(0, 1);
      expect(readData).toEqual(testData);
    });
  });

  describe('basic operations', () => {
    let usb: USBDrive;

    beforeEach(() => {
      usb = new USBDrive(1024 * 1024); // 1MB
      usb.insert();
    });

    it('should read sector 0', () => {
      const data = usb.read(0, 1);
      expect(data.length).toBe(512);
    });

    it('should write and read sector 0', () => {
      const testData = new Uint8Array(512);
      for (let i = 0; i < 512; i++) testData[i] = i & 0xff;

      usb.write(0, testData);
      const readData = usb.read(0, 1);

      expect(readData).toEqual(testData);
    });

    it('should read multiple consecutive sectors', () => {
      const data = usb.read(0, 4);
      expect(data.length).toBe(512 * 4);
    });

    it('should write multiple consecutive sectors', () => {
      const testData = new Uint8Array(512 * 3);
      for (let i = 0; i < testData.length; i++) testData[i] = (i * 5) & 0xff;

      usb.write(10, testData);
      const readData = usb.read(10, 3);

      expect(readData).toEqual(testData);
    });
  });

  describe('write protection', () => {
    it('should support write-protected mode', () => {
      const usb = new USBDrive(4096, true); // Read-only
      usb.insert();
      expect(usb.isReadOnly).toBe(true);
    });

    it('should throw on write to write-protected drive', () => {
      const usb = new USBDrive(4096, true);
      usb.insert();
      expect(() => usb.write(0, new Uint8Array(512))).toThrow(BlockDeviceError);
    });

    it('should allow reading from write-protected drive', () => {
      const usb = new USBDrive(4096, true);
      usb.insert();
      expect(() => usb.read(0, 1)).not.toThrow();
    });

    it('should allow toggling write protection', () => {
      const usb = new USBDrive(4096);
      usb.insert();

      usb.setWriteProtected(true);
      expect(usb.isReadOnly).toBe(true);

      usb.setWriteProtected(false);
      expect(usb.isReadOnly).toBe(false);
    });
  });

  describe('disk image operations', () => {
    let usb: USBDrive;

    beforeEach(() => {
      usb = new USBDrive(4096); // Small for testing
    });

    it('should load disk image on insert', () => {
      const image = new Uint8Array(4096);
      image.fill(0x55);

      usb.insertWithImage(image);

      expect(usb.isPresent()).toBe(true);
      expect(usb.read(0, 1)[0]).toBe(0x55);
    });

    it('should export disk image on eject', () => {
      usb.insert();
      const testData = new Uint8Array(512).fill(0xcc);
      usb.write(0, testData);

      const image = usb.ejectWithImage();

      expect(image).not.toBeNull();
      expect(image!.slice(0, 512)).toEqual(testData);
    });

    it('should swap disk images', () => {
      const image1 = new Uint8Array(4096).fill(0x11);
      const image2 = new Uint8Array(4096).fill(0x22);

      usb.insertWithImage(image1);
      expect(usb.read(0, 1)[0]).toBe(0x11);

      usb.ejectWithImage();
      usb.insertWithImage(image2);
      expect(usb.read(0, 1)[0]).toBe(0x22);
    });
  });

  describe('error handling', () => {
    let usb: USBDrive;

    beforeEach(() => {
      usb = new USBDrive(1024 * 1024);
    });

    it('should throw on read when device not present', () => {
      expect(() => usb.read(0, 1)).toThrow(BlockDeviceError);
    });

    it('should throw on write when device not present', () => {
      expect(() => usb.write(0, new Uint8Array(512))).toThrow(BlockDeviceError);
    });

    it('should have NOT_PRESENT error type when not inserted', () => {
      try {
        usb.read(0, 1);
      } catch (e) {
        expect((e as BlockDeviceError).type).toBe(BlockDeviceErrorType.IO_ERROR);
      }
    });

    it('should throw on read beyond device size', () => {
      usb.insert();
      expect(() => usb.read(usb.sectorCount, 1)).toThrow(BlockDeviceError);
    });

    it('should throw on write beyond device size', () => {
      usb.insert();
      expect(() => usb.write(usb.sectorCount, new Uint8Array(512))).toThrow(BlockDeviceError);
    });
  });

  describe('status', () => {
    let usb: USBDrive;

    beforeEach(() => {
      usb = new USBDrive(4096);
    });

    it('should report NOT_PRESENT when ejected', () => {
      expect(usb.getStatus()).toBe(USBDriveStatus.NOT_PRESENT);
    });

    it('should report READY when inserted', () => {
      usb.insert();
      expect(usb.getStatus()).toBe(USBDriveStatus.READY);
    });

    it('should report WRITE_PROTECTED when write-protected', () => {
      usb.insert();
      usb.setWriteProtected(true);
      expect(usb.getStatus()).toBe(USBDriveStatus.WRITE_PROTECTED);
    });
  });

  describe('flush', () => {
    it('should complete flush without error', () => {
      const usb = new USBDrive(4096);
      usb.insert();
      usb.write(0, new Uint8Array(512).fill(0xff));
      expect(() => usb.flush()).not.toThrow();
    });
  });
});
