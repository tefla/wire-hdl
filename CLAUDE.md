# CLAUDE.md - Wire-HDL Development Guide

## Project Overview

Wire-HDL is a browser-based 6502 microprocessor emulator with a self-hosting operating system called **WireOS**. The project demonstrates a complete computing stack from CPU emulation to operating system.

**Key Features:**
- Full 6502 CPU emulator in TypeScript
- Self-hosting assembler (Stage 0 assembler can assemble its own source)
- WireOS - minimalist OS with shell, filesystem, graphics, and sound
- React-based web UI with canvas graphics and Web Audio
- Persistent storage using browser IndexedDB

## Directory Structure

```
wire-hdl/
├── src/
│   ├── emulator/           # 6502 CPU emulator
│   │   └── cpu.ts          # Main CPU implementation
│   ├── assembler/          # Stage 0 assembler and system ROMs
│   │   ├── stage0.ts       # Assembler (40+ addressing modes)
│   │   ├── bios.ts         # BIOS ROM with I/O routines
│   │   └── monitor.ts      # Monitor/debugger ROM
│   ├── bootstrap/          # Bootstrap loaders
│   │   ├── hex-loader.ts   # Serial hex loader
│   │   ├── boot-loader.ts  # Disk boot loader
│   │   ├── stage0-assembler.ts # Bootstrap assembler generator
│   │   ├── disk-image.ts   # Floppy disk image creation
│   │   ├── shell.ts        # WireOS shell
│   │   ├── asm0.ts         # Assembler module
│   │   └── edit.ts         # Text editor module
│   ├── system/             # OS-level components
│   │   ├── wirefs.ts       # WireFS filesystem (CP/M-like)
│   │   └── disk.ts         # Disk abstraction layer
│   ├── web/                # React web application
│   │   ├── App.tsx         # Main React component
│   │   ├── Computer.ts     # Emulated computer system
│   │   ├── Display.tsx     # Canvas graphics display
│   │   ├── Terminal.tsx    # Text terminal component
│   │   ├── graphics-card.ts # Graphics emulation
│   │   ├── sound-chip.ts   # NES-style sound synthesis
│   │   ├── font.ts         # Built-in font data
│   │   └── persistent-disk.ts # IndexedDB integration
│   └── index.ts            # Library exports
├── tests/
│   ├── emulator.test.ts    # CPU instruction tests
│   ├── assembler.test.ts   # Assembler syntax tests
│   ├── bootstrap.test.ts   # Loader tests
│   ├── shell.test.ts       # Shell command tests
│   ├── wirefs.test.ts      # Filesystem tests
│   └── e2e/
│       └── computer.spec.ts # Playwright browser tests
├── asm/                    # Assembly source files
│   ├── hello.asm           # Hello World example
│   ├── shell.asm           # WireOS shell
│   ├── asm.asm             # Self-hosted assembler
│   ├── edit.asm            # Text editor
│   └── ...                 # Other programs
└── .github/workflows/
    └── pages.yml           # GitHub Pages deployment
```

## Tech Stack

- **TypeScript 5.3** - Strict mode enabled
- **Vite 7.2** - Build tool and dev server
- **React 19** - UI framework
- **Vitest 1.0** - Unit testing
- **Playwright 1.57** - E2E testing
- **ES2022** - Target JavaScript version

## Development Commands

```bash
# Start development server (localhost:5173)
npm run dev

# Build TypeScript library to dist/
npm run build

# Build web app to dist-web/
npm run build:web

# Run unit tests (watch mode)
npm test

# Run unit tests once (CI mode)
npm run test:run

# Run E2E browser tests
npm run test:e2e

# Debug E2E tests with visible browser
npm run test:e2e:debug
```

## Testing

### Unit Tests (Vitest)
Located in `tests/*.test.ts`. Run with `npm test`.

Test files:
- `emulator.test.ts` - CPU instruction execution, flags, addressing modes
- `assembler.test.ts` - Assembly parsing, label resolution, codegen
- `bootstrap.test.ts` - Hex loader, boot loader functionality
- `wirefs.test.ts` - Filesystem operations
- `shell.test.ts` - Shell commands

### E2E Tests (Playwright)
Located in `tests/e2e/*.spec.ts`. Run with `npm run test:e2e`.

