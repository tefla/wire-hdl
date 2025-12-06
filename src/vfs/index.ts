// Virtual File System for wire-hdl
// Allows loading wire files in both Node.js and browser environments

export interface VFS {
  readFile(path: string): string;
  exists(path: string): boolean;
  listDir(path: string): string[];
}

// In-memory VFS backed by a Map
export class MemoryVFS implements VFS {
  private files: Map<string, string>;

  constructor(files: Record<string, string> = {}) {
    this.files = new Map(Object.entries(files));
  }

  readFile(path: string): string {
    const normalized = this.normalizePath(path);
    const content = this.files.get(normalized);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  exists(path: string): boolean {
    return this.files.has(this.normalizePath(path));
  }

  listDir(path: string): string[] {
    const normalized = this.normalizePath(path);
    const prefix = normalized.endsWith('/') ? normalized : normalized + '/';
    const results: string[] = [];

    for (const filePath of this.files.keys()) {
      if (filePath.startsWith(prefix)) {
        const relative = filePath.slice(prefix.length);
        const firstPart = relative.split('/')[0];
        if (!results.includes(firstPart)) {
          results.push(firstPart);
        }
      }
    }
    return results;
  }

  addFile(path: string, content: string): void {
    this.files.set(this.normalizePath(path), content);
  }

  private normalizePath(path: string): string {
    // Remove leading ./ and normalize
    return path.replace(/^\.\//, '').replace(/\/+/g, '/');
  }
}

// Node.js VFS using real filesystem
export class NodeVFS implements VFS {
  private fs: typeof import('fs');
  private path: typeof import('path');
  private basePath: string;

  constructor(basePath: string = '.') {
    // Dynamic imports for Node.js
    this.fs = require('fs');
    this.path = require('path');
    this.basePath = basePath;
  }

  readFile(filePath: string): string {
    const fullPath = this.path.join(this.basePath, filePath);
    return this.fs.readFileSync(fullPath, 'utf-8');
  }

  exists(filePath: string): boolean {
    const fullPath = this.path.join(this.basePath, filePath);
    return this.fs.existsSync(fullPath);
  }

  listDir(dirPath: string): string[] {
    const fullPath = this.path.join(this.basePath, dirPath);
    return this.fs.readdirSync(fullPath);
  }
}

// Global VFS instance
let globalVFS: VFS | null = null;

export function setVFS(vfs: VFS): void {
  globalVFS = vfs;
}

export function getVFS(): VFS {
  if (!globalVFS) {
    throw new Error('VFS not initialized. Call setVFS() first.');
  }
  return globalVFS;
}

// Auto-detect environment and create appropriate VFS
export function createDefaultVFS(basePath: string = '.'): VFS {
  if (typeof window === 'undefined') {
    // Node.js environment
    return new NodeVFS(basePath);
  } else {
    // Browser environment - must be initialized with bundled files
    throw new Error('Browser VFS must be initialized with bundled wire files');
  }
}
