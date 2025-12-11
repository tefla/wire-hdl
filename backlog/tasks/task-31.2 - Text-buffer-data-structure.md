---
id: task-31.2
title: Text buffer data structure
status: Done
assignee: []
created_date: '2025-12-11 15:00'
labels:
  - riscv
  - editor
  - data-structure
parent: task-31
dependencies: []
priority: high
---

## Description

Implement the core text buffer data structure for storing and manipulating the file content in memory.

**Data Structure Options:**

1. **Line-based Array** (Recommended for simplicity)
   - Array of line pointers
   - Each line is a null-terminated string
   - Easy to navigate by line number
   - Simple insertion/deletion of lines

2. **Gap Buffer** (More efficient for large files)
   - Single buffer with a gap at cursor position
   - Gap moves as cursor moves
   - Efficient for local edits

**Recommended: Line-based Array**
```c
struct TextBuffer {
  char** lines;        // Array of line pointers
  int lineCount;       // Number of lines
  int lineCapacity;    // Allocated capacity
  int modified;        // Dirty flag
};
```

**Functions to Implement:**
- `initBuffer()` - Initialize empty buffer
- `insertLine(lineNum, text)` - Insert a new line
- `deleteLine(lineNum)` - Remove a line
- `getLine(lineNum)` - Get line content
- `setLine(lineNum, text)` - Replace line content
- `getLineCount()` - Return number of lines
- `isModified()` - Check if buffer was modified
- `clearModified()` - Clear modified flag

**Memory Management:**
- Dynamic allocation for lines
- Grow array as needed
- Free memory on close

## Acceptance Criteria

- [x] Can initialize empty text buffer
- [x] Can insert lines at any position
- [x] Can delete lines
- [x] Can get/set line content
- [x] Modified flag tracks changes
- [x] Buffer handles growing beyond initial capacity
- [x] 8+ tests for buffer operations (10 tests implemented)
