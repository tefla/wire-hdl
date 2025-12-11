import { describe, it, expect, beforeEach } from 'vitest';
import {
  CDROMDrive,
  CDROMStatus,
  CDROM_SECTOR_SIZE,
  ISO9660_MAGIC,
  createMinimalISO,
} from '../src/emulator/cdrom.js';
import { BlockDeviceError, BlockDeviceErrorType } from '../src/emulator/block-device.js';

describe('CDROMDrive', () => {
  describe('creation', () => {
    it('should create empty CD-ROM drive', () => {
      const cdrom = new CDROMDrive();
      expect(cdrom.sectorSize).toBe(CDROM_SECTOR_SIZE);
      expect(cdrom.isReadOnly).toBe(true);
    });

    it('should have 2048-byte sectors', () => {
      const cdrom = new CDROMDrive();
      expect(CDROM_SECTOR_SIZE).toBe(2048);
      expect(cdrom.sectorSize).toBe(2048);
    });
  });

  describe('geometry', () => {
    it('should report 0 sectors when no disc', () => {
      const cdrom = new CDROMDrive();
      expect(cdrom.sectorCount).toBe(0);
    });

    it('should report correct sector count for ISO', () => {
      const cdrom = new CDROMDrive();
      const iso = createMinimalISO(100); // 100 sectors
      cdrom.insertDisc(iso);
      expect(cdrom.sectorCount).toBe(100);
    });

    it('should always be read-only', () => {
      const cdrom = new CDROMDrive();
      expect(cdrom.isReadOnly).toBe(true);

      const iso = createMinimalISO(10);
      cdrom.insertDisc(iso);
      expect(cdrom.isReadOnly).toBe(true);
    });
  });

  describe('disc handling', () => {
    let cdrom: CDROMDrive;

    beforeEach(() => {
      cdrom = new CDROMDrive();
    });

    it('should have no disc initially', () => {
      expect(cdrom.hasDisc()).toBe(false);
      expect(cdrom.getStatus()).toBe(CDROMStatus.NO_DISC);
    });

    it('should have disc after insert', () => {
      const iso = createMinimalISO(10);
      cdrom.insertDisc(iso);
      expect(cdrom.hasDisc()).toBe(true);
      expect(cdrom.getStatus()).toBe(CDROMStatus.READY);
    });

    it('should have no disc after eject', () => {
      const iso = createMinimalISO(10);
      cdrom.insertDisc(iso);
      cdrom.ejectDisc();
      expect(cdrom.hasDisc()).toBe(false);
      expect(cdrom.getStatus()).toBe(CDROMStatus.TRAY_OPEN);
    });

    it('should allow disc swap', () => {
      const iso1 = createMinimalISO(10);
      const iso2 = createMinimalISO(20);

      iso1[0] = 0x11;
      iso2[0] = 0x22;

      cdrom.insertDisc(iso1);
      expect(cdrom.read(0, 1)[0]).toBe(0x11);

      cdrom.ejectDisc();
      cdrom.insertDisc(iso2);
      expect(cdrom.read(0, 1)[0]).toBe(0x22);
    });
  });

  describe('tray status', () => {
    let cdrom: CDROMDrive;

    beforeEach(() => {
      cdrom = new CDROMDrive();
    });

    it('should have closed tray initially', () => {
      expect(cdrom.isTrayOpen()).toBe(false);
    });

    it('should open tray on eject command', () => {
      cdrom.openTray();
      expect(cdrom.isTrayOpen()).toBe(true);
      expect(cdrom.getStatus()).toBe(CDROMStatus.TRAY_OPEN);
    });

    it('should close tray on load command', () => {
      cdrom.openTray();
      cdrom.closeTray();
      expect(cdrom.isTrayOpen()).toBe(false);
    });

    it('should eject disc when opening tray with disc', () => {
      const iso = createMinimalISO(10);
      cdrom.insertDisc(iso);
      cdrom.openTray();
      expect(cdrom.hasDisc()).toBe(false);
      expect(cdrom.isTrayOpen()).toBe(true);
    });
  });

  describe('basic operations', () => {
    let cdrom: CDROMDrive;

    beforeEach(() => {
      cdrom = new CDROMDrive();
      const iso = createMinimalISO(100);
      for (let i = 0; i < iso.length; i++) iso[i] = i & 0xff;
      cdrom.insertDisc(iso);
    });

    it('should read sector 0', () => {
      const data = cdrom.read(0, 1);
      expect(data.length).toBe(2048);
    });

    it('should read multiple consecutive sectors', () => {
      const data = cdrom.read(0, 4);
      expect(data.length).toBe(2048 * 4);
    });

    it('should return correct data', () => {
      const data = cdrom.read(0, 1);
      for (let i = 0; i < 2048; i++) {
        expect(data[i]).toBe(i & 0xff);
      }
    });

    it('should read any valid sector', () => {
      const data = cdrom.read(50, 1);
      expect(data.length).toBe(2048);
    });
  });

  describe('write rejection', () => {
    it('should throw on write attempt', () => {
      const cdrom = new CDROMDrive();
      const iso = createMinimalISO(10);
      cdrom.insertDisc(iso);

      expect(() => cdrom.write(0, new Uint8Array(2048))).toThrow(BlockDeviceError);
    });

    it('should have READ_ONLY error type on write', () => {
      const cdrom = new CDROMDrive();
      const iso = createMinimalISO(10);
      cdrom.insertDisc(iso);

      try {
        cdrom.write(0, new Uint8Array(2048));
      } catch (e) {
        expect((e as BlockDeviceError).type).toBe(BlockDeviceErrorType.READ_ONLY);
      }
    });
  });

  describe('ISO9660 support', () => {
    it('should create valid minimal ISO', () => {
      const iso = createMinimalISO(20);
      expect(iso.length).toBe(20 * 2048);
    });

    it('should detect ISO9660 magic at sector 16', () => {
      const cdrom = new CDROMDrive();
      const iso = createMinimalISO(20);

      // Set ISO9660 primary volume descriptor magic at sector 16
      const pvdOffset = 16 * 2048;
      iso[pvdOffset + 1] = 0x43; // 'C'
      iso[pvdOffset + 2] = 0x44; // 'D'
      iso[pvdOffset + 3] = 0x30; // '0'
      iso[pvdOffset + 4] = 0x30; // '0'
      iso[pvdOffset + 5] = 0x31; // '1'

      cdrom.insertDisc(iso);
      const pvd = cdrom.read(16, 1);

      expect(String.fromCharCode(pvd[1], pvd[2], pvd[3], pvd[4], pvd[5])).toBe('CD001');
    });

    it('should read primary volume descriptor', () => {
      const cdrom = new CDROMDrive();
      const iso = createMinimalISO(20);

      // Set up a proper PVD
      const pvdOffset = 16 * 2048;
      iso[pvdOffset] = 0x01; // Volume descriptor type
      // "CD001"
      for (let i = 0; i < ISO9660_MAGIC.length; i++) {
        iso[pvdOffset + 1 + i] = ISO9660_MAGIC.charCodeAt(i);
      }

      cdrom.insertDisc(iso);
      const pvd = cdrom.read(16, 1);

      expect(pvd[0]).toBe(0x01);
      expect(String.fromCharCode(...pvd.slice(1, 6))).toBe(ISO9660_MAGIC);
    });
  });

  describe('error handling', () => {
    let cdrom: CDROMDrive;

    beforeEach(() => {
      cdrom = new CDROMDrive();
    });

    it('should throw on read with no disc', () => {
      expect(() => cdrom.read(0, 1)).toThrow(BlockDeviceError);
    });

    it('should have IO_ERROR type when no disc', () => {
      try {
        cdrom.read(0, 1);
      } catch (e) {
        expect((e as BlockDeviceError).type).toBe(BlockDeviceErrorType.IO_ERROR);
      }
    });

    it('should throw on read beyond disc size', () => {
      const iso = createMinimalISO(10);
      cdrom.insertDisc(iso);
      expect(() => cdrom.read(10, 1)).toThrow(BlockDeviceError);
    });

    it('should throw on negative sector number', () => {
      const iso = createMinimalISO(10);
      cdrom.insertDisc(iso);
      expect(() => cdrom.read(-1, 1)).toThrow(BlockDeviceError);
    });

    it('should throw on invalid count', () => {
      const iso = createMinimalISO(10);
      cdrom.insertDisc(iso);
      expect(() => cdrom.read(0, 0)).toThrow(BlockDeviceError);
    });
  });

  describe('flush', () => {
    it('should complete flush without error (no-op)', () => {
      const cdrom = new CDROMDrive();
      expect(() => cdrom.flush()).not.toThrow();
    });
  });
});
