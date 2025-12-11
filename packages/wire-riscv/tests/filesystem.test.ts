import { describe, it, expect, beforeEach } from 'vitest';
import {
  WireFS,
  SECTOR_SIZE,
  SUPERBLOCK_SECTOR,
  FAT_START_SECTOR,
  ROOT_DIR_SECTOR,
  DATA_START_SECTOR,
  MAX_DIR_ENTRIES,
  FileEntry,
  FileAttributes,
} from '../src/emulator/filesystem.js';

/**
 * Tests for WireFS filesystem
 */
describe('WireFS Filesystem', () => {
  let fs: WireFS;

  beforeEach(() => {
    fs = new WireFS();
  });

  describe('constants', () => {
    it('should have correct sector size', () => {
      expect(SECTOR_SIZE).toBe(512);
    });

    it('should have correct disk layout', () => {
      expect(SUPERBLOCK_SECTOR).toBe(0);
      expect(FAT_START_SECTOR).toBe(1);
      expect(ROOT_DIR_SECTOR).toBe(5);
      expect(DATA_START_SECTOR).toBe(6);
    });

    it('should have correct max directory entries', () => {
      expect(MAX_DIR_ENTRIES).toBe(16);
    });
  });

  describe('initialization', () => {
    it('should format the filesystem', () => {
      fs.format();

      // Check superblock is valid
      expect(fs.isFormatted()).toBe(true);
    });

    it('should have empty root directory after format', () => {
      fs.format();

      const files = fs.listFiles();
      expect(files.length).toBe(0);
    });
  });

  describe('file creation', () => {
    beforeEach(() => {
      fs.format();
    });

    it('should create a file', () => {
      const result = fs.createFile('TEST', 'TXT');
      expect(result).toBe(true);

      const files = fs.listFiles();
      expect(files.length).toBe(1);
      expect(files[0].name).toBe('TEST');
      expect(files[0].extension).toBe('TXT');
    });

    it('should reject duplicate filenames', () => {
      fs.createFile('TEST', 'TXT');
      const result = fs.createFile('TEST', 'TXT');
      expect(result).toBe(false);
    });

    it('should allow same name with different extension', () => {
      fs.createFile('TEST', 'TXT');
      const result = fs.createFile('TEST', 'BIN');
      expect(result).toBe(true);

      const files = fs.listFiles();
      expect(files.length).toBe(2);
    });

    it('should truncate long names', () => {
      fs.createFile('VERYLONGNAME', 'TEXT');

      const files = fs.listFiles();
      expect(files[0].name.length).toBeLessThanOrEqual(8);
      expect(files[0].extension.length).toBeLessThanOrEqual(3);
    });

    it('should convert names to uppercase', () => {
      fs.createFile('test', 'txt');

      const files = fs.listFiles();
      expect(files[0].name).toBe('TEST');
      expect(files[0].extension).toBe('TXT');
    });

    it('should reject invalid characters', () => {
      const result = fs.createFile('TEST/', 'TXT');
      expect(result).toBe(false);
    });

    it('should enforce directory entry limit', () => {
      for (let i = 0; i < MAX_DIR_ENTRIES; i++) {
        fs.createFile(`FILE${i}`, 'TXT');
      }

      const result = fs.createFile('EXTRA', 'TXT');
      expect(result).toBe(false);
    });
  });

  describe('file writing', () => {
    beforeEach(() => {
      fs.format();
    });

    it('should write data to file', () => {
      fs.createFile('TEST', 'TXT');
      const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"

      const result = fs.writeFile('TEST', 'TXT', data);
      expect(result).toBe(true);

      const entry = fs.getFileEntry('TEST', 'TXT');
      expect(entry?.size).toBe(5);
    });

    it('should overwrite existing file data', () => {
      fs.createFile('TEST', 'TXT');
      fs.writeFile('TEST', 'TXT', new Uint8Array([1, 2, 3]));
      fs.writeFile('TEST', 'TXT', new Uint8Array([4, 5]));

      const entry = fs.getFileEntry('TEST', 'TXT');
      expect(entry?.size).toBe(2);
    });

    it('should return false for non-existent file', () => {
      const result = fs.writeFile('NOFILE', 'TXT', new Uint8Array([1]));
      expect(result).toBe(false);
    });

    it('should handle multi-sector files', () => {
      fs.createFile('BIG', 'DAT');
      const data = new Uint8Array(1024); // 2 sectors
      data.fill(0x42);

      const result = fs.writeFile('BIG', 'DAT', data);
      expect(result).toBe(true);

      const entry = fs.getFileEntry('BIG', 'DAT');
      expect(entry?.size).toBe(1024);
    });
  });

  describe('file reading', () => {
    beforeEach(() => {
      fs.format();
    });

    it('should read file contents', () => {
      fs.createFile('TEST', 'TXT');
      const original = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
      fs.writeFile('TEST', 'TXT', original);

      const data = fs.readFile('TEST', 'TXT');
      expect(data).not.toBeNull();
      expect(data).toEqual(original);
    });

    it('should return null for non-existent file', () => {
      const data = fs.readFile('NOFILE', 'TXT');
      expect(data).toBeNull();
    });

    it('should read multi-sector files', () => {
      fs.createFile('BIG', 'DAT');
      const original = new Uint8Array(1024);
      for (let i = 0; i < 1024; i++) {
        original[i] = i & 0xFF;
      }
      fs.writeFile('BIG', 'DAT', original);

      const data = fs.readFile('BIG', 'DAT');
      expect(data).toEqual(original);
    });
  });

  describe('file deletion', () => {
    beforeEach(() => {
      fs.format();
    });

    it('should delete a file', () => {
      fs.createFile('TEST', 'TXT');
      fs.writeFile('TEST', 'TXT', new Uint8Array([1, 2, 3]));

      const result = fs.deleteFile('TEST', 'TXT');
      expect(result).toBe(true);

      const files = fs.listFiles();
      expect(files.length).toBe(0);
    });

    it('should return false for non-existent file', () => {
      const result = fs.deleteFile('NOFILE', 'TXT');
      expect(result).toBe(false);
    });

    it('should free sectors after deletion', () => {
      fs.createFile('FILE1', 'TXT');
      fs.writeFile('FILE1', 'TXT', new Uint8Array(512));

      const freeBeforeDelete = fs.getFreeSpace();
      fs.deleteFile('FILE1', 'TXT');
      const freeAfterDelete = fs.getFreeSpace();

      expect(freeAfterDelete).toBeGreaterThan(freeBeforeDelete);
    });
  });

  describe('file listing', () => {
    beforeEach(() => {
      fs.format();
    });

    it('should list all files', () => {
      fs.createFile('FILE1', 'TXT');
      fs.createFile('FILE2', 'BIN');
      fs.createFile('FILE3', 'DAT');

      const files = fs.listFiles();
      expect(files.length).toBe(3);
    });

    it('should include file attributes', () => {
      fs.createFile('TEST', 'TXT');
      fs.writeFile('TEST', 'TXT', new Uint8Array([1, 2, 3, 4, 5]));

      const files = fs.listFiles();
      expect(files[0].name).toBe('TEST');
      expect(files[0].extension).toBe('TXT');
      expect(files[0].size).toBe(5);
    });
  });

  describe('file attributes', () => {
    beforeEach(() => {
      fs.format();
    });

    it('should set file attributes', () => {
      fs.createFile('TEST', 'TXT');
      fs.setFileAttributes('TEST', 'TXT', FileAttributes.READ_ONLY);

      const entry = fs.getFileEntry('TEST', 'TXT');
      expect(entry?.attributes & FileAttributes.READ_ONLY).toBeTruthy();
    });

    it('should prevent writing to read-only file', () => {
      fs.createFile('TEST', 'TXT');
      fs.setFileAttributes('TEST', 'TXT', FileAttributes.READ_ONLY);

      const result = fs.writeFile('TEST', 'TXT', new Uint8Array([1]));
      expect(result).toBe(false);
    });
  });

  describe('file existence', () => {
    beforeEach(() => {
      fs.format();
    });

    it('should check if file exists', () => {
      fs.createFile('TEST', 'TXT');

      expect(fs.fileExists('TEST', 'TXT')).toBe(true);
      expect(fs.fileExists('OTHER', 'TXT')).toBe(false);
    });
  });

  describe('disk storage', () => {
    let storage: Uint8Array;

    beforeEach(() => {
      storage = new Uint8Array(64 * SECTOR_SIZE); // 64 sectors
      fs = new WireFS(storage);
    });

    it('should persist to storage', () => {
      fs.format();
      fs.createFile('TEST', 'TXT');
      fs.writeFile('TEST', 'TXT', new Uint8Array([0x41, 0x42, 0x43]));

      // Create new filesystem instance from same storage
      const fs2 = new WireFS(storage);

      // Should be able to read the file
      expect(fs2.isFormatted()).toBe(true);
      expect(fs2.fileExists('TEST', 'TXT')).toBe(true);

      const data = fs2.readFile('TEST', 'TXT');
      expect(data).toEqual(new Uint8Array([0x41, 0x42, 0x43]));
    });
  });

  describe('free space', () => {
    beforeEach(() => {
      fs.format();
    });

    it('should report free space', () => {
      const freeSpace = fs.getFreeSpace();
      expect(freeSpace).toBeGreaterThan(0);
    });

    it('should decrease when files are written', () => {
      const before = fs.getFreeSpace();

      fs.createFile('TEST', 'TXT');
      fs.writeFile('TEST', 'TXT', new Uint8Array(SECTOR_SIZE));

      const after = fs.getFreeSpace();
      expect(after).toBeLessThan(before);
    });
  });
});
