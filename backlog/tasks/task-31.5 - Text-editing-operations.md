---
id: task-31.5
title: Text editing operations (insert/delete)
status: To Do
assignee: []
created_date: '2025-12-11 15:00'
labels:
  - riscv
  - editor
  - editing
parent: task-31
dependencies:
  - task-31.2
  - task-31.4
priority: high
---

## Description

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

## Acceptance Criteria

- [ ] Can type characters at cursor position
- [ ] Characters insert into middle of line
- [ ] Backspace deletes character before cursor
- [ ] Delete key deletes character at cursor
- [ ] Enter splits line at cursor
- [ ] Backspace at line start joins lines
- [ ] Delete at line end joins with next line
- [ ] Modified flag is set on any edit
- [ ] 10+ tests for editing operations
