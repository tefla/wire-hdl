---
id: task-31.8
title: Command interface and keyboard shortcuts
status: To Do
assignee: []
created_date: '2025-12-11 15:00'
labels:
  - riscv
  - editor
  - ui
  - keyboard
parent: task-31
dependencies:
  - task-31.3
  - task-31.5
  - task-31.6
priority: high
---

## Description

Implement the main event loop and keyboard shortcut handling for the editor.

**Keyboard Shortcuts:**
- **Ctrl+S** - Save file
- **Ctrl+Q** - Quit editor (prompt if modified)
- **Ctrl+F** - Find/search
- **F3** - Find next
- **Ctrl+H** - Help screen
- **Arrow Keys** - Cursor navigation
- **Page Up/Down** - Scroll by screen
- **Home/End** - Start/end of line
- **Enter** - New line
- **Backspace** - Delete character before cursor
- **Delete** - Delete character at cursor
- **Printable chars** - Insert at cursor

**Main Event Loop:**
```c
void editorMain(filename) {
  loadFile(filename, buffer);
  clearEditor();

  while (running) {
    drawScreen(buffer, topLine, cursor);
    drawStatusBar(filename, cursor.row, cursor.col, modified);

    key = readKey();
    handleKey(key);
  }

  clearScreen();
}
```

**Key Input Handling:**
- Read from console using READ syscall
- Parse ANSI escape sequences for arrow keys
  - Up: `\x1b[A`
  - Down: `\x1b[B`
  - Right: `\x1b[C`
  - Left: `\x1b[D`
- Detect Ctrl key combinations (Ctrl+S = 0x13, Ctrl+Q = 0x11)
- Handle printable characters

**Quit Confirmation:**
- If file is modified, prompt: "Save changes? (Y/N/Cancel)"
- Y = save then quit
- N = quit without saving
- Cancel = return to editor

**Help Screen:**
- Show list of keyboard shortcuts
- Press any key to return

## Acceptance Criteria

- [ ] Main event loop processes keyboard input
- [ ] Ctrl+S saves file
- [ ] Ctrl+Q quits editor
- [ ] Prompts to save if modified on quit
- [ ] Arrow keys parsed correctly from ANSI sequences
- [ ] Ctrl key combinations detected
- [ ] Printable characters inserted
- [ ] Help screen shows shortcuts
- [ ] Editor integrates all components
- [ ] 8+ tests for keyboard handling
