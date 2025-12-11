import { describe, it, expect, beforeEach } from 'vitest';
import {
  StorageController,
  STORAGE_REGS,
  StorageCommand,
  StorageStatus,
  STORAGE_BASE,
  DMA_BUFFER_SIZE,
} from '../src/emulator/storage-controller.js';
import { HardDiskDrive } from '../src/emulator/hdd.js';
import { USBDrive } from '../src/emulator/usb.js';
import { CDROMDrive, createMinimalISO } from '../src/emulator/cdrom.js';

describe('StorageController', () => {
  let controller: StorageController;
  let hdd: HardDiskDrive;
  let usb: USBDrive;
  let cdrom: CDROMDrive;

  beforeEach(() => {
    hdd = new HardDiskDrive(1024 * 1024); // 1MB
    usb = new USBDrive(512 * 1024); // 512KB
    cdrom = new CDROMDrive();

    // Write some test data to HDD
    const hddData = new Uint8Array(512);
    for (let i = 0; i < 512; i++) hddData[i] = 0xaa;
    hdd.write(0, hddData);

    // Insert USB with test data
    usb.insert();
    const usbData = new Uint8Array(512);
    for (let i = 0; i < 512; i++) usbData[i] = 0xbb;
    usb.write(0, usbData);

    // Insert CD-ROM with test data
    const iso = createMinimalISO(20);
    for (let i = 0; i < 2048; i++) iso[i] = 0xcc;
    cdrom.insertDisc(iso);

    controller = new StorageController(hdd, cdrom, usb);
  });

  describe('registers', () => {
    it('should read/write DEVICE_SELECT register', () => {
      expect(controller.readRegister(STORAGE_REGS.DEVICE_SELECT)).toBe(0);
      controller.writeRegister(STORAGE_REGS.DEVICE_SELECT, 1);
      expect(controller.readRegister(STORAGE_REGS.DEVICE_SELECT)).toBe(1);
    });

    it('should read/write SECTOR_LO register', () => {
      controller.writeRegister(STORAGE_REGS.SECTOR_LO, 0x12345678);
      expect(controller.readRegister(STORAGE_REGS.SECTOR_LO)).toBe(0x12345678);
    });

    it('should read/write SECTOR_HI register', () => {
      controller.writeRegister(STORAGE_REGS.SECTOR_HI, 0xabcdef00);
      expect(controller.readRegister(STORAGE_REGS.SECTOR_HI)).toBe(0xabcdef00);
    });

    it('should read/write COUNT register', () => {
      controller.writeRegister(STORAGE_REGS.COUNT, 8);
      expect(controller.readRegister(STORAGE_REGS.COUNT)).toBe(8);
    });

    it('should read/write DMA_ADDR register', () => {
      controller.writeRegister(STORAGE_REGS.DMA_ADDR, 0x20010000);
      expect(controller.readRegister(STORAGE_REGS.DMA_ADDR)).toBe(0x20010000);
    });

    it('should read STATUS register', () => {
      const status = controller.readRegister(STORAGE_REGS.STATUS);
      expect(status & StorageStatus.READY).toBe(StorageStatus.READY);
    });
  });

  describe('device selection', () => {
    it('should select HDD (device 0)', () => {
      controller.writeRegister(STORAGE_REGS.DEVICE_SELECT, 0);
      expect(controller.getSelectedDevice()).toBe(hdd);
    });

    it('should select CD-ROM (device 1)', () => {
      controller.writeRegister(STORAGE_REGS.DEVICE_SELECT, 1);
      expect(controller.getSelectedDevice()).toBe(cdrom);
    });

    it('should select USB (device 2)', () => {
      controller.writeRegister(STORAGE_REGS.DEVICE_SELECT, 2);
      expect(controller.getSelectedDevice()).toBe(usb);
    });

    it('should return null for invalid device', () => {
      controller.writeRegister(STORAGE_REGS.DEVICE_SELECT, 99);
      expect(controller.getSelectedDevice()).toBeNull();
    });
  });

  describe('READ command', () => {
    it('should read from HDD to DMA buffer', () => {
      controller.writeRegister(STORAGE_REGS.DEVICE_SELECT, 0); // HDD
      controller.writeRegister(STORAGE_REGS.SECTOR_LO, 0);
      controller.writeRegister(STORAGE_REGS.COUNT, 1);
      controller.writeRegister(STORAGE_REGS.COMMAND, StorageCommand.READ);

      const dmaBuffer = controller.getDMABuffer();
      expect(dmaBuffer[0]).toBe(0xaa);
    });

    it('should read from USB to DMA buffer', () => {
      controller.writeRegister(STORAGE_REGS.DEVICE_SELECT, 2); // USB
      controller.writeRegister(STORAGE_REGS.SECTOR_LO, 0);
      controller.writeRegister(STORAGE_REGS.COUNT, 1);
      controller.writeRegister(STORAGE_REGS.COMMAND, StorageCommand.READ);

      const dmaBuffer = controller.getDMABuffer();
      expect(dmaBuffer[0]).toBe(0xbb);
    });

    it('should read from CD-ROM to DMA buffer', () => {
      controller.writeRegister(STORAGE_REGS.DEVICE_SELECT, 1); // CD-ROM
      controller.writeRegister(STORAGE_REGS.SECTOR_LO, 0);
      controller.writeRegister(STORAGE_REGS.COUNT, 1);
      controller.writeRegister(STORAGE_REGS.COMMAND, StorageCommand.READ);

      const dmaBuffer = controller.getDMABuffer();
      expect(dmaBuffer[0]).toBe(0xcc);
    });

    it('should read multiple sectors', () => {
      // Write pattern to HDD sectors 0-3
      for (let i = 0; i < 4; i++) {
        const data = new Uint8Array(512).fill(i + 1);
        hdd.write(i, data);
      }

      controller.writeRegister(STORAGE_REGS.DEVICE_SELECT, 0);
      controller.writeRegister(STORAGE_REGS.SECTOR_LO, 0);
      controller.writeRegister(STORAGE_REGS.COUNT, 4);
      controller.writeRegister(STORAGE_REGS.COMMAND, StorageCommand.READ);

      const dmaBuffer = controller.getDMABuffer();
      expect(dmaBuffer[0]).toBe(1);
      expect(dmaBuffer[512]).toBe(2);
      expect(dmaBuffer[1024]).toBe(3);
      expect(dmaBuffer[1536]).toBe(4);
    });
  });

  describe('WRITE command', () => {
    it('should write from DMA buffer to HDD', () => {
      // Fill DMA buffer with test data
      const dmaBuffer = controller.getDMABuffer();
      for (let i = 0; i < 512; i++) dmaBuffer[i] = 0x55;

      controller.writeRegister(STORAGE_REGS.DEVICE_SELECT, 0); // HDD
      controller.writeRegister(STORAGE_REGS.SECTOR_LO, 10);
      controller.writeRegister(STORAGE_REGS.COUNT, 1);
      controller.writeRegister(STORAGE_REGS.COMMAND, StorageCommand.WRITE);

      const readBack = hdd.read(10, 1);
      expect(readBack[0]).toBe(0x55);
    });

    it('should write from DMA buffer to USB', () => {
      const dmaBuffer = controller.getDMABuffer();
      for (let i = 0; i < 512; i++) dmaBuffer[i] = 0x66;

      controller.writeRegister(STORAGE_REGS.DEVICE_SELECT, 2); // USB
      controller.writeRegister(STORAGE_REGS.SECTOR_LO, 5);
      controller.writeRegister(STORAGE_REGS.COUNT, 1);
      controller.writeRegister(STORAGE_REGS.COMMAND, StorageCommand.WRITE);

      const readBack = usb.read(5, 1);
      expect(readBack[0]).toBe(0x66);
    });

    it('should fail write to CD-ROM', () => {
      controller.writeRegister(STORAGE_REGS.DEVICE_SELECT, 1); // CD-ROM
      controller.writeRegister(STORAGE_REGS.SECTOR_LO, 0);
      controller.writeRegister(STORAGE_REGS.COUNT, 1);
      controller.writeRegister(STORAGE_REGS.COMMAND, StorageCommand.WRITE);

      const status = controller.readRegister(STORAGE_REGS.STATUS);
      expect(status & StorageStatus.ERROR).toBe(StorageStatus.ERROR);
    });
  });

  describe('FLUSH command', () => {
    it('should execute FLUSH on HDD', () => {
      controller.writeRegister(STORAGE_REGS.DEVICE_SELECT, 0);
      controller.writeRegister(STORAGE_REGS.COMMAND, StorageCommand.FLUSH);

      const status = controller.readRegister(STORAGE_REGS.STATUS);
      expect(status & StorageStatus.ERROR).toBe(0);
    });
  });

  describe('GET_INFO command', () => {
    it('should return HDD geometry', () => {
      controller.writeRegister(STORAGE_REGS.DEVICE_SELECT, 0); // HDD
      controller.writeRegister(STORAGE_REGS.COMMAND, StorageCommand.GET_INFO);

      const info = controller.getDeviceInfo();
      expect(info.sectorSize).toBe(512);
      expect(info.sectorCount).toBe(2048); // 1MB / 512
      expect(info.isReadOnly).toBe(false);
    });

    it('should return CD-ROM geometry', () => {
      controller.writeRegister(STORAGE_REGS.DEVICE_SELECT, 1); // CD-ROM
      controller.writeRegister(STORAGE_REGS.COMMAND, StorageCommand.GET_INFO);

      const info = controller.getDeviceInfo();
      expect(info.sectorSize).toBe(2048);
      expect(info.sectorCount).toBe(20);
      expect(info.isReadOnly).toBe(true);
    });

    it('should return USB geometry', () => {
      controller.writeRegister(STORAGE_REGS.DEVICE_SELECT, 2); // USB
      controller.writeRegister(STORAGE_REGS.COMMAND, StorageCommand.GET_INFO);

      const info = controller.getDeviceInfo();
      expect(info.sectorSize).toBe(512);
      expect(info.sectorCount).toBe(1024); // 512KB / 512
      expect(info.isReadOnly).toBe(false);
    });
  });

  describe('memory-mapped I/O', () => {
    it('should be in correct address range', () => {
      expect(STORAGE_BASE).toBe(0x20000000);
    });

    it('should handle MMIO read', () => {
      const value = controller.mmioRead(STORAGE_BASE + STORAGE_REGS.STATUS);
      expect(value & StorageStatus.READY).toBe(StorageStatus.READY);
    });

    it('should handle MMIO write', () => {
      controller.mmioWrite(STORAGE_BASE + STORAGE_REGS.DEVICE_SELECT, 2);
      expect(controller.readRegister(STORAGE_REGS.DEVICE_SELECT)).toBe(2);
    });

    it('should read DMA buffer via MMIO', () => {
      // First read data into DMA buffer
      controller.writeRegister(STORAGE_REGS.DEVICE_SELECT, 0);
      controller.writeRegister(STORAGE_REGS.SECTOR_LO, 0);
      controller.writeRegister(STORAGE_REGS.COUNT, 1);
      controller.writeRegister(STORAGE_REGS.COMMAND, StorageCommand.READ);

      // Read from DMA buffer via MMIO
      const value = controller.mmioRead(0x20010000); // DMA buffer start
      expect(value).toBe(0xaaaaaaaa); // 4 bytes of 0xaa
    });

    it('should write DMA buffer via MMIO', () => {
      controller.mmioWrite(0x20010000, 0x12345678);

      const dmaBuffer = controller.getDMABuffer();
      expect(dmaBuffer[0]).toBe(0x78);
      expect(dmaBuffer[1]).toBe(0x56);
      expect(dmaBuffer[2]).toBe(0x34);
      expect(dmaBuffer[3]).toBe(0x12);
    });
  });

  describe('error handling', () => {
    it('should set error on read from absent USB', () => {
      const emptyUsb = new USBDrive(1024);
      // Don't insert the USB
      const ctrl = new StorageController(hdd, cdrom, emptyUsb);

      ctrl.writeRegister(STORAGE_REGS.DEVICE_SELECT, 2); // USB
      ctrl.writeRegister(STORAGE_REGS.SECTOR_LO, 0);
      ctrl.writeRegister(STORAGE_REGS.COUNT, 1);
      ctrl.writeRegister(STORAGE_REGS.COMMAND, StorageCommand.READ);

      const status = ctrl.readRegister(STORAGE_REGS.STATUS);
      expect(status & StorageStatus.ERROR).toBe(StorageStatus.ERROR);
    });

    it('should set error on invalid device', () => {
      controller.writeRegister(STORAGE_REGS.DEVICE_SELECT, 99);
      controller.writeRegister(STORAGE_REGS.COMMAND, StorageCommand.READ);

      const status = controller.readRegister(STORAGE_REGS.STATUS);
      expect(status & StorageStatus.ERROR).toBe(StorageStatus.ERROR);
    });

    it('should set error on out-of-bounds read', () => {
      controller.writeRegister(STORAGE_REGS.DEVICE_SELECT, 0);
      controller.writeRegister(STORAGE_REGS.SECTOR_LO, 10000); // Beyond HDD
      controller.writeRegister(STORAGE_REGS.COUNT, 1);
      controller.writeRegister(STORAGE_REGS.COMMAND, StorageCommand.READ);

      const status = controller.readRegister(STORAGE_REGS.STATUS);
      expect(status & StorageStatus.ERROR).toBe(StorageStatus.ERROR);
    });

    it('should clear error on successful operation', () => {
      // Cause an error
      controller.writeRegister(STORAGE_REGS.DEVICE_SELECT, 99);
      controller.writeRegister(STORAGE_REGS.COMMAND, StorageCommand.READ);

      // Now do valid operation
      controller.writeRegister(STORAGE_REGS.DEVICE_SELECT, 0);
      controller.writeRegister(STORAGE_REGS.SECTOR_LO, 0);
      controller.writeRegister(STORAGE_REGS.COUNT, 1);
      controller.writeRegister(STORAGE_REGS.COMMAND, StorageCommand.READ);

      const status = controller.readRegister(STORAGE_REGS.STATUS);
      expect(status & StorageStatus.ERROR).toBe(0);
    });
  });

  describe('multi-device operations', () => {
    it('should switch between devices', () => {
      // Read from HDD
      controller.writeRegister(STORAGE_REGS.DEVICE_SELECT, 0);
      controller.writeRegister(STORAGE_REGS.SECTOR_LO, 0);
      controller.writeRegister(STORAGE_REGS.COUNT, 1);
      controller.writeRegister(STORAGE_REGS.COMMAND, StorageCommand.READ);
      expect(controller.getDMABuffer()[0]).toBe(0xaa);

      // Read from USB
      controller.writeRegister(STORAGE_REGS.DEVICE_SELECT, 2);
      controller.writeRegister(STORAGE_REGS.SECTOR_LO, 0);
      controller.writeRegister(STORAGE_REGS.COUNT, 1);
      controller.writeRegister(STORAGE_REGS.COMMAND, StorageCommand.READ);
      expect(controller.getDMABuffer()[0]).toBe(0xbb);

      // Read from CD-ROM
      controller.writeRegister(STORAGE_REGS.DEVICE_SELECT, 1);
      controller.writeRegister(STORAGE_REGS.SECTOR_LO, 0);
      controller.writeRegister(STORAGE_REGS.COUNT, 1);
      controller.writeRegister(STORAGE_REGS.COMMAND, StorageCommand.READ);
      expect(controller.getDMABuffer()[0]).toBe(0xcc);
    });
  });
});
