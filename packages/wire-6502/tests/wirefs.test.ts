// Tests for WireFS filesystem

import { describe, it, expect, beforeEach } from 'vitest';
import { Disk, DISK } from '../src/system/disk.js';
import { WireFS, WIREFS, formatSize, formatFilename } from '../src/system/wirefs.js';

describe('WireFS Filesystem', () => {
  let disk: Disk;
  let fs: WireFS;

  beforeEach(() => {
    // Create disk with simple memory callbacks
    const memory = new Uint8Array(65536);
    disk = new Disk(
      (addr) => memory[addr],
      (addr, val) => {
        memory[addr] = val;
      }
    );
    fs = new WireFS(disk);
  });

  describe('Format and Init', () => {
    it('should format filesystem', () => {
      fs.format();
      expect(fs.isValid()).toBe(true);
      expect(fs.getFileCount()).toBe(0);
    });

    it('should initialize from formatted disk', () => {
      fs.format();

      // Create new filesystem instance and init from disk
      const fs2 = new WireFS(disk);
      fs2.init();

      expect(fs2.isValid()).toBe(true);
      expect(fs2.getFileCount()).toBe(0);
    });

    it('should report free space after format', () => {
      fs.format();

      const totalDataSectors = DISK.MAX_SECTORS - WIREFS.DATA_START;
      const expectedFreeSpace = totalDataSectors * DISK.SECTOR_SIZE;

      expect(fs.getFreeSpace()).toBe(expectedFreeSpace);
      expect(fs.getUsedSpace()).toBe(0);
    });
  });

  describe('File Operations', () => {
    beforeEach(() => {
      fs.format();
    });

    it('should create and read a file', () => {
      const testData = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
      const created = fs.createFile('TEST.TXT', testData);

      expect(created).toBe(true);
      expect(fs.getFileCount()).toBe(1);

      const readData = fs.readFile('TEST.TXT');
      expect(readData).not.toBeNull();
      expect(readData!.length).toBe(testData.length);
      expect(Array.from(readData!)).toEqual(Array.from(testData));
    });

    it('should handle files without extension', () => {
      const data = new Uint8Array([1, 2, 3]);
      expect(fs.createFile('README', data)).toBe(true);

      const read = fs.readFile('README');
      expect(read).not.toBeNull();
      expect(read!.length).toBe(3);
    });

    it('should uppercase filenames', () => {
      const data = new Uint8Array([1, 2, 3]);
      expect(fs.createFile('lower.txt', data)).toBe(true);

      // Should be found with uppercase
      expect(fs.readFile('LOWER.TXT')).not.toBeNull();
      // Should also work with lowercase (converted internally)
      expect(fs.readFile('lower.txt')).not.toBeNull();
    });

    it('should reject duplicate filenames', () => {
      const data = new Uint8Array([1, 2, 3]);
      expect(fs.createFile('DUP.TXT', data)).toBe(true);
      expect(fs.createFile('DUP.TXT', data)).toBe(false);
    });

    it('should create empty files', () => {
      const data = new Uint8Array(0);
      expect(fs.createFile('EMPTY.TXT', data)).toBe(true);

      const read = fs.readFile('EMPTY.TXT');
      expect(read).not.toBeNull();
      expect(read!.length).toBe(0);
    });

    it('should handle large files spanning multiple sectors', () => {
      // Create a file larger than one sector (512 bytes)
      const size = 1500;
      const data = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        data[i] = i & 0xff;
      }

      expect(fs.createFile('LARGE.DAT', data)).toBe(true);

      const read = fs.readFile('LARGE.DAT');
      expect(read).not.toBeNull();
      expect(read!.length).toBe(size);

      // Verify contents
      for (let i = 0; i < size; i++) {
        expect(read![i]).toBe(i & 0xff);
      }
    });

    it('should delete files', () => {
      const data = new Uint8Array([1, 2, 3]);
      fs.createFile('DELETE.ME', data);

      expect(fs.getFileCount()).toBe(1);
      expect(fs.deleteFile('DELETE.ME')).toBe(true);
      expect(fs.getFileCount()).toBe(0);
      expect(fs.readFile('DELETE.ME')).toBeNull();
    });

    it('should not delete non-existent files', () => {
      expect(fs.deleteFile('NOTHERE.TXT')).toBe(false);
    });

    it('should list files', () => {
      fs.createFile('FILE1.TXT', new Uint8Array([1]));
      fs.createFile('FILE2.TXT', new Uint8Array([2]));
      fs.createFile('FILE3.TXT', new Uint8Array([3]));

      const files = fs.listFiles();
      expect(files.length).toBe(3);

      const names = files.map((f) => `${f.name}.${f.ext}`);
      expect(names).toContain('FILE1.TXT');
      expect(names).toContain('FILE2.TXT');
      expect(names).toContain('FILE3.TXT');
    });

    it('should copy files', () => {
      const data = new Uint8Array([0x41, 0x42, 0x43]); // "ABC"
      fs.createFile('ORIG.TXT', data);

      expect(fs.copyFile('ORIG.TXT', 'COPY.TXT')).toBe(true);

      const copy = fs.readFile('COPY.TXT');
      expect(copy).not.toBeNull();
      expect(Array.from(copy!)).toEqual(Array.from(data));
    });

    it('should rename files', () => {
      const data = new Uint8Array([1, 2, 3]);
      fs.createFile('OLD.TXT', data);

      expect(fs.renameFile('OLD.TXT', 'NEW.TXT')).toBe(true);
      expect(fs.readFile('OLD.TXT')).toBeNull();

      const read = fs.readFile('NEW.TXT');
      expect(read).not.toBeNull();
      expect(Array.from(read!)).toEqual([1, 2, 3]);
    });

    it('should not rename to existing filename', () => {
      fs.createFile('FILE1.TXT', new Uint8Array([1]));
      fs.createFile('FILE2.TXT', new Uint8Array([2]));

      expect(fs.renameFile('FILE1.TXT', 'FILE2.TXT')).toBe(false);
    });
  });

  describe('File Handles', () => {
    beforeEach(() => {
      fs.format();
    });

    it('should open and close files', () => {
      fs.createFile('TEST.TXT', new Uint8Array([1, 2, 3, 4, 5]));

      const handle = fs.openFile('TEST.TXT');
      expect(handle).not.toBeNull();

      expect(fs.closeFile(handle!)).toBe(true);
    });

    it('should read bytes from open file', () => {
      const data = new Uint8Array([0x41, 0x42, 0x43, 0x44, 0x45]); // "ABCDE"
      fs.createFile('TEST.TXT', data);

      const handle = fs.openFile('TEST.TXT');
      expect(handle).not.toBeNull();

      // Read first 3 bytes
      let chunk = fs.read(handle!, 3);
      expect(chunk).not.toBeNull();
      expect(Array.from(chunk!)).toEqual([0x41, 0x42, 0x43]);

      // Read remaining 2 bytes
      chunk = fs.read(handle!, 10); // Request more than available
      expect(chunk).not.toBeNull();
      expect(Array.from(chunk!)).toEqual([0x44, 0x45]);

      // Read past end
      chunk = fs.read(handle!, 10);
      expect(chunk).not.toBeNull();
      expect(chunk!.length).toBe(0);

      fs.closeFile(handle!);
    });

    it('should not open non-existent file', () => {
      const handle = fs.openFile('NOTHERE.TXT');
      expect(handle).toBeNull();
    });
  });

  describe('Directory Persistence', () => {
    it('should persist files across filesystem instances', () => {
      fs.format();
      fs.createFile('PERSIST.TXT', new Uint8Array([0x50, 0x51, 0x52]));

      // Create new filesystem instance on same disk
      const fs2 = new WireFS(disk);
      fs2.init();

      const data = fs2.readFile('PERSIST.TXT');
      expect(data).not.toBeNull();
      expect(Array.from(data!)).toEqual([0x50, 0x51, 0x52]);
    });

    it('should persist deleted files (not show them)', () => {
      fs.format();
      fs.createFile('DELETE.ME', new Uint8Array([1]));
      fs.deleteFile('DELETE.ME');

      const fs2 = new WireFS(disk);
      fs2.init();

      expect(fs2.readFile('DELETE.ME')).toBeNull();
      expect(fs2.getFileCount()).toBe(0);
    });
  });

  describe('Space Management', () => {
    beforeEach(() => {
      fs.format();
    });

    it('should track used space', () => {
      const initialFree = fs.getFreeSpace();

      // Create a file that needs 3 sectors (1500 bytes)
      fs.createFile('TEST.DAT', new Uint8Array(1500));

      const usedSpace = fs.getUsedSpace();
      expect(usedSpace).toBe(3 * DISK.SECTOR_SIZE);

      const newFree = fs.getFreeSpace();
      expect(newFree).toBe(initialFree - 3 * DISK.SECTOR_SIZE);
    });

    it('should reclaim space on delete', () => {
      fs.createFile('TEST.DAT', new Uint8Array(1500));
      const usedAfterCreate = fs.getUsedSpace();

      fs.deleteFile('TEST.DAT');
      const usedAfterDelete = fs.getUsedSpace();

      expect(usedAfterDelete).toBeLessThan(usedAfterCreate);
      expect(usedAfterDelete).toBe(0);
    });
  });

  describe('Utility Functions', () => {
    it('should format sizes', () => {
      expect(formatSize(100)).toBe('100B');
      expect(formatSize(1024)).toBe('1.0K');
      expect(formatSize(2560)).toBe('2.5K');
      expect(formatSize(1048576)).toBe('1.0M');
    });

    it('should format filenames', () => {
      expect(formatFilename('TEST', 'TXT')).toBe('TEST.TXT');
      expect(formatFilename('README', '')).toBe('README');
    });
  });
});
