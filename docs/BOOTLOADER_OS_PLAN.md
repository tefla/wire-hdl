# Bootloader, BIOS & Operating System Plan

## Overview

Build a complete bootable computer system on top of our 6502-like CPU simulation, with:
- Working memory (RAM/ROM)
- **Persistent storage (disk drive)**
- Text display output
- Simple BIOS/monitor
- **Self-hosted assembler (bootstrapped from hand-coded machine code)**
- Basic operating system with command line

## The Bootstrap Philosophy

We'll bootstrap the system the same way early computers did:

```
┌─────────────────────────────────────────────────────────────────┐
│  Stage 0: HAND-CODED MACHINE CODE                               │
│  ─────────────────────────────────────────────────────────────  │
│  Manually write hex bytes for a MINIMAL assembler               │
│  ~300-500 bytes, just enough to parse:                          │
│    LDA #nn, STA $nnnn, JMP, JSR, RTS, labels, ORG, DB           │
└─────────────────────────┬───────────────────────────────────────┘
                          │ assembles
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  Stage 1: MINIMAL ASSEMBLER (runs on CPU)                       │
│  ─────────────────────────────────────────────────────────────  │
│  Written in assembly, assembled by Stage 0                      │
│  Adds: all 34 instructions, comments, expressions               │
└─────────────────────────┬───────────────────────────────────────┘
                          │ assembles
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  Stage 2: FULL ASSEMBLER (self-hosting)                         │
│  ─────────────────────────────────────────────────────────────  │
│  Can assemble itself! Now we can improve it freely.             │
│  Adds: macros, includes, better errors, optimizations           │
└─────────────────────────┬───────────────────────────────────────┘
                          │ assembles
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  Stage 3+: OPERATING SYSTEM, PROGRAMS                           │
│  ─────────────────────────────────────────────────────────────  │
│  OS written in assembly, assembled by Stage 2                   │
│  User programs, games, utilities...                             │
└─────────────────────────────────────────────────────────────────┘
```

This mirrors computing history: hand-coded → assembler → better assembler → compilers → OS

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Browser / JavaScript                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐  │
│  │   Canvas    │  │  Keyboard   │  │     Control Panel           │  │
│  │  (Display)  │  │   Input     │  │  (Reset, Speed, Debug)      │  │
│  └──────▲──────┘  └──────┬──────┘  └─────────────────────────────┘  │
│         │                │                                           │
└─────────┼────────────────┼───────────────────────────────────────────┘
          │                │
┌─────────┼────────────────┼───────────────────────────────────────────┐
│         │    WASM Simulator                                          │
│  ┌──────┴──────┐  ┌──────▼──────┐                                   │
│  │ Video RAM   │  │  Keyboard   │                                   │
│  │ $4000-$47FF │  │   Buffer    │                                   │
│  │ (2KB chars) │  │   $8010     │                                   │
│  └──────▲──────┘  └──────┬──────┘                                   │
│         │                │                                           │
│  ┌──────┴────────────────┴──────────────────────────────────────┐   │
│  │                    Address Decoder                            │   │
│  │  $0000-$3FFF: RAM (16KB)                                     │   │
│  │  $4000-$47FF: Video RAM (2KB)                                │   │
│  │  $8000-$801F: I/O Registers                                  │   │
│  │  $C000-$FFFF: ROM (16KB)                                     │   │
│  └──────────────────────────▲───────────────────────────────────┘   │
│                             │                                        │
│  ┌──────────────────────────┴───────────────────────────────────┐   │
│  │                      CPU (cpu_minimal)                        │   │
│  │   Registers: A, X, Y, SP, PC, Flags                          │   │
│  │   34 Instructions, 16-bit address, 8-bit data                │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Memory Map

