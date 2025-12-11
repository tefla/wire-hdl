import { describe, it, expect, beforeEach } from 'vitest';
import {
  BlockDevice,
  MemoryBlockDevice,
  MockBlockDevice,
  BlockDeviceError,
  BlockDeviceErrorType,
} from '../src/emulator/block-device.js';

describe('BlockDevice Interface', () => {
  describe('MemoryBlockDevice', () => {
    let device: MemoryBlockDevice;

    beforeEach(() => {
      // 1MB device with 512-byte sectors
      device = new MemoryBlockDevice(1024 * 1024, 512);
    });

    describe('properties', () => {
      it('should have correct sectorSize', () => {
        expect(device.sectorSize).toBe(512);
      });

      it('should have correct sectorCount', () => {
        expect(device.sectorCount).toBe(2048); // 1MB / 512
      });

      it('should have isReadOnly as false by default', () => {
        expect(device.isReadOnly).toBe(false);
      });

      it('should support read-only mode', () => {
        const roDevice = new MemoryBlockDevice(1024, 512, true);
        expect(roDevice.isReadOnly).toBe(true);
      });

      it('should support custom sector sizes', () => {
        const cdDevice = new MemoryBlockDevice(2048 * 100, 2048);
        expect(cdDevice.sectorSize).toBe(2048);
        expect(cdDevice.sectorCount).toBe(100);
      });
    });

    describe('read operations', () => {
      it('should read zeros from uninitialized device', () => {
        const data = device.read(0, 1);
        expect(data.length).toBe(512);
        expect(data.every((b) => b === 0)).toBe(true);
      });

      it('should read multiple sectors', () => {
        const data = device.read(0, 4);
        expect(data.length).toBe(512 * 4);
      });

      it('should read from any valid sector', () => {
        const data = device.read(1000, 1);
        expect(data.length).toBe(512);
      });

      it('should read last sector', () => {
        const data = device.read(2047, 1);
        expect(data.length).toBe(512);
      });
    });

    describe('write operations', () => {
      it('should write and read back data', () => {
        const testData = new Uint8Array(512);
        for (let i = 0; i < 512; i++) {
          testData[i] = i & 0xff;
        }

        device.write(0, testData);
        const readData = device.read(0, 1);

        expect(readData).toEqual(testData);
      });

      it('should write multiple sectors', () => {
        const testData = new Uint8Array(512 * 3);
        for (let i = 0; i < testData.length; i++) {
          testData[i] = (i * 7) & 0xff;
        }

        device.write(10, testData);
        const readData = device.read(10, 3);

        expect(readData).toEqual(testData);
      });

      it('should preserve data in other sectors', () => {
        const data1 = new Uint8Array(512).fill(0xaa);
        const data2 = new Uint8Array(512).fill(0xbb);

        device.write(0, data1);
        device.write(1, data2);

        expect(device.read(0, 1)).toEqual(data1);
        expect(device.read(1, 1)).toEqual(data2);
      });

      it('should overwrite existing data', () => {
        const data1 = new Uint8Array(512).fill(0x11);
        const data2 = new Uint8Array(512).fill(0x22);

        device.write(5, data1);
        device.write(5, data2);

        expect(device.read(5, 1)).toEqual(data2);
      });
    });

    describe('flush operation', () => {
      it('should complete flush without error', () => {
        device.write(0, new Uint8Array(512).fill(0xff));
        expect(() => device.flush()).not.toThrow();
      });
    });

    describe('error handling', () => {
      it('should throw error for read beyond device size', () => {
        expect(() => device.read(2048, 1)).toThrow(BlockDeviceError);
        expect(() => device.read(2047, 2)).toThrow(BlockDeviceError);
      });

      it('should throw error for write beyond device size', () => {
        const data = new Uint8Array(512);
        expect(() => device.write(2048, data)).toThrow(BlockDeviceError);
      });

      it('should throw error for negative sector number', () => {
        expect(() => device.read(-1, 1)).toThrow(BlockDeviceError);
      });

      it('should throw error for zero count', () => {
        expect(() => device.read(0, 0)).toThrow(BlockDeviceError);
      });

      it('should throw error for write to read-only device', () => {
        const roDevice = new MemoryBlockDevice(1024, 512, true);
        const data = new Uint8Array(512);
        expect(() => roDevice.write(0, data)).toThrow(BlockDeviceError);
      });

      it('should include error type in thrown error', () => {
        try {
          device.read(2048, 1);
        } catch (e) {
          expect(e).toBeInstanceOf(BlockDeviceError);
          expect((e as BlockDeviceError).type).toBe(BlockDeviceErrorType.OUT_OF_BOUNDS);
        }
      });

      it('should include error type for read-only write', () => {
        const roDevice = new MemoryBlockDevice(1024, 512, true);
        try {
          roDevice.write(0, new Uint8Array(512));
        } catch (e) {
          expect(e).toBeInstanceOf(BlockDeviceError);
          expect((e as BlockDeviceError).type).toBe(BlockDeviceErrorType.READ_ONLY);
        }
      });
    });

    describe('edge cases', () => {
      it('should handle maximum sector number', () => {
        const data = new Uint8Array(512).fill(0xcc);
        device.write(2047, data);
        expect(device.read(2047, 1)).toEqual(data);
      });

      it('should handle multi-sector operations', () => {
        const data = new Uint8Array(512 * 10);
        for (let i = 0; i < data.length; i++) {
          data[i] = i & 0xff;
        }

        device.write(100, data);
        const readData = device.read(100, 10);
        expect(readData).toEqual(data);
      });

      it('should handle data not aligned to sector size', () => {
        // Writing less than a full sector pads with zeros
        const data = new Uint8Array(256).fill(0xff);
        device.write(0, data);

        const readData = device.read(0, 1);
        expect(readData.slice(0, 256)).toEqual(data);
        expect(readData.slice(256).every((b) => b === 0)).toBe(true);
      });
    });
  });

  describe('MockBlockDevice', () => {
    let mock: MockBlockDevice;

    beforeEach(() => {
      mock = new MockBlockDevice(100, 512);
    });

    describe('properties', () => {
      it('should have specified geometry', () => {
        expect(mock.sectorSize).toBe(512);
        expect(mock.sectorCount).toBe(100);
      });

      it('should default to writable', () => {
        expect(mock.isReadOnly).toBe(false);
      });

      it('should support read-only mode', () => {
        const roMock = new MockBlockDevice(100, 512, true);
        expect(roMock.isReadOnly).toBe(true);
      });
    });

    describe('pre-configured data', () => {
      it('should return pre-configured data for reads', () => {
        const testData = new Uint8Array(512).fill(0xab);
        mock.setSectorData(5, testData);

        const readData = mock.read(5, 1);
        expect(readData).toEqual(testData);
      });

      it('should return zeros for unconfigured sectors', () => {
        const readData = mock.read(0, 1);
        expect(readData.every((b) => b === 0)).toBe(true);
      });
    });

    describe('operation tracking', () => {
      it('should track read operations', () => {
        mock.read(0, 1);
        mock.read(5, 2);

        const ops = mock.getOperations();
        expect(ops.length).toBe(2);
        expect(ops[0]).toEqual({ type: 'read', sector: 0, count: 1 });
        expect(ops[1]).toEqual({ type: 'read', sector: 5, count: 2 });
      });

      it('should track write operations', () => {
        const data = new Uint8Array(512);
        mock.write(3, data);

        const ops = mock.getOperations();
        expect(ops.length).toBe(1);
        expect(ops[0].type).toBe('write');
        expect(ops[0].sector).toBe(3);
        expect(ops[0].count).toBe(1);
      });

      it('should track flush operations', () => {
        mock.flush();

        const ops = mock.getOperations();
        expect(ops.length).toBe(1);
        expect(ops[0]).toEqual({ type: 'flush', sector: 0, count: 0 });
      });

      it('should clear operations', () => {
        mock.read(0, 1);
        mock.clearOperations();

        expect(mock.getOperations().length).toBe(0);
      });
    });

    describe('write verification', () => {
      it('should store written data for verification', () => {
        const data = new Uint8Array(512).fill(0x55);
        mock.write(10, data);

        const storedData = mock.getWrittenData(10);
        expect(storedData).toEqual(data);
      });

      it('should return undefined for unwritten sectors', () => {
        expect(mock.getWrittenData(0)).toBeUndefined();
      });
    });

    describe('error simulation', () => {
      it('should throw error when configured to fail', () => {
        mock.setFailOnRead(true);
        expect(() => mock.read(0, 1)).toThrow(BlockDeviceError);
      });

      it('should throw error on write when configured', () => {
        mock.setFailOnWrite(true);
        expect(() => mock.write(0, new Uint8Array(512))).toThrow(BlockDeviceError);
      });
    });
  });
});
