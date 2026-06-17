# AI-Prose

A markdown WYSIWYG editor built with Electron, React, and Tiptap.

## Features

- **WYSIWYG editing** with Tiptap — headings, bold, italic, strikethrough, links, images, tables, task lists, code blocks with syntax highlighting
- **Markdown source pane** with CodeMirror 6 — toggle with `Cmd+\` for side-by-side editing
- **File browser** — tree view for navigating markdown files in a directory (`Cmd+B`)
- **Dark mode** — follows system preference by default, manual override via status bar toggle or `Cmd+D`, persisted across sessions
- **Rich clipboard** — copy formatted content to paste into other apps
- **Cross-platform** — macOS, Windows, Linux

## Getting Started

```bash
npm install
npm run dev
```

## Build

```bash
npm run pack:mac    # macOS (dmg + zip)
npm run pack:win    # Windows (nsis)
npm run pack:linux  # Linux (AppImage + deb)
```

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| New file | `Cmd+N` |
| Open file | `Cmd+O` |
| Save | `Cmd+S` |
| Save As | `Cmd+Shift+S` |
| Undo | `Cmd+Z` |
| Redo | `Cmd+Shift+Z` |
| Toggle source pane | `Cmd+\` |
| Toggle file browser | `Cmd+B` |
| Toggle dark mode | `Cmd+D` |

## Tech Stack

- **Electron** 35 — desktop shell
- **React** 19 — UI framework
- **Tiptap** 3 — WYSIWYG editor (ProseMirror)
- **CodeMirror** 6 — markdown source editor
- **Zustand** 5 — state management
- **Allotment** — resizable panes
- **electron-vite** — build tooling
