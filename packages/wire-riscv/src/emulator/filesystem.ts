/**
 * WireFS - Simple FAT-like filesystem for RISC-V
 *
 * Disk Layout:
 * - Sector 0: Superblock
 * - Sector 1-4: FAT (File Allocation Table)
 * - Sector 5: Root directory
 * - Sector 6+: Data area
 */

/** Sector size in bytes */
export const SECTOR_SIZE = 512;

/** Superblock sector number */
export const SUPERBLOCK_SECTOR = 0;

/** FAT starting sector */
export const FAT_START_SECTOR = 1;

/** Number of FAT sectors */
export const FAT_SECTORS = 4;

/** Root directory sector */
export const ROOT_DIR_SECTOR = 5;

/** Data area starting sector */
export const DATA_START_SECTOR = 6;

/** Maximum directory entries */
export const MAX_DIR_ENTRIES = 16;

/** Directory entry size in bytes */
const DIR_ENTRY_SIZE = 32;

/** Magic number for formatted filesystem */
const WIREFS_MAGIC = 0x57465256; // "WFRV" in little-endian

/** FAT entry values */
const FAT_FREE = 0x0000;
const FAT_EOF = 0xFFFF;
const FAT_RESERVED = 0xFFFE;

/**
 * File attributes
 */
export enum FileAttributes {
  NONE = 0x00,
  READ_ONLY = 0x01,
  HIDDEN = 0x02,
  SYSTEM = 0x04,
  DELETED = 0x80,
}

/**
 * Directory entry structure
 */
export interface FileEntry {
  name: string;           // 8 chars max
  extension: string;      // 3 chars max
  attributes: number;
  size: number;
  firstSector: number;
}

/**
 * WireFS Filesystem
 */
export class WireFS {
  private storage: Uint8Array;
  private totalSectors: number;

  constructor(storage?: Uint8Array) {
    if (storage) {
      this.storage = storage;
      this.totalSectors = Math.floor(storage.length / SECTOR_SIZE);
    } else {
      // Default: 64 sectors (32KB)
      this.totalSectors = 64;
      this.storage = new Uint8Array(this.totalSectors * SECTOR_SIZE);
    }
  }

  /**
   * Format the filesystem
   */
  format(): void {
    // Clear all storage
    this.storage.fill(0);

    // Write superblock
    this.writeSuperblock();

    // Initialize FAT
    this.initFAT();

    // Initialize root directory (already zeroed)
  }

  /**
   * Check if filesystem is formatted
   */
  isFormatted(): boolean {
    const magic = this.readWord(SUPERBLOCK_SECTOR * SECTOR_SIZE);
    return magic === WIREFS_MAGIC;
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
    name = name.substring(0, 8);
    ext = ext.substring(0, 3);

    return { name, ext };
  }

  /**
   * Create a new file (convenience method accepting full filename)
   */
  createFile(filename: string): boolean;
  createFile(name: string, extension: string): boolean;
  createFile(nameOrFilename: string, extension?: string): boolean {
    let name: string;
    let ext: string;

    if (extension === undefined) {
      const parsed = this.parseFilename(nameOrFilename);
      name = parsed.name;
      ext = parsed.ext;
    } else {
      name = nameOrFilename;
      ext = extension;
    }

    // Validate and normalize name
    name = this.normalizeName(name, 8);
    ext = this.normalizeName(ext, 3);

    if (!name || !this.isValidName(name) || !this.isValidName(ext)) {
      return false;
    }

    // Check if file already exists
    if (this.fileExists(name, ext)) {
      return false;
    }

    // Find free directory entry
    const entryIndex = this.findFreeDirectoryEntry();
    if (entryIndex < 0) {
      return false;
    }

    // Write directory entry
    const entry: FileEntry = {
      name,
      extension: ext,
      attributes: FileAttributes.NONE,
      size: 0,
      firstSector: 0,
    };
    this.writeDirectoryEntry(entryIndex, entry);

    return true;
  }

