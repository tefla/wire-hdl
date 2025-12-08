// WireFS - Simple Filesystem for Wire-HDL Computer
// CP/M-like filesystem with 8.3 filenames and lightweight directories
//
// Disk Layout:
//   Sector 0        Boot sector
//   Sectors 1-3     Directory (96 entries × 32 bytes = 3072 bytes)
//   Sectors 4-19    Allocation bitmap (16 sectors = 8192 bytes = 65536 bits)
//   Sectors 20+     Data area
//
// Directory Entry (32 bytes):
//   $00     Status ($00=deleted, $E5=unused, $01=active)
//   $01-$08 Filename (8 chars, space-padded)
//   $09-$0B Extension (3 chars, space-padded)
//   $0C-$0D Start sector (little-endian)
//   $0E-$0F File size in bytes (low 16 bits)
//   $10-$11 File size in bytes (high 16 bits)
//   $12-$13 Sector count (little-endian)
//   $14     Attributes (0x01=readonly, 0x02=hidden, 0x04=system, 0x10=directory)
//   $15-$16 Parent entry index (little-endian, 0xFFFF = root)
//   $17-$1F Reserved (zeros)

import { Disk, DISK } from './disk.js';

// Filesystem constants
export const WIREFS = {
  // Disk layout
  BOOT_SECTOR: 0,
  DIR_START: 1,
  DIR_SECTORS: 3,
  DIR_ENTRIES: 48, // 3 sectors × 512 bytes / 32 bytes per entry = 48
  BITMAP_START: 4,
  BITMAP_SECTORS: 16,
  DATA_START: 20,

  // Directory entry
  ENTRY_SIZE: 32,
  NAME_LEN: 8,
  EXT_LEN: 3,
  ROOT_PARENT: 0xffff,

  // Entry status
  STATUS_DELETED: 0x00,
  STATUS_UNUSED: 0xe5,
  STATUS_ACTIVE: 0x01,

  // Attributes
  ATTR_READONLY: 0x01,
  ATTR_HIDDEN: 0x02,
  ATTR_SYSTEM: 0x04,
  ATTR_DIRECTORY: 0x10,
};

// Directory entry structure
export interface DirEntry {
  status: number;
  name: string; // 8 chars, trimmed
  ext: string; // 3 chars, trimmed
  startSector: number;
  sizeBytes: number; // Full 32-bit size
  sizeSectors: number;
  attributes: number;
  parentIndex: number; // 0xffff means root
}

// File handle for open files
export interface FileHandle {
  entry: DirEntry;
  entryIndex: number;
  position: number; // Current read/write position
  modified: boolean;
}

/**
 * WireFS Filesystem layer
 * Operates on top of the Disk class
 */
export class WireFS {
  private disk: Disk;
  private directory: DirEntry[] = [];
  private bitmap: Uint8Array;
  private handles: Map<number, FileHandle> = new Map();
  private nextHandle = 1;

  constructor(disk: Disk) {
    this.disk = disk;
    this.bitmap = new Uint8Array(WIREFS.BITMAP_SECTORS * DISK.SECTOR_SIZE);
  }

  /**
   * Initialize filesystem - load directory and bitmap
   */
  init(): boolean {
    this.loadDirectory();
    this.loadBitmap();
    return true;
  }

  /**
   * Format the filesystem (create empty directory and bitmap)
   */
  format(): void {
    // Clear directory
    this.directory = [];
    for (let i = 0; i < WIREFS.DIR_ENTRIES; i++) {
      this.directory.push({
        status: WIREFS.STATUS_UNUSED,
        name: '',
        ext: '',
        startSector: 0,
        sizeBytes: 0,
        sizeSectors: 0,
        attributes: 0,
        parentIndex: WIREFS.ROOT_PARENT,
      });
    }

    // Clear bitmap - mark system sectors as used
    this.bitmap.fill(0);
    for (let s = 0; s < WIREFS.DATA_START; s++) {
      this.markSectorUsed(s);
    }

    // Write to disk
    this.saveDirectory();
    this.saveBitmap();
  }

  /**
   * Load directory from disk
   */
  private loadDirectory(): void {
    this.directory = [];

    for (let sector = 0; sector < WIREFS.DIR_SECTORS; sector++) {
      const data = this.disk.getSector(WIREFS.DIR_START + sector);
      const entriesPerSector = DISK.SECTOR_SIZE / WIREFS.ENTRY_SIZE;

      for (let i = 0; i < entriesPerSector; i++) {
        const offset = i * WIREFS.ENTRY_SIZE;
        const entry = this.parseEntry(data, offset);
        this.directory.push(entry);
      }
    }
  }

