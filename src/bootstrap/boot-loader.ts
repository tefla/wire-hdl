// Boot Loader ROM for Wire-HDL Computer
// Reads boot sector from disk, validates, and boots the system
//
// Located at $FC00 in ROM
//
// Boot Sector Format (512 bytes):
//   $00-$01  Magic "WF" (0x57, 0x46)
//   $02-$03  Entry point (little-endian)
//   $04-$05  Load address (little-endian)
//   $06-$07  Sector count (little-endian)
//   $08+     Code/data
//
// Memory Map:
//   $0800 - Default load address for boot sectors
//   $4800 - Disk buffer (512 bytes)
//
// Disk I/O Registers:
//   $8020 - Status (1=ready, 2=busy, 0x80=error)
//   $8021 - Command (1=read, 2=write)
//   $8022 - Sector low
//   $8023 - Sector high
//   $8024 - Buffer address low
//   $8025 - Buffer address high
//   $8026 - Sector count

import { assemble } from '../assembler/stage0.js';

// Boot loader entry point
export const BOOT_LOADER_ENTRY = 0xfc00;

// Boot sector constants
export const BOOT_SECTOR = {
  MAGIC_0: 0x57, // 'W'
  MAGIC_1: 0x46, // 'F'
  OFFSET_ENTRY: 0x02,
  OFFSET_LOAD: 0x04,
  OFFSET_COUNT: 0x06,
  OFFSET_DATA: 0x08,
};

// Default load address
export const DEFAULT_LOAD_ADDRESS = 0x0800;

// Disk I/O registers
export const DISK_IO = {
  STATUS: 0x8020,
  CMD: 0x8021,
  SECTOR_LO: 0x8022,
  SECTOR_HI: 0x8023,
  BUFFER_LO: 0x8024,
  BUFFER_HI: 0x8025,
  COUNT: 0x8026,
};

// Disk commands
export const DISK_CMD = {
  READ: 0x01,
  WRITE: 0x02,
};