```
$0000-$00FF   Zero Page (256 bytes) - Fast access variables
$0100-$01FF   Stack (256 bytes) - Hardware stack, SP relative
$0200-$3FFF   General RAM (~15KB) - Programs, data, buffers
$4000-$47FF   Video RAM (2KB) - 80x25 character display
$4800-$4FFF   Disk Buffer (2KB) - For disk I/O operations
$5000-$7FFF   Extended RAM (~12KB) - Large programs, data
$8000-$803F   I/O Registers (64 bytes) - See I/O Map below
$8040-$BFFF   Reserved (~16KB)
$C000-$FFFF   ROM (16KB) - BIOS, Monitor, Bootstrap
```

## I/O Register Map

```
; === Display ===
$8000   VID_STATUS      R   Bit 0: vsync active
$8001   CURSOR_X        RW  Cursor column (0-79)
$8002   CURSOR_Y        RW  Cursor row (0-24)
$8003   VID_CTRL        W   Bit 0: cursor visible, Bit 7: clear screen

; === Keyboard ===
$8010   KBD_STATUS      R   Bit 0: key available, Bit 1: key released
$8011   KBD_DATA        R   ASCII code of key (reading clears status)

; === Disk Drive ===
$8020   DISK_STATUS     R   Bit 0: ready, Bit 1: busy, Bit 7: error
$8021   DISK_CMD        W   Command: $01=read, $02=write, $03=seek
$8022   DISK_SECTOR_LO  RW  Sector number low byte
$8023   DISK_SECTOR_HI  RW  Sector number high byte (16-bit = 64K sectors)
$8024   DISK_BUFFER_LO  RW  Buffer address low byte
$8025   DISK_BUFFER_HI  RW  Buffer address high byte
$8026   DISK_COUNT      RW  Number of sectors to transfer

; === Serial Port (optional) ===
$8030   SERIAL_STATUS   R   Bit 0: RX ready, Bit 1: TX busy
$8031   SERIAL_DATA     RW  Serial data register

; === System ===
$803E   SYS_TICKS_LO    R   System tick counter low byte
$803F   SYS_TICKS_HI    R   System tick counter high byte
```

## Phase 1: Hardware Intrinsics

### 1.1 RAM Module (32KB)
```
- Main RAM: $0000-$3FFF (16KB)
- Disk buffer: $4800-$4FFF (2KB)
- Extended RAM: $5000-$7FFF (12KB)
- Synchronous read/write on clock edge
- Initialize to zeros on reset
```

### 1.2 Video RAM Module (2KB)
```
- Address: $4000-$47FF
- 80 columns × 25 rows = 2000 bytes
- Each byte is an ASCII character code
- Directly readable by JavaScript for rendering
```

### 1.3 ROM Module (16KB)
```
- Address: $C000-$FFFF
- Preloaded with BIOS binary
- Reset vector at $FFFC/$FFFD points to boot code
- Contains Stage 0 assembler + BIOS routines
```

### 1.4 Disk Drive (32MB virtual disk)
```
- 512 bytes per sector (standard)
- 65,536 sectors max (32MB total)
- Simple command interface via I/O registers
- Backed by JavaScript ArrayBuffer (persistent via IndexedDB)

Operation sequence:
1. Set DISK_SECTOR_LO/HI to sector number
2. Set DISK_BUFFER_LO/HI to RAM address for data
3. Set DISK_COUNT to number of sectors
4. Write command to DISK_CMD ($01=read, $02=write)
5. Poll DISK_STATUS until not busy
6. Check error bit
```

### 1.5 Disk Layout
```
Sector 0        Boot sector (loaded to $0200, JMP to start)
Sectors 1-15    Reserved (partition table, etc.)
Sectors 16-127  OS kernel + Stage 1 assembler (~56KB)
Sectors 128+    File system / user data
```

## Phase 2: Bootstrap Assembler

### Stage 0: Hand-Coded Machine Code

The first assembler is written directly in hex. It must be small but functional enough to assemble Stage 1.

**Capabilities needed:**
- Parse: `LDA`, `STA`, `LDX`, `LDY`, `STX`, `STY`, `JMP`, `JSR`, `RTS`, `INX`, `DEX`, `INY`, `DEY`
- Parse: `#$nn` (immediate), `$nnnn` (absolute)
- Parse: `ORG $nnnn`, `DB $nn`, labels
- Skip comments (`;`)
- Output binary to memory