  /**
   * Write data to a file (convenience method accepting full filename)
   */
  writeFile(filename: string, data: Uint8Array): boolean;
  writeFile(name: string, extension: string, data: Uint8Array): boolean;
  writeFile(nameOrFilename: string, extensionOrData: string | Uint8Array, data?: Uint8Array): boolean {
    let name: string;
    let ext: string;
    let fileData: Uint8Array;

    if (extensionOrData instanceof Uint8Array) {
      const parsed = this.parseFilename(nameOrFilename);
      name = parsed.name;
      ext = parsed.ext;
      fileData = extensionOrData;
    } else {
      name = nameOrFilename;
      ext = extensionOrData;
      fileData = data!;
    }

    name = this.normalizeName(name, 8);
    ext = this.normalizeName(ext, 3);

    const entryIndex = this.findDirectoryEntry(name, ext);
    if (entryIndex < 0) {
      return false;
    }

    const entry = this.readDirectoryEntry(entryIndex);
    if (!entry || (entry.attributes & FileAttributes.READ_ONLY)) {
      return false;
    }

    // Free existing sectors
    if (entry.firstSector > 0) {
      this.freeSectorChain(entry.firstSector);
    }

    // Allocate new sectors and write data
    const sectorsNeeded = Math.ceil(fileData.length / SECTOR_SIZE);
    if (sectorsNeeded === 0) {
      entry.size = 0;
      entry.firstSector = 0;
      this.writeDirectoryEntry(entryIndex, entry);
      return true;
    }

    // Allocate sector chain
    const firstSector = this.allocateSectorChain(sectorsNeeded);
    if (firstSector < 0) {
      return false;
    }

    // Write data to sectors
    let sector = firstSector;
    let offset = 0;
    while (sector !== FAT_EOF && offset < fileData.length) {
      const sectorOffset = sector * SECTOR_SIZE;
      const bytesToWrite = Math.min(SECTOR_SIZE, fileData.length - offset);
      for (let i = 0; i < bytesToWrite; i++) {
        this.storage[sectorOffset + i] = fileData[offset + i];
      }
      // Clear rest of sector
      for (let i = bytesToWrite; i < SECTOR_SIZE; i++) {
        this.storage[sectorOffset + i] = 0;
      }
      offset += SECTOR_SIZE;
      sector = this.getFATEntry(sector);
    }

    // Update directory entry
    entry.size = fileData.length;
    entry.firstSector = firstSector;
    this.writeDirectoryEntry(entryIndex, entry);

    return true;
  }

  /**
   * Read file contents (convenience method accepting full filename)
   */
  readFile(filename: string): Uint8Array | null;
  readFile(name: string, extension: string): Uint8Array | null;
  readFile(nameOrFilename: string, extension?: string): Uint8Array | null {
    let name: string;
    let ext: string;

    if (extension === undefined) {
      const parsed = this.parseFilename(nameOrFilename);
      name = parsed.name;
      ext = parsed.ext;
    } else {
      name = nameOrFilename;
      ext = extension;
    }

    name = this.normalizeName(name, 8);
    ext = this.normalizeName(ext, 3);

    const entry = this.getFileEntry(name, ext);
    if (!entry || entry.size === 0) {
      return entry ? new Uint8Array(0) : null;
    }

    const data = new Uint8Array(entry.size);
    let sector = entry.firstSector;
    let offset = 0;

    while (sector !== FAT_EOF && sector !== FAT_FREE && offset < entry.size) {
      const sectorOffset = sector * SECTOR_SIZE;
      const bytesToRead = Math.min(SECTOR_SIZE, entry.size - offset);
      for (let i = 0; i < bytesToRead; i++) {
        data[offset + i] = this.storage[sectorOffset + i];
      }
      offset += bytesToRead;
      sector = this.getFATEntry(sector);
    }

    return data;
  }

  /**
   * Delete a file (convenience method accepting full filename)
   */
  deleteFile(filename: string): boolean;
  deleteFile(name: string, extension: string): boolean;
  deleteFile(nameOrFilename: string, extension?: string): boolean {
    let name: string;
    let ext: string;

    if (extension === undefined) {
      const parsed = this.parseFilename(nameOrFilename);
      name = parsed.name;
      ext = parsed.ext;
    } else {
      name = nameOrFilename;
      ext = extension;
    }

    name = this.normalizeName(name, 8);
    ext = this.normalizeName(ext, 3);

    const entryIndex = this.findDirectoryEntry(name, ext);
    if (entryIndex < 0) {
      return false;
    }

    const entry = this.readDirectoryEntry(entryIndex);
    if (!entry) {
      return false;
    }

    // Free sectors
    if (entry.firstSector > 0) {
      this.freeSectorChain(entry.firstSector);
    }

    // Mark entry as deleted (clear the entry)
    this.writeDirectoryEntry(entryIndex, {
      name: '',
      extension: '',
      attributes: 0,
      size: 0,
      firstSector: 0,
    });

    return true;
  }