  /**
   * Save directory to disk
   */
  private saveDirectory(): void {
    const entriesPerSector = DISK.SECTOR_SIZE / WIREFS.ENTRY_SIZE;

    for (let sector = 0; sector < WIREFS.DIR_SECTORS; sector++) {
      const data = new Uint8Array(DISK.SECTOR_SIZE);

      for (let i = 0; i < entriesPerSector; i++) {
        const entryIndex = sector * entriesPerSector + i;
        if (entryIndex < this.directory.length) {
          const offset = i * WIREFS.ENTRY_SIZE;
          this.serializeEntry(this.directory[entryIndex], data, offset);
        }
      }

      this.disk.loadSector(WIREFS.DIR_START + sector, data);
    }
  }

  /**
   * Parse a directory entry from raw bytes
   */
  private parseEntry(data: Uint8Array, offset: number): DirEntry {
    const status = data[offset];

    // Extract filename (8 chars)
    let name = '';
    for (let i = 0; i < WIREFS.NAME_LEN; i++) {
      const c = data[offset + 1 + i];
      if (c !== 0x20 && c !== 0) name += String.fromCharCode(c);
    }

    // Extract extension (3 chars)
    let ext = '';
    for (let i = 0; i < WIREFS.EXT_LEN; i++) {
      const c = data[offset + 9 + i];
      if (c !== 0x20 && c !== 0) ext += String.fromCharCode(c);
    }

    const startSector = data[offset + 0x0c] | (data[offset + 0x0d] << 8);
    const sizeLo = data[offset + 0x0e] | (data[offset + 0x0f] << 8);
    const sizeHi = data[offset + 0x10] | (data[offset + 0x11] << 8);
    const sizeBytes = sizeLo | (sizeHi << 16);
    const sizeSectors = data[offset + 0x12] | (data[offset + 0x13] << 8);
    const attributes = data[offset + 0x14];
    const parentRaw = data[offset + 0x15] | (data[offset + 0x16] << 8);
    const parentIndex = parentRaw === 0 ? WIREFS.ROOT_PARENT : parentRaw;

    return { status, name, ext, startSector, sizeBytes, sizeSectors, attributes, parentIndex };
  }

  /**
   * Serialize a directory entry to raw bytes
   */
  private serializeEntry(entry: DirEntry, data: Uint8Array, offset: number): void {
    data[offset] = entry.status;

    // Write filename (padded with spaces)
    for (let i = 0; i < WIREFS.NAME_LEN; i++) {
      data[offset + 1 + i] = i < entry.name.length ? entry.name.charCodeAt(i) : 0x20;
    }

    // Write extension (padded with spaces)
    for (let i = 0; i < WIREFS.EXT_LEN; i++) {
      data[offset + 9 + i] = i < entry.ext.length ? entry.ext.charCodeAt(i) : 0x20;
    }

    // Start sector
    data[offset + 0x0c] = entry.startSector & 0xff;
    data[offset + 0x0d] = (entry.startSector >> 8) & 0xff;

    // File size (32-bit)
    data[offset + 0x0e] = entry.sizeBytes & 0xff;
    data[offset + 0x0f] = (entry.sizeBytes >> 8) & 0xff;
    data[offset + 0x10] = (entry.sizeBytes >> 16) & 0xff;
    data[offset + 0x11] = (entry.sizeBytes >> 24) & 0xff;

    // Sector count
    data[offset + 0x12] = entry.sizeSectors & 0xff;
    data[offset + 0x13] = (entry.sizeSectors >> 8) & 0xff;

    // Attributes
    data[offset + 0x14] = entry.attributes;

    // Parent entry index (little-endian). 0xFFFF means root.
    const parent = entry.parentIndex ?? WIREFS.ROOT_PARENT;
    data[offset + 0x15] = parent & 0xff;
    data[offset + 0x16] = (parent >> 8) & 0xff;

    // Reserved bytes (zeros)
    for (let i = 0x17; i < WIREFS.ENTRY_SIZE; i++) {
      data[offset + i] = 0;
    }
  }