// Assembly source for the boot loader
export const BOOT_LOADER_SOURCE = `
; ============================================================
; Boot Loader ROM - $FC00
; ============================================================
; Reads boot sector from disk and boots the system
; Uses BIOS routines for console output
; ============================================================

.ORG $FC00

; Zero page usage:
;   $E0-$E1  Entry point
;   $E2-$E3  Load address
;   $E4-$E5  Sector count
;   $E6-$E7  Source pointer
;
; I/O Addresses:
;   $8020 - DISK_STATUS
;   $8021 - DISK_CMD
;   $8022 - DISK_SEC_LO
;   $8023 - DISK_SEC_HI
;   $8024 - DISK_BUF_LO
;   $8025 - DISK_BUF_HI
;   $8026 - DISK_COUNT
;
; BIOS routines:
;   $F000 - PUTCHAR
;   $F080 - NEWLINE
;
; Disk buffer: $4800

; ============================================================
; BOOT_ENTRY - Main boot loader entry point
; ============================================================
BOOT_ENTRY:
    ; Print "BOOT" message
    LDA #$42            ; 'B'
    JSR $F000           ; PUTCHAR
    LDA #$4F            ; 'O'
    JSR $F000
    LDA #$4F            ; 'O'
    JSR $F000
    LDA #$54            ; 'T'
    JSR $F000
    JSR $F080           ; NEWLINE

    ; Read boot sector (sector 0) into disk buffer
    LDA #$00
    STA $8022           ; DISK_SEC_LO
    STA $8023           ; DISK_SEC_HI

    LDA #$00            ; Buffer at $4800
    STA $8024           ; DISK_BUF_LO
    LDA #$48
    STA $8025           ; DISK_BUF_HI

    LDA #$01            ; Read 1 sector
    STA $8026           ; DISK_COUNT

    LDA #$01            ; READ command
    STA $8021           ; DISK_CMD

    ; Wait for disk ready
WAIT_DISK:
    LDA $8020           ; DISK_STATUS
    AND #$02            ; Check busy bit
    BNE WAIT_DISK
    LDA $8020           ; DISK_STATUS
    AND #$80            ; Check error bit
    BEQ DISK_OK1
    JMP DISK_ERROR
DISK_OK1:

    ; Check magic bytes "WF"
    LDA $4800           ; DISK_BUFFER[0]
    CMP #$57            ; 'W'
    BEQ MAGIC_OK1
    JMP NO_BOOT
MAGIC_OK1:
    LDA $4801           ; DISK_BUFFER[1]
    CMP #$46            ; 'F'
    BEQ MAGIC_OK2
    JMP NO_BOOT
MAGIC_OK2:

    ; Get entry point
    LDA $4802           ; DISK_BUFFER[2] - Entry low
    STA $E0
    LDA $4803           ; DISK_BUFFER[3] - Entry high
    STA $E1

    ; Get load address
    LDA $4804           ; DISK_BUFFER[4] - Load low
    STA $E2
    LDA $4805           ; DISK_BUFFER[5] - Load high
    STA $E3

    ; Get sector count
    LDA $4806           ; DISK_BUFFER[6] - Count low
    STA $E4
    LDA $4807           ; DISK_BUFFER[7] - Count high
    STA $E5

    ; Print "OK"
    LDA #$4F            ; 'O'
    JSR $F000
    LDA #$4B            ; 'K'
    JSR $F000
    JSR $F080

    ; If more than 1 sector, load additional sectors
    LDA $E5             ; Check high byte
    BNE LOAD_MORE
    LDA $E4             ; Check if > 1
    CMP #$02
    BCC COPY_BOOT       ; <= 1 sector, just copy boot sector

LOAD_MORE:
    ; Load remaining sectors (sector 1 onwards)
    ; For now, we just support loading to the load address directly

    ; Set sector number to 1
    LDA #$01
    STA $8022           ; DISK_SEC_LO
    LDA #$00
    STA $8023           ; DISK_SEC_HI

    ; Set buffer to load address + 512 (skip boot sector area)
    LDA $E2
    CLC
    ADC #$00
    STA $8024           ; DISK_BUF_LO
    LDA $E3
    ADC #$02            ; Add 512 to high byte
    STA $8025           ; DISK_BUF_HI

    ; Calculate how many additional sectors
    SEC
    LDA $E4
    SBC #$01            ; Subtract 1 for boot sector
    STA $8026           ; DISK_COUNT

    ; Only if count > 0
    BEQ COPY_BOOT
    LDA $E5
    BNE DO_LOAD
    LDA $8026           ; DISK_COUNT
    BEQ COPY_BOOT

DO_LOAD:
    ; Read additional sectors
    LDA #$01            ; READ command
    STA $8021           ; DISK_CMD

    ; Wait for disk
WAIT_DISK2:
    LDA $8020           ; DISK_STATUS
    AND #$02
    BNE WAIT_DISK2
    LDA $8020           ; DISK_STATUS
    AND #$80
    BNE DISK_ERROR

COPY_BOOT:
    ; Copy boot sector data (starting at offset 8) to load address
    ; This is the first 504 bytes of code/data
    ; Use $E6/$E7 as source pointer
    LDA #$08            ; $4808 = DISK_BUFFER + 8
    STA $E6
    LDA #$48
    STA $E7

    LDY #$00
COPY_LOOP:
    LDA ($E6),Y         ; Load from source
    STA ($E2),Y         ; Store at load address
    INY
    BNE COPY_LOOP       ; Copy 256 bytes

    ; Increment high bytes for second 256 bytes
    INC $E3             ; Increment dest high byte
    INC $E7             ; Increment src high byte
COPY_LOOP2:
    LDA ($E6),Y         ; Continue copy
    STA ($E2),Y
    INY
    CPY #$F8            ; 504 - 256 = 248 bytes
    BNE COPY_LOOP2
    DEC $E3             ; Restore load address high byte

    ; Print "GO" and jump to entry point
    LDA #$47            ; 'G'
    JSR $F000
    LDA #$4F            ; 'O'
    JSR $F000
    JSR $F080

    JMP ($00E0)         ; Jump to entry point

; ============================================================
; DISK_ERROR - Handle disk error
; ============================================================
DISK_ERROR:
    LDA #$45            ; 'E'
    JSR $F000
    LDA #$52            ; 'R'
    JSR $F000
    LDA #$52            ; 'R'
    JSR $F000
    JSR $F080
    JMP BOOT_ENTRY      ; Retry

; ============================================================
; NO_BOOT - No bootable disk
; ============================================================
NO_BOOT:
    ; Print "NO BOOT"
    LDA #$4E            ; 'N'
    JSR $F000
    LDA #$4F            ; 'O'
    JSR $F000
    LDA #$20            ; ' '
    JSR $F000
    LDA #$42            ; 'B'
    JSR $F000
    LDA #$4F            ; 'O'
    JSR $F000
    LDA #$4F            ; 'O'
    JSR $F000
    LDA #$54            ; 'T'
    JSR $F000
    JSR $F080

    ; Fall through to hex loader if present
    JMP $F800           ; Jump to hex loader

; ============================================================
; End of Boot Loader
; ============================================================
`;

