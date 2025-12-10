# CLAUDE.md - Wire-HDL Monorepo Development Guide

## Project Overview

Wire-HDL is a **monorepo** containing browser-based CPU emulators with operating systems. Each package is a complete computing stack from CPU emulation to operating system.

**Packages:**
- **@wire-hdl/6502** - 6502 emulator with self-hosting assembler and WireOS
- **@wire-hdl/riscv** - RISC-V RV32I emulator (new)

**Tech Stack:**
- **Bun** - Runtime and package manager
- **TypeScript 5.3** - Strict mode enabled
- **Vite 7.2** - Build tool and dev server
- **React 19** - UI framework
- **Vitest 1.0** - Unit testing
- **Playwright 1.57** - E2E testing (6502 only)

## Directory Structure

```
wire-hdl/
├── packages/
│   ├── wire-6502/              # 6502 emulator package
│   │   ├── src/
│   │   │   ├── emulator/       # 6502 CPU emulator
│   │   │   ├── assembler/      # Stage 0 assembler and ROMs
│   │   │   ├── bootstrap/      # Bootstrap loaders
│   │   │   ├── system/         # OS-level components (WireFS)
│   │   │   └── web/            # React web application
│   │   ├── tests/              # Unit and E2E tests
│   │   ├── asm/                # Assembly source files
│   │   └── backlog/            # Project task tracking
│   │
│   └── wire-riscv/             # RISC-V emulator package
│       ├── src/
│       │   ├── emulator/       # RV32I CPU emulator
│       │   └── web/            # React web application
│       └── tests/              # Unit tests
│
├── package.json                # Workspace root
├── tsconfig.json               # TypeScript project references
└── .github/workflows/
    └── pages.yml               # GitHub Pages deployment
```

## Development Commands

### Root Level (all packages)
```bash
# Install dependencies
bun install

# Run all tests
bun run test:run

# Build all packages
bun run build
```

### Package-specific
```bash
# 6502 package
bun run 6502:dev          # Start dev server
bun run 6502:test         # Run tests (watch mode)
bun run 6502:test:run     # Run tests once
bun run 6502:build:web    # Build web app

# RISC-V package
bun run riscv:dev         # Start dev server
bun run riscv:test        # Run tests (watch mode)
bun run riscv:test:run    # Run tests once
bun run riscv:build:web   # Build web app
```

### Direct package commands
```bash
cd packages/wire-6502 && bun run dev
cd packages/wire-riscv && bun run dev
```

---

## Wire-6502 Package

### Features
- Full 6502 CPU emulator in TypeScript
- Self-hosting assembler (Stage 0 assembler can assemble its own source)
- WireOS - minimalist OS with shell, filesystem, graphics, and sound
- Persistent storage using browser IndexedDB

### Memory Map
```
$0000-$00FF  Zero page (fast access)
$0100-$01FF  Stack
$0200-$7FFF  RAM (user program area)
$8000-$80FF  I/O Registers
$8100-$8FFF  VRAM (4KB)
$C000-$FFFF  ROM (16KB)
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

### Key Files
- `src/emulator/cpu.ts` - 6502 CPU implementation
- `src/assembler/stage0.ts` - Assembler with 40+ addressing modes
- `src/system/wirefs.ts` - CP/M-like filesystem
- `src/web/graphics-card.ts` - 80x25 text / 160x100 graphics
- `src/web/sound-chip.ts` - NES-style APU (4 channels)

---

## Wire-RISCV Package

### Features
- RISC-V RV32I base integer instruction set emulator
- All base instructions: LUI, AUIPC, JAL, JALR, branches, loads, stores, ALU ops
- 32 general-purpose registers (x0 hardwired to 0)
- React-based web UI

### Memory Map
```
$0000-$FFFF  RAM (64KB default, configurable)
```

### Instruction Support
- **U-type**: LUI, AUIPC
- **J-type**: JAL
- **I-type**: JALR, loads (LB, LH, LW, LBU, LHU), ALU-immediate
- **S-type**: stores (SB, SH, SW)
- **B-type**: branches (BEQ, BNE, BLT, BGE, BLTU, BGEU)
- **R-type**: ALU (ADD, SUB, AND, OR, XOR, SLL, SRL, SRA, SLT, SLTU)
- **System**: ECALL, EBREAK, FENCE

### Key Files
- `src/emulator/cpu.ts` - RV32I CPU implementation
- `src/web/App.tsx` - React application

---

## Code Conventions

### TypeScript
- Strict mode enabled - no implicit any
- No unused locals or parameters
- Use ES modules (`.js` extension in imports for compiled output)

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

## Debugging Tips

1. **CPU Issues**: Check status flags and watch for incorrect branch behavior
2. **Assembler Issues**: Verify label resolution and addressing mode detection
3. **I/O Issues**: Check memory-mapped register addresses
4. **E2E Failures**: Screenshots captured on failure in playwright-report/
5. **Failing Tests**: Tests can expose real bugs in the codebase

<!-- BACKLOG.MD MCP GUIDELINES START -->

<CRITICAL_INSTRUCTION>

## BACKLOG WORKFLOW INSTRUCTIONS

This project uses Backlog.md MCP for all task and project management activities.

**CRITICAL GUIDANCE**

- If your client supports MCP resources, read `backlog://workflow/overview` to understand when and how to use Backlog for this project.
- If your client only supports tools or the above request fails, call `backlog.get_workflow_overview()` tool to load the tool-oriented overview (it lists the matching guide tools).

- **First time working here?** Read the overview resource IMMEDIATELY to learn the workflow
- **Already familiar?** You should have the overview cached ("## Backlog.md Overview (MCP)")
- **When to read it**: BEFORE creating tasks, or when you're unsure whether to track work

These guides cover:
- Decision framework for when to create tasks
- Search-first workflow to avoid duplicates
- Links to detailed guides for task creation, execution, and completion
- MCP tools reference

You MUST read the overview resource to understand the complete workflow. The information is NOT summarized here.

</CRITICAL_INSTRUCTION>

<!-- BACKLOG.MD MCP GUIDELINES END -->
