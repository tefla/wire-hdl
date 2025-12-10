// Minimal disk constants for WireFS

export const DISK = {
  SECTOR_SIZE: 512,
  MAX_SECTORS: 65536, // 32MB disk
};

// Simple in-memory disk implementation for WireFS
export class Disk {
  private sectors: Uint8Array[];

  constructor() {
    this.sectors = [];
    // Initialize with empty sectors on demand
  }

  getSector(sector: number): Uint8Array {
    if (!this.sectors[sector]) {
      this.sectors[sector] = new Uint8Array(DISK.SECTOR_SIZE);
    }
    return this.sectors[sector];
  }

  loadSector(sector: number, data: Uint8Array): void {
    this.sectors[sector] = new Uint8Array(data);
  }
}