/**
 * Assemble the boot loader and return the bytes
 */
export function assembleBootLoader(): { bytes: Uint8Array; origin: number } {
  const result = assemble(BOOT_LOADER_SOURCE);
  return {
    bytes: result.bytes,
    origin: BOOT_LOADER_ENTRY,
  };
}

/**
 * Create a boot sector with the given code
 */
export function createBootSector(
  code: Uint8Array,
  entryPoint: number = DEFAULT_LOAD_ADDRESS,
  loadAddress: number = DEFAULT_LOAD_ADDRESS
): Uint8Array {
  const sector = new Uint8Array(512);

  // Magic bytes
  sector[0] = BOOT_SECTOR.MAGIC_0; // 'W'
  sector[1] = BOOT_SECTOR.MAGIC_1; // 'F'

  // Entry point (little-endian)
  sector[2] = entryPoint & 0xff;
  sector[3] = (entryPoint >> 8) & 0xff;

  // Load address (little-endian)
  sector[4] = loadAddress & 0xff;
  sector[5] = (loadAddress >> 8) & 0xff;

  // Sector count (how many sectors including boot sector)
  const totalSectors = Math.ceil((code.length + 8) / 512);
  sector[6] = totalSectors & 0xff;
  sector[7] = (totalSectors >> 8) & 0xff;

  // Copy code to boot sector (starting at offset 8)
  const maxBootCode = 512 - 8; // 504 bytes max in boot sector
  const bootCodeSize = Math.min(code.length, maxBootCode);
  for (let i = 0; i < bootCodeSize; i++) {
    sector[8 + i] = code[i];
  }

  return sector;
}

/**
 * Create a multi-sector boot image
 * Returns array of sectors to write to disk
 */
export function createBootImage(
  code: Uint8Array,
  entryPoint: number = DEFAULT_LOAD_ADDRESS,
  loadAddress: number = DEFAULT_LOAD_ADDRESS
): Uint8Array[] {
  const sectors: Uint8Array[] = [];

  // Create boot sector (sector 0)
  const bootSector = createBootSector(code, entryPoint, loadAddress);
  sectors.push(bootSector);

  // If code is larger than what fits in boot sector, create additional sectors
  const maxBootCode = 512 - 8; // 504 bytes in boot sector
  if (code.length > maxBootCode) {
    const remainingCode = code.subarray(maxBootCode);
    const additionalSectors = Math.ceil(remainingCode.length / 512);

    for (let s = 0; s < additionalSectors; s++) {
      const sector = new Uint8Array(512);
      const offset = s * 512;
      const size = Math.min(512, remainingCode.length - offset);
      for (let i = 0; i < size; i++) {
        sector[i] = remainingCode[offset + i];
      }
      sectors.push(sector);
    }
  }

  return sectors;
}

/**
 * Create combined ROM with hex loader and boot loader
 */
export function createBootRom(): Uint8Array {
  const rom = new Uint8Array(0x4000); // 16KB ROM ($C000-$FFFF)
  rom.fill(0xff); // Fill with $FF (like unprogrammed EPROM)

  // Add boot loader at $FC00
  const { bytes: bootBytes, origin: bootOrigin } = assembleBootLoader();
  const bootOffset = bootOrigin - 0xc000;
  for (let i = 0; i < bootBytes.length && bootOffset + i < rom.length; i++) {
    rom[bootOffset + i] = bootBytes[i];
  }

  // Set reset vector to boot loader
  rom[0x3ffc] = BOOT_LOADER_ENTRY & 0xff;        // $FFFC low byte
  rom[0x3ffd] = (BOOT_LOADER_ENTRY >> 8) & 0xff; // $FFFD high byte

  return rom;
}

// Export source for debugging
export { BOOT_LOADER_SOURCE as source };