  /**
   * Load allocation bitmap from disk
   */
  private loadBitmap(): void {
    for (let i = 0; i < WIREFS.BITMAP_SECTORS; i++) {
      const data = this.disk.getSector(WIREFS.BITMAP_START + i);
      this.bitmap.set(data, i * DISK.SECTOR_SIZE);
    }
  }

  /**
   * Save allocation bitmap to disk
   */
  private saveBitmap(): void {
    for (let i = 0; i < WIREFS.BITMAP_SECTORS; i++) {
      const offset = i * DISK.SECTOR_SIZE;
      const data = this.bitmap.slice(offset, offset + DISK.SECTOR_SIZE);
      this.disk.loadSector(WIREFS.BITMAP_START + i, data);
    }
  }

  /**
   * Check if a sector is used in the bitmap
   */
  private isSectorUsed(sector: number): boolean {
    const byteIndex = Math.floor(sector / 8);
    const bitIndex = sector % 8;
    return (this.bitmap[byteIndex] & (1 << bitIndex)) !== 0;
  }

  /**
   * Mark a sector as used in the bitmap
   */
  private markSectorUsed(sector: number): void {
    const byteIndex = Math.floor(sector / 8);
    const bitIndex = sector % 8;
    this.bitmap[byteIndex] |= 1 << bitIndex;
  }

  /**
   * Mark a sector as free in the bitmap
   */
  private markSectorFree(sector: number): void {
    const byteIndex = Math.floor(sector / 8);
    const bitIndex = sector % 8;
    this.bitmap[byteIndex] &= ~(1 << bitIndex);
  }

  /**
   * Find N contiguous free sectors
   */
  private findFreeSectors(count: number): number {
    let start = WIREFS.DATA_START;
    let found = 0;

    for (let s = WIREFS.DATA_START; s < DISK.MAX_SECTORS; s++) {
      if (!this.isSectorUsed(s)) {
        if (found === 0) start = s;
        found++;
        if (found >= count) return start;
      } else {
        found = 0;
      }
    }

    return -1; // Not enough space
  }

  /**
   * Parse a filename into name and extension
   */
  private parseFilename(filename: string): { name: string; ext: string } {
    const upper = filename.toUpperCase();
    const dotPos = upper.lastIndexOf('.');

    let name: string;
    let ext: string;

    if (dotPos >= 0) {
      name = upper.substring(0, dotPos);
      ext = upper.substring(dotPos + 1);
    } else {
      name = upper;
      ext = '';
    }

    // Truncate to max lengths
    name = name.substring(0, WIREFS.NAME_LEN);
    ext = ext.substring(0, WIREFS.EXT_LEN);

    return { name, ext };
  }