**Example Stage 0 source (what we hand-assemble):**
```asm
; Minimal assembler - we write this in hex by hand
; Runs at $0200, reads source from $5000, outputs to $6000

        ORG $0200

start:  LDA #$00        ; Initialize output pointer
        STA out_ptr
        LDA #$60
        STA out_ptr+1
        ; ... tokenizer, parser, code generator ...
        RTS
```

**Hand-assembled output (first ~50 bytes):**
```
0200: A9 00       LDA #$00
0202: 8D 00 02    STA $0200  ; (would be actual variable address)
0205: A9 60       LDA #$60
0207: 8D 01 02    STA $0201
...
```

### Stage 1: Minimal Assembler (assembled by Stage 0)

Written in assembly language, assembled by Stage 0. Now we can write proper code!

**Additional capabilities:**
- All 34 CPU instructions
- Better error messages
- Two-pass assembly (resolve forward references)
- Symbol table
- Expressions: `label+1`, `<addr` (low byte), `>addr` (high byte)

### Stage 2: Full Assembler (self-hosting)

Written in assembly, assembled by Stage 1. Can now assemble itself!

**Additional capabilities:**
- Macros
- Conditional assembly
- Include files (from disk)
- Listing output
- Source-level debugging info

## Phase 3: BIOS

### 2.1 Simple Assembler
Build a minimal assembler that supports:
- All 34 CPU instructions
- Labels and symbols
- ORG directive (set address)
- DB/DW directives (data bytes/words)
- EQU directive (constants)
- Comments (;)

### 2.2 Example Syntax
```asm
; BIOS Entry Point
        ORG $C000

SCREEN  EQU $4000       ; Video RAM base
CURSOR_X EQU $8012      ; Cursor X register

start:
        LDA #'H'        ; Load ASCII 'H'
        STA SCREEN      ; Store to screen
        LDA #'i'
        STA SCREEN+1
        HLT

; Reset Vector
        ORG $FFFC
        DW start        ; Reset vector points to start
```

## Phase 3: BIOS / Monitor

### 3.1 Boot Sequence
```
1. CPU reset pulls PC from $FFFC/$FFFD
2. BIOS initializes:
   - Clear screen
   - Initialize cursor position
   - Print welcome message
3. Jump to monitor/OS
```

### 3.2 BIOS Routines (Callable from user programs)
```
$FF00   PUTCHAR     - Print character in A to screen
$FF03   GETCHAR     - Wait for keypress, return in A
$FF06   NEWLINE     - Move cursor to start of next line
$FF09   PRINT       - Print null-terminated string (pointer in X,Y)
$FF0C   CLEAR       - Clear screen
$FF0F   SETCURSOR   - Set cursor to X,Y position
```

### 3.3 Monitor Commands
```
> M 1234           - Display memory at $1234
> M 1234 AB        - Store $AB at $1234
> G 0200           - Execute code at $0200
> R                - Display registers
> L                - Load program (via serial/paste)
> H                - Help
```

## Phase 4: Display System

### 4.1 Character Display (80x25)
```javascript
// JavaScript side
class Display {
  constructor(canvas) {
    this.cols = 80;
    this.rows = 25;
    this.charWidth = 8;
    this.charHeight = 16;
    this.videoRAM = new Uint8Array(2000);
  }

  // Called each frame to render
  render(ctx) {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const char = this.videoRAM[y * this.cols + x];
        this.drawChar(ctx, x, y, char);
      }
    }
  }
}
```

### 4.2 Font
- Use a simple 8x16 bitmap font
- ASCII characters 32-126 (printable)
- Could embed CP437 or similar classic font

## Phase 5: Simple OS

### 5.1 Command Line Interface
```
WIRE-OS v0.1
Ready.
> HELLO
Hello, World!
> PEEK 0200
$0200: A9 48 8D 00 40 60
> POKE 4000 41
> RUN 0200
[executes program at $0200]
>
```