  /**
   * List all files
   */
  listFiles(): FileEntry[] {
    const files: FileEntry[] = [];
    for (let i = 0; i < MAX_DIR_ENTRIES; i++) {
      const entry = this.readDirectoryEntry(i);
      if (entry && entry.name && entry.name.trim()) {
        files.push(entry);
      }
    }
    return files;
  }

  /**
   * Get file entry
   */
  getFileEntry(name: string, extension: string): FileEntry | null {
    name = this.normalizeName(name, 8);
    extension = this.normalizeName(extension, 3);

    const entryIndex = this.findDirectoryEntry(name, extension);
    if (entryIndex < 0) {
      return null;
    }
    return this.readDirectoryEntry(entryIndex);
  }

  /**
   * Check if file exists (convenience method accepting full filename)
   */
  fileExists(filename: string): boolean;
  fileExists(name: string, extension: string): boolean;
  fileExists(nameOrFilename: string, extension?: string): boolean {
    let name: string;
    let ext: string;

    if (extension === undefined) {
      const parsed = this.parseFilename(nameOrFilename);
      name = parsed.name;
      ext = parsed.ext;
    } else {
      name = nameOrFilename;
      ext = extension;
    }

    name = this.normalizeName(name, 8);
    ext = this.normalizeName(ext, 3);
    return this.findDirectoryEntry(name, ext) >= 0;
  }

  /**
   * Set file attributes
   */
  setFileAttributes(name: string, extension: string, attributes: FileAttributes): boolean {
    name = this.normalizeName(name, 8);
    extension = this.normalizeName(extension, 3);

    const entryIndex = this.findDirectoryEntry(name, extension);
    if (entryIndex < 0) {
      return false;
    }

    const entry = this.readDirectoryEntry(entryIndex);
    if (!entry) {
      return false;
    }

    entry.attributes = attributes;
    this.writeDirectoryEntry(entryIndex, entry);
    return true;
  }

  /**
   * Get free space in bytes
   */
  getFreeSpace(): number {
    let freeSectors = 0;
    for (let i = DATA_START_SECTOR; i < this.totalSectors; i++) {
      if (this.getFATEntry(i) === FAT_FREE) {
        freeSectors++;
      }
    }
    return freeSectors * SECTOR_SIZE;
  }

  // Private helper methods

  private writeSuperblock(): void {
    const offset = SUPERBLOCK_SECTOR * SECTOR_SIZE;
    // Magic number
    this.writeWord(offset, WIREFS_MAGIC);
    // Version
    this.writeWord(offset + 4, 1);
    // Total sectors
    this.writeWord(offset + 8, this.totalSectors);
    // Sectors per FAT entry
    this.writeWord(offset + 12, 2);
  }

  private initFAT(): void {
    // Mark reserved sectors
    for (let i = 0; i < DATA_START_SECTOR; i++) {
      this.setFATEntry(i, FAT_RESERVED);
    }
    // Mark data sectors as free
    for (let i = DATA_START_SECTOR; i < this.totalSectors; i++) {
      this.setFATEntry(i, FAT_FREE);
    }
  }

  private getFATEntry(sector: number): number {
    const fatOffset = FAT_START_SECTOR * SECTOR_SIZE + sector * 2;
    return this.storage[fatOffset] | (this.storage[fatOffset + 1] << 8);
  }

  private setFATEntry(sector: number, value: number): void {
    const fatOffset = FAT_START_SECTOR * SECTOR_SIZE + sector * 2;
    this.storage[fatOffset] = value & 0xFF;
    this.storage[fatOffset + 1] = (value >> 8) & 0xFF;
  }