  /**
   * Normalize a path into segments, resolving "." and ".."
   */
  private normalizePath(path: string, cwd: string = '/'): string[] {
    const trimmed = path.trim();
    const baseSegments = path.startsWith('/') ? [] : this.normalizePathParts(cwd);
    const raw = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
    const parts = raw.split('/').filter(Boolean);

    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') {
        if (baseSegments.length > 0) {
          baseSegments.pop();
        }
        continue;
      }
      baseSegments.push(part);
    }

    return baseSegments;
  }

  /**
   * Split a path string (already absolute or cwd) into uppercase segments
   */
  private normalizePathParts(input: string): string[] {
    const raw = input.trim();
    if (raw === '' || raw === '/') return [];
    const cleaned = raw.startsWith('/') ? raw.slice(1) : raw;
    return cleaned
      .split('/')
      .filter(Boolean)
      .map((p) => p.toUpperCase());
  }

  /**
   * Find an entry in a specific directory by 8.3 name
   */
  private findInDirectory(
    parentIndex: number,
    name: string,
    ext: string
  ): { entry: DirEntry; index: number } | null {
    for (let i = 0; i < this.directory.length; i++) {
      const entry = this.directory[i];
      if (
        entry.status === WIREFS.STATUS_ACTIVE &&
        entry.parentIndex === parentIndex &&
        entry.name === name &&
        entry.ext === ext
      ) {
        return { entry, index: i };
      }
    }
    return null;
  }

  /**
   * Resolve a path to a directory entry. Returns root for "/".
   */
  private resolvePath(path: string, cwd: string = '/'): { entry: DirEntry; index: number } | null {
    const segments = this.normalizePath(path, cwd);
    let parentIndex = WIREFS.ROOT_PARENT;
    if (segments.length === 0) {
      return {
        entry: {
          status: WIREFS.STATUS_ACTIVE,
          name: '',
          ext: '',
          startSector: 0,
          sizeBytes: 0,
          sizeSectors: 0,
          attributes: WIREFS.ATTR_DIRECTORY,
          parentIndex: WIREFS.ROOT_PARENT,
        },
        index: WIREFS.ROOT_PARENT,
      };
    }

    for (let i = 0; i < segments.length; i++) {
      const { name, ext } = this.parseFilename(segments[i]);
      const found = this.findInDirectory(parentIndex, name, ext);
      if (!found) return null;
      parentIndex = found.index;
      if (i === segments.length - 1) {
        return found;
      }
      if ((found.entry.attributes & WIREFS.ATTR_DIRECTORY) === 0) {
        return null; // Non-directory in middle of path
      }
    }

    return null;
  }

  /**
   * Find a file in the directory
   */
  findFile(path: string, cwd: string = '/'): { entry: DirEntry; index: number } | null {
    return this.resolvePath(path, cwd);
  }

  /**
   * Find a free directory entry
   */
  private findFreeEntry(): number {
    for (let i = 0; i < this.directory.length; i++) {
      const status = this.directory[i].status;
      if (status === WIREFS.STATUS_UNUSED || status === WIREFS.STATUS_DELETED) {
        return i;
      }
    }
    return -1;
  }

  /**
   * List all active files
   */
  listFiles(path: string = '/', cwd: string = '/'): DirEntry[] {
    const resolved = this.resolvePath(path, cwd);
    if (!resolved) return [];

    const parentIndex = resolved.index;
    if (resolved.entry && (resolved.entry.attributes & WIREFS.ATTR_DIRECTORY) === 0) {
      return [];
    }

    return this.directory.filter(
      (e) => e.status === WIREFS.STATUS_ACTIVE && e.parentIndex === parentIndex
    );
  }

  /**
   * Create a new file
   */
  createFile(path: string, data: Uint8Array, cwd: string = '/'): boolean {
    const segments = this.normalizePath(path, cwd);
    if (segments.length === 0) return false;

    const filename = segments.pop()!;
    const parentPath = segments.length ? `/${segments.join('/')}` : '/';
    const parent = this.resolvePath(parentPath, cwd);
    if (!parent || (parent.entry.attributes & WIREFS.ATTR_DIRECTORY) === 0) {
      return false;
    }

    const { name, ext } = this.parseFilename(filename);

    // Check if file already exists in parent
    if (this.findInDirectory(parent.index, name, ext)) {
      return false; // File exists
    }

    // Find free directory entry
    const entryIndex = this.findFreeEntry();
    if (entryIndex < 0) {
      return false; // Directory full
    }

    // Calculate sectors needed
    const sectorsNeeded = Math.ceil(data.length / DISK.SECTOR_SIZE);
    if (sectorsNeeded === 0) {
      // Empty file - just create entry with no sectors
      this.directory[entryIndex] = {
        status: WIREFS.STATUS_ACTIVE,
        name,
        ext,
        startSector: 0,
        sizeBytes: 0,
        sizeSectors: 0,
        attributes: 0,
        parentIndex: parent.index,
      };
      this.saveDirectory();
      return true;
    }

    // Find contiguous free sectors
    const startSector = this.findFreeSectors(sectorsNeeded);
    if (startSector < 0) {
      return false; // Disk full
    }

    // Allocate sectors
    for (let s = 0; s < sectorsNeeded; s++) {
      this.markSectorUsed(startSector + s);
    }

    // Write data to disk
    for (let s = 0; s < sectorsNeeded; s++) {
      const sectorData = new Uint8Array(DISK.SECTOR_SIZE);
      const dataOffset = s * DISK.SECTOR_SIZE;
      const copyLen = Math.min(DISK.SECTOR_SIZE, data.length - dataOffset);

      for (let i = 0; i < copyLen; i++) {
        sectorData[i] = data[dataOffset + i];
      }

      this.disk.loadSector(startSector + s, sectorData);
    }

    // Create directory entry
    this.directory[entryIndex] = {
      status: WIREFS.STATUS_ACTIVE,
      name,
      ext,
      startSector,
      sizeBytes: data.length,
      sizeSectors: sectorsNeeded,
      attributes: 0,
      parentIndex: parent.index,
    };

    // Save metadata
    this.saveDirectory();
    this.saveBitmap();

    return true;
  }

  /**
   * Create a new directory
   */
  createDirectory(path: string, cwd: string = '/'): boolean {
    const segments = this.normalizePath(path, cwd);
    if (segments.length === 0) return false; // cannot create root

    const dirName = segments.pop()!;
    const parentPath = segments.length ? `/${segments.join('/')}` : '/';
    const parent = this.resolvePath(parentPath, cwd);
    if (!parent || (parent.entry.attributes & WIREFS.ATTR_DIRECTORY) === 0) {
      return false;
    }

    const { name, ext } = this.parseFilename(dirName);
    if (this.findInDirectory(parent.index, name, ext)) {
      return false; // exists
    }

    const entryIndex = this.findFreeEntry();
    if (entryIndex < 0) return false;

    this.directory[entryIndex] = {
      status: WIREFS.STATUS_ACTIVE,
      name,
      ext,
      startSector: 0,
      sizeBytes: 0,
      sizeSectors: 0,
      attributes: WIREFS.ATTR_DIRECTORY,
      parentIndex: parent.index,
    };

    this.saveDirectory();
    return true;
  }

  /**
   * Read entire file contents
   */
  readFile(path: string, cwd: string = '/'): Uint8Array | null {
    const found = this.findFile(path, cwd);
    if (!found || (found.entry.attributes & WIREFS.ATTR_DIRECTORY) !== 0) return null;

    const { entry } = found;
    if (entry.sizeBytes === 0) {
      return new Uint8Array(0);
    }

    const data = new Uint8Array(entry.sizeBytes);
    let dataOffset = 0;

    for (let s = 0; s < entry.sizeSectors; s++) {
      const sectorData = this.disk.getSector(entry.startSector + s);
      const copyLen = Math.min(DISK.SECTOR_SIZE, entry.sizeBytes - dataOffset);

      for (let i = 0; i < copyLen; i++) {
        data[dataOffset + i] = sectorData[i];
      }

      dataOffset += copyLen;
    }

    return data;
  }

  /**
   * Delete a file
   */
  deleteFile(path: string, cwd: string = '/'): boolean {
    const found = this.findFile(path, cwd);
    if (!found) return false;

    const { entry, index } = found;
    if (index === WIREFS.ROOT_PARENT) return false;

    // For directories, ensure they are empty (no children)
    if ((entry.attributes & WIREFS.ATTR_DIRECTORY) !== 0) {
      const hasChildren = this.directory.some(
        (e) => e.status === WIREFS.STATUS_ACTIVE && e.parentIndex === index
      );
      if (hasChildren) return false;
    }

    // Free sectors
    for (let s = 0; s < entry.sizeSectors; s++) {
      this.markSectorFree(entry.startSector + s);
    }

    // Mark entry as deleted
    this.directory[index].status = WIREFS.STATUS_DELETED;

    // Save metadata
    this.saveDirectory();
    this.saveBitmap();

    return true;
  }

  /**
   * Open a file for reading/writing
   */
  openFile(path: string, cwd: string = '/'): number | null {
    const found = this.findFile(path, cwd);
    if (!found || (found.entry.attributes & WIREFS.ATTR_DIRECTORY) !== 0) return null;

    const handle: FileHandle = {
      entry: { ...found.entry },
      entryIndex: found.index,
      position: 0,
      modified: false,
    };

    const handleId = this.nextHandle++;
    this.handles.set(handleId, handle);

    return handleId;
  }

  /**
   * Close a file handle
   */
  closeFile(handleId: number): boolean {
    const handle = this.handles.get(handleId);
    if (!handle) return false;

    // If modified, update directory entry
    if (handle.modified) {
      this.directory[handle.entryIndex] = handle.entry;
      this.saveDirectory();
    }

    this.handles.delete(handleId);
    return true;
  }

  /**
   * Read bytes from an open file
   */
  read(handleId: number, count: number): Uint8Array | null {
    const handle = this.handles.get(handleId);
    if (!handle) return null;

    const { entry } = handle;
    const remaining = entry.sizeBytes - handle.position;
    const toRead = Math.min(count, remaining);

    if (toRead <= 0) return new Uint8Array(0);

    const data = new Uint8Array(toRead);
    let dataOffset = 0;
    let fileOffset = handle.position;

    while (dataOffset < toRead) {
      const sectorIndex = Math.floor(fileOffset / DISK.SECTOR_SIZE);
      const sectorOffset = fileOffset % DISK.SECTOR_SIZE;
      const sectorData = this.disk.getSector(entry.startSector + sectorIndex);

      const copyLen = Math.min(DISK.SECTOR_SIZE - sectorOffset, toRead - dataOffset);
      for (let i = 0; i < copyLen; i++) {
        data[dataOffset + i] = sectorData[sectorOffset + i];
      }

      dataOffset += copyLen;
      fileOffset += copyLen;
    }

    handle.position += toRead;
    return data;
  }

  /**
   * Get free space in bytes
   */
  getFreeSpace(): number {
    let freeSectors = 0;
    for (let s = WIREFS.DATA_START; s < DISK.MAX_SECTORS; s++) {
      if (!this.isSectorUsed(s)) freeSectors++;
    }
    return freeSectors * DISK.SECTOR_SIZE;
  }

  /**
   * Get used space in bytes
   */
  getUsedSpace(): number {
    let usedSectors = 0;
    for (let s = WIREFS.DATA_START; s < DISK.MAX_SECTORS; s++) {
      if (this.isSectorUsed(s)) usedSectors++;
    }
    return usedSectors * DISK.SECTOR_SIZE;
  }

  /**
   * Get total file count
   */
  getFileCount(): number {
    return this.directory.filter(
      (e) =>
        e.status === WIREFS.STATUS_ACTIVE && (e.attributes & WIREFS.ATTR_DIRECTORY) === 0
    ).length;
  }

  /**
   * Check if filesystem is valid (has been formatted)
   */
  isValid(): boolean {
    // Check if at least one entry has been initialized
    return this.directory.length === WIREFS.DIR_ENTRIES;
  }

  /**
   * Copy a file
   */
  copyFile(srcPath: string, dstPath: string, cwd: string = '/'): boolean {
    const data = this.readFile(srcPath, cwd);
    if (data === null) return false;
    return this.createFile(dstPath, data, cwd);
  }

  /**
   * Rename a file
   */
  renameFile(oldPath: string, newPath: string, cwd: string = '/'): boolean {
    const found = this.findFile(oldPath, cwd);
    if (!found) return false;
    if (found.index === WIREFS.ROOT_PARENT) return false;

    const newSegments = this.normalizePath(newPath, cwd);
    if (newSegments.length === 0) return false;

    const newNameSegment = newSegments.pop()!;
    const parentPath = newSegments.length ? `/${newSegments.join('/')}` : '/';
    const parent = this.resolvePath(parentPath, cwd);
    if (!parent || (parent.entry.attributes & WIREFS.ATTR_DIRECTORY) === 0) return false;

    const { name, ext } = this.parseFilename(newNameSegment);
    if (this.findInDirectory(parent.index, name, ext)) return false;

    this.directory[found.index].name = name;
    this.directory[found.index].ext = ext;
    this.directory[found.index].parentIndex = parent.index;

    this.saveDirectory();
    return true;
  }

  /**
   * Change directory. Returns normalized absolute path if it exists.
   */
  changeDirectory(path: string, cwd: string = '/'): string | null {
    const resolved = this.resolvePath(path, cwd);
    if (!resolved || (resolved.entry.attributes & WIREFS.ATTR_DIRECTORY) === 0) return null;
    return this.getPathForEntry(resolved.index);
  }

  /**
   * Build an absolute path for a directory entry index.
   */
  getPathForEntry(entryIndex: number): string {
    if (entryIndex === WIREFS.ROOT_PARENT) return '/';
    if (entryIndex < 0 || entryIndex >= this.directory.length) return '/';

    const parts: string[] = [];
    let current = entryIndex;
    const guard = new Set<number>();

    while (
      current !== WIREFS.ROOT_PARENT &&
      current >= 0 &&
      current < this.directory.length &&
      !guard.has(current)
    ) {
      guard.add(current);
      const entry = this.directory[current];
      parts.push(formatFilename(entry.name, entry.ext));
      current = entry.parentIndex ?? WIREFS.ROOT_PARENT;
    }

    return `/${parts.reverse().join('/')}`;
  }
}

/**
 * Format a size in bytes to human-readable string
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

/**
 * Format a filename from name and extension
 */
export function formatFilename(name: string, ext: string): string {
  if (ext) return `${name}.${ext}`;
  return name;
}
