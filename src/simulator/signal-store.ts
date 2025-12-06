// Signal store: manages signal values in a SharedArrayBuffer
// 1 bit per signal, packed into Uint32Array for efficiency

import { SignalId, LevelizedNetlist } from '../types/netlist.js';

const HEADER_SIZE = 16; // 16 uint32 words = 64 bytes header

export interface SignalStoreHeader {
  magic: number;        // 0x57495245 = "WIRE"
  version: number;      // Format version
  numSignals: number;   // Total number of signals
  currentCycle: number; // Current simulation cycle (low 32 bits)
}

export class SignalStore {
  private buffer: ArrayBuffer | SharedArrayBuffer;
  private view: Uint32Array;
  private numSignals: number;

  constructor(netlist: LevelizedNetlist, useShared: boolean = false) {
    this.numSignals = netlist.signals.length;

    // Calculate buffer size: header + signal bits (packed into uint32)
    const signalWords = Math.ceil(this.numSignals / 32);
    const totalWords = HEADER_SIZE + signalWords;
    const totalBytes = totalWords * 4;

    // Create buffer
    if (useShared && typeof SharedArrayBuffer !== 'undefined') {
      this.buffer = new SharedArrayBuffer(totalBytes);
    } else {
      this.buffer = new ArrayBuffer(totalBytes);
    }

    this.view = new Uint32Array(this.buffer);

    // Initialize header
    this.view[0] = 0x57495245; // Magic: "WIRE"
    this.view[1] = 1;          // Version
    this.view[2] = this.numSignals;
    this.view[3] = 0;          // Current cycle

    // Initialize all signals to 0
    for (let i = HEADER_SIZE; i < totalWords; i++) {
      this.view[i] = 0;
    }

    // Set constant signals
    for (const sig of netlist.signals) {
      if (sig.name === 'const_1') {
        this.write(sig.id, 1);
      }
    }
  }

  /**
   * Read a single signal value (0 or 1)
   */
  read(signalId: SignalId): number {
    const wordIndex = HEADER_SIZE + Math.floor(signalId / 32);
    const bitIndex = signalId % 32;
    return (this.view[wordIndex] >> bitIndex) & 1;
  }

  /**
   * Write a single signal value (0 or 1)
   */
  write(signalId: SignalId, value: number): void {
    const wordIndex = HEADER_SIZE + Math.floor(signalId / 32);
    const bitIndex = signalId % 32;

    if (value) {
      this.view[wordIndex] |= 1 << bitIndex;
    } else {
      this.view[wordIndex] &= ~(1 << bitIndex);
    }
  }

  /**
   * Read multiple bits as a number (LSB first)
   */
  readBits(signalIds: SignalId[]): number {
    let result = 0;
    for (let i = 0; i < signalIds.length; i++) {
      result |= this.read(signalIds[i]) << i;
    }
    return result;
  }

  /**
   * Write multiple bits from a number (LSB first)
   */
  writeBits(signalIds: SignalId[], value: number): void {
    for (let i = 0; i < signalIds.length; i++) {
      this.write(signalIds[i], (value >> i) & 1);
    }
  }

  /**
   * Get current cycle count
   */
  getCycle(): number {
    return this.view[3];
  }

  /**
   * Increment cycle count
   */
  incrementCycle(): void {
    this.view[3]++;
  }

  /**
   * Get the underlying buffer for WASM interop
   */
  getBuffer(): ArrayBuffer | SharedArrayBuffer {
    return this.buffer;
  }

  /**
   * Get the Uint32Array view
   */
  getView(): Uint32Array {
    return this.view;
  }

  /**
   * Get signal data offset (in bytes) for WASM
   */
  getDataOffset(): number {
    return HEADER_SIZE * 4;
  }

  /**
   * Dump all signal values for debugging
   */
  dump(): Map<number, number> {
    const values = new Map<number, number>();
    for (let i = 0; i < this.numSignals; i++) {
      values.set(i, this.read(i));
    }
    return values;
  }
}