### 5.2 Built-in Commands
```
HELLO           - Print greeting
PEEK addr       - Show memory contents
POKE addr val   - Write to memory
RUN addr        - Execute code at address
CLS             - Clear screen
HELP            - Show commands
```

### 5.3 Simple Program Examples

**Hello World ($0200):**
```asm
        ORG $0200
hello:
        LDX #0          ; String index
loop:
        LDA msg,X       ; Load character
        BEQ done        ; If zero, done
        JSR $FF00       ; BIOS PUTCHAR
        INX
        JMP loop        ; Note: no BNE with indexed addressing
done:
        RTS

msg:    DB "Hello, World!", 0
```

## Implementation Order

### Sprint 1: Foundation (Memory & Basic I/O)
1. [ ] Implement RAM intrinsic in wire-hdl
2. [ ] Implement ROM intrinsic with loadable content
3. [ ] Implement Video RAM intrinsic
4. [ ] Create system integration (connect CPU to memory)
5. [ ] Basic JavaScript display renderer

### Sprint 2: Toolchain
6. [ ] Build simple assembler (TypeScript)
7. [ ] Test assembler with simple programs
8. [ ] Create ROM image builder

### Sprint 3: BIOS
9. [ ] Write BIOS in assembly:
   - Screen initialization
   - PUTCHAR routine
   - NEWLINE routine
   - Cursor management
10. [ ] Write boot message display
11. [ ] Test boot sequence

### Sprint 4: Monitor/OS
12. [ ] Implement keyboard input handling
13. [ ] Write command line parser
14. [ ] Implement basic commands (PEEK, POKE, RUN)
15. [ ] Add HELP and error handling

### Sprint 5: Polish & Demo
16. [ ] Add more commands
17. [ ] Write demo programs
18. [ ] Performance optimization
19. [ ] Documentation

## Technical Decisions

### Why Character Mode (not Pixel Framebuffer)?
1. **Simpler**: 2KB video RAM vs 8KB+ for bitmap
2. **Faster**: CPU writes one byte per character, not 8+ for pixels
3. **Classic**: Matches 8-bit era computers (Apple II text, C64 text mode)
4. **Practical**: Our CPU lacks bit manipulation (no shifts/rotates)

### Why 80x25?
- Standard terminal size
- Fits nicely in 2KB (2000 bytes)
- Good readability at modern resolutions
- Classic IBM PC text mode dimensions

### Keyboard Input Strategy
- JavaScript captures keydown events
- Writes ASCII code to $8011
- Sets "key available" flag at $8010 bit 0
- BIOS GETCHAR polls this flag, reads and clears

## Files to Create

```
wire-hdl/
├── src/
│   ├── intrinsics/
│   │   ├── ram.ts          # RAM intrinsic
│   │   ├── rom.ts          # ROM intrinsic
│   │   └── video-ram.ts    # Video RAM intrinsic
│   └── system/
│       └── computer.ts     # Full system integration
│
├── asm/
│   ├── assembler.ts        # Simple assembler
│   └── bios/
│       ├── bios.asm        # BIOS source
│       ├── monitor.asm     # Monitor/OS source
│       └── bios.bin        # Compiled ROM image
│
├── web/
│   ├── display.ts          # Canvas-based display
│   ├── keyboard.ts         # Keyboard input handler
│   └── computer-ui.ts      # Main UI/control panel
│
└── docs/
    └── BOOTLOADER_OS_PLAN.md  # This file
```

## Success Criteria

1. **Boot**: System boots from ROM, displays welcome message
2. **Display**: 80x25 character display renders correctly
3. **Input**: Can type commands via keyboard
4. **Execute**: Can run simple assembly programs
5. **Interactive**: Command line responds to user input

## Performance Target

- Maintain 1+ MHz effective speed
- Display updates at 60 FPS
- Responsive keyboard input (<50ms latency)

## Future Enhancements (Not in Initial Scope)

- [ ] File system (virtual disk)
- [ ] Program save/load
- [ ] More addressing modes in CPU
- [ ] Bitmap graphics mode
- [ ] Sound output
- [ ] Serial terminal emulation
- [ ] BASIC interpreter