Tests full browser interaction: page load, CPU state, terminal I/O, boot sequence.

**Note:** Vitest is configured to exclude e2e tests (`**/*.spec.ts`).

## Memory Map

```
$0000-$00FF  Zero page (fast access)
$0100-$01FF  Stack
$0200-$7FFF  RAM (user program area)
$8000-$80FF  I/O Registers
$8100-$8FFF  VRAM (4KB)
$C000-$FFFF  ROM (16KB)
  $F000      BIOS entry points
  $F800      Hex loader
  $FFFC      Reset vector
```

### I/O Register Map
| Address | Name | Description |
|---------|------|-------------|
| $8010-$8011 | KBD | Keyboard status/data |
| $8020-$8026 | HDD | Hard disk I/O |
| $8030-$8031 | SERIAL | Serial port |
| $8040-$8046 | FLOPPY | Floppy disk I/O |
| $8050-$8061 | VIDEO | Graphics card |
| $8070-$8080 | SOUND | Sound chip |

## Architecture

### CPU Emulator (`src/emulator/cpu.ts`)
- Full 6502 instruction set
- All addressing modes: immediate, absolute, zero-page, indexed, indirect
- Status flags: C, Z, N, V, I, D, B
- IRQ and NMI interrupt support

### Assembler (`src/assembler/stage0.ts`)
- Comprehensive opcode table
- Label support with symbol resolution
- Addressing mode syntax:
  - Immediate: `LDA #$42`
  - Absolute: `STA $1234`
  - Zero-page: `LDA $50`
  - Indexed: `LDA $80,X`
  - Indirect: `JMP ($1234)`

### WireFS (`src/system/wirefs.ts`)
- CP/M-like design with 8.3 filenames
- 512-byte sectors
- Allocation bitmap for free space
- Directory entries with attributes (read-only, hidden, system, directory)
- Hierarchical directory support

### Graphics Card (`src/web/graphics-card.ts`)
- 80x25 character text mode
- 160x100 pixel graphics mode
- 16-color CGA palette
- VRAM mapped at $8100

### Sound Chip (`src/web/sound-chip.ts`)
- NES-style APU (4 channels)
- 2x Pulse wave, 1x Triangle, 1x Noise
- Web Audio API synthesis

## Code Conventions

### TypeScript
- Strict mode enabled - no implicit any
- No unused locals or parameters
- Explicit return types on functions
- Use ES modules (`.js` extension in imports for compiled output)

### File Organization
- One module per file
- Export types and constants alongside implementations
- Group related functionality in directories

### Naming
- `SCREAMING_CASE` for constants (addresses, opcodes)
- `camelCase` for functions and variables
- `PascalCase` for classes and types
- Files use `kebab-case.ts`

### Assembly Code (asm/*.asm)
- Labels start at column 0, end with `:`
- Instructions indented with spaces
- Comments with `;`
- Use `ORG` directive for origin address

## Key Patterns

### Adding CPU Instructions
Edit `src/emulator/cpu.ts`. Each instruction is a case in the execute switch with opcode handling.

### Adding Assembler Opcodes
Edit `src/assembler/stage0.ts` OPCODES table. Format: `[mnemonic]: { [addressingMode]: opcode }`.

### Adding Shell Commands
Edit `src/bootstrap/shell.ts`. Commands are matched in the shell's command parser.

### Adding I/O Devices
1. Define register addresses in appropriate source
2. Add memory-mapped I/O handling in Computer.ts
3. Create device class in `src/web/`

## Build Configuration

### TypeScript (`tsconfig.json`)
- Target: ES2022
- Module: ESNext
- Strict checks enabled
- Source maps and declaration maps generated

### Vite (`vite.config.ts`)
- React plugin for JSX
- Output to `dist-web/`
- Base path configurable via `VITE_BASE` env var

### GitHub Actions
Deploys to GitHub Pages on push to master:
- Builds with `VITE_BASE=/wire-hdl/`
- Uses Node.js 22

## Debugging Tips

1. **CPU Issues**: Check status flags (P register) and watch for incorrect branch behavior
2. **Assembler Issues**: Verify label resolution and addressing mode detection
3. **I/O Issues**: Check memory-mapped register addresses in Computer.ts
4. **E2E Failures**: Screenshots captured on failure in playwright-report/