  private allocateSectorChain(count: number): number {
    const sectors: number[] = [];

    // Find free sectors
    for (let i = DATA_START_SECTOR; i < this.totalSectors && sectors.length < count; i++) {
      if (this.getFATEntry(i) === FAT_FREE) {
        sectors.push(i);
      }
    }

    if (sectors.length < count) {
      return -1; // Not enough space
    }

    // Link sectors
    for (let i = 0; i < sectors.length - 1; i++) {
      this.setFATEntry(sectors[i], sectors[i + 1]);
    }
    this.setFATEntry(sectors[sectors.length - 1], FAT_EOF);

    return sectors[0];
  }

  private freeSectorChain(firstSector: number): void {
    let sector = firstSector;
    while (sector !== FAT_EOF && sector !== FAT_FREE && sector < this.totalSectors) {
      const next = this.getFATEntry(sector);
      this.setFATEntry(sector, FAT_FREE);
      sector = next;
    }
  }

  private findFreeDirectoryEntry(): number {
    for (let i = 0; i < MAX_DIR_ENTRIES; i++) {
      const entry = this.readDirectoryEntry(i);
      if (!entry || !entry.name || !entry.name.trim()) {
        return i;
      }
    }
    return -1;
  }

  private findDirectoryEntry(name: string, extension: string): number {
    for (let i = 0; i < MAX_DIR_ENTRIES; i++) {
      const entry = this.readDirectoryEntry(i);
      if (entry && entry.name === name && entry.extension === extension) {
        return i;
      }
    }
    return -1;
  }

  private readDirectoryEntry(index: number): FileEntry | null {
    const offset = ROOT_DIR_SECTOR * SECTOR_SIZE + index * DIR_ENTRY_SIZE;

    // Read name (8 bytes)
    let name = '';
    for (let i = 0; i < 8; i++) {
      const c = this.storage[offset + i];
      if (c !== 0 && c !== 0x20) {
        name += String.fromCharCode(c);
      }
    }

    // Read extension (3 bytes)
    let extension = '';
    for (let i = 0; i < 3; i++) {
      const c = this.storage[offset + 8 + i];
      if (c !== 0 && c !== 0x20) {
        extension += String.fromCharCode(c);
      }
    }

    const attributes = this.storage[offset + 11];
    const size = this.readWord(offset + 12);
    const firstSector = this.storage[offset + 16] | (this.storage[offset + 17] << 8);

    return { name, extension, attributes, size, firstSector };
  }

  private writeDirectoryEntry(index: number, entry: FileEntry): void {
    const offset = ROOT_DIR_SECTOR * SECTOR_SIZE + index * DIR_ENTRY_SIZE;

    // Clear entry
    for (let i = 0; i < DIR_ENTRY_SIZE; i++) {
      this.storage[offset + i] = 0;
    }

    // Write name (8 bytes, space padded)
    for (let i = 0; i < 8; i++) {
      this.storage[offset + i] = i < entry.name.length ? entry.name.charCodeAt(i) : 0x20;
    }

    // Write extension (3 bytes, space padded)
    for (let i = 0; i < 3; i++) {
      this.storage[offset + 8 + i] = i < entry.extension.length ? entry.extension.charCodeAt(i) : 0x20;
    }

    // Write attributes
    this.storage[offset + 11] = entry.attributes;

    // Write size (4 bytes)
    this.writeWord(offset + 12, entry.size);

    // Write first sector (2 bytes)
    this.storage[offset + 16] = entry.firstSector & 0xFF;
    this.storage[offset + 17] = (entry.firstSector >> 8) & 0xFF;
  }

  private readWord(offset: number): number {
    return (
      this.storage[offset] |
      (this.storage[offset + 1] << 8) |
      (this.storage[offset + 2] << 16) |
      (this.storage[offset + 3] << 24)
    ) >>> 0;
  }

  private writeWord(offset: number, value: number): void {
    this.storage[offset] = value & 0xFF;
    this.storage[offset + 1] = (value >> 8) & 0xFF;
    this.storage[offset + 2] = (value >> 16) & 0xFF;
    this.storage[offset + 3] = (value >> 24) & 0xFF;
  }

  private normalizeName(name: string, maxLen: number): string {
    return name.toUpperCase().slice(0, maxLen);
  }

  private isValidName(name: string): boolean {
    // Allow alphanumeric and some special chars, or empty string (for extension)
    return /^[A-Z0-9_\-]*$/.test(name);
  }
}
