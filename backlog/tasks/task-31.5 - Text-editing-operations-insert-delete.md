---
id: task-31.5
title: Text editing operations (insert/delete)
status: In Progress
assignee: []
created_date: '2025-12-11 15:00'
updated_date: '2025-12-12 11:19'
labels:
  - riscv
  - editor
  - editing
dependencies:
  - task-31.2
  - task-31.4
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement text insertion and deletion operations at the cursor position.

**Editing Operations:**

1. **Insert Character**
   - Insert character at cursor position
   - Shift remaining characters right
   - Advance cursor
   - Set modified flag

2. **Delete Character (Del)**
   - Delete character at cursor position
   - Shift remaining characters left
   - Keep cursor in place
   - Set modified flag

3. **Backspace**
   - Delete character before cursor
   - If at start of line, join with previous line
   - Move cursor left
   - Set modified flag

4. **Insert Newline (Enter)**
   - Split current line at cursor position
   - Create new line with text after cursor
   - Move cursor to start of new line
   - Set modified flag

5. **Delete Line**
   - Remove entire current line
   - Move cursor to same line number (now has different content)
   - Set modified flag

**String Manipulation Helpers:**
- `insertChar(str, pos, ch)` - Insert character into string
- `deleteChar(str, pos)` - Delete character from string
- `splitString(str, pos)` - Split string at position
- `joinStrings(str1, str2)` - Concatenate strings

**Memory Management:**
- Reallocate line buffer when growing
- Free old buffer after reallocation
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Can type characters at cursor position
- [ ] #2 Characters insert into middle of line
- [ ] #3 Backspace deletes character before cursor
- [ ] #4 Delete key deletes character at cursor
- [ ] #5 Enter splits line at cursor
- [ ] #6 Backspace at line start joins lines
- [ ] #7 Delete at line end joins with next line
- [ ] #8 Modified flag is set on any edit
- [ ] #9 10+ tests for editing operations
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Phase 1: Basic Character Input (Current Focus)
- Add main event loop with GETCHAR syscall
- Handle ESC key to exit
- Handle printable characters (0x20-0x7E)
- Display typed characters on screen
- Test: Type characters and see them appear

### Phase 2: Line Buffer Management
- Create line buffer structure (max 80 chars per line)
- Implement insertChar(buffer, position, char)
- Track cursor position within line
- Test: Insert chars at different positions

### Phase 3: Backspace
- Implement deleteChar(buffer, position)
- Handle backspace key (0x08)
- Move cursor left after delete
- Test: Backspace removes characters

### Phase 4: Enter Key (Line Splitting)
- Implement splitLine(buffer, position)
- Create new line with text after cursor
- Insert new line into line array
- Test: Enter creates new lines

### Phase 5: Delete Key
- Handle delete key
- Remove character at cursor without moving cursor
- Test: Delete removes char at cursor

### Architecture
```
main:
  - Initialize buffer (1 line, empty)
  - Initialize cursor (row=0, col=0)
  - Draw initial screen
  
mainLoop:
  - GETCHAR (blocking or polling)
  - If ESC: exit
  - If printable: insertChar, advance cursor
  - If backspace: deleteChar before cursor, move left
  - If enter: splitLine at cursor
  - Redraw line
  - Loop
```
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Phase 1 Complete - Basic Keyboard Input
- Created EDIT-INTERACTIVE.ASM with event loop
- Implements GETCHAR syscall for keyboard input
- Handles ESC key to exit
- Handles printable characters (echoes them)
- Handles backspace (visual feedback)
- Handles enter key (new prompt)
- Tests passing - program successfully reads keyboard and echoes characters
- Ready for manual testing in browser at http://localhost:5179
<!-- SECTION:NOTES:END -->
