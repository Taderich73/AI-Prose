# File Browser Pane Design

## Summary

Add a left-hand file browser pane to the markdown editor. The pane displays a tree view of files and folders, allows folder navigation, greys out non-markdown files, and supports double-clicking markdown files to open them in the editor. If unsaved changes exist when opening a new file, a save prompt appears.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Root directory selection | User picks via "Choose Folder" button | Simple, intentional. Can add persistence (remember last dir) later. |
| Navigation style | Tree view with expand/collapse | More context at a glance than flat drill-down |
| Layout integration | Nested Allotment (outer: browser \| editor area, inner: WYSIWYG \| source) | Minimal changes to existing code. Each split independent. Collapsing browser doesn't affect editor proportions. |
| Resizable/collapsible | Both | Consistent with existing source pane behavior via Allotment |
| Save prompt buttons | Save / Don't Save / Cancel | VS Code pattern. Don't block users who want to discard changes. |
| Dotfiles | Shown | User needs to browse `.claude` directory for markdown files |

## Architecture

### Layout

```
┌──────────────────────────────────────────────────┐
│                    Toolbar                        │
├─────────┬────────────────────────────────────────┤
│  File   │  ┌─────────────────┬─────────────┐    │
│  Browser│  │   WYSIWYG       │   Source     │    │
│  (tree) │  │   (TipTap)      │   (CM6)     │    │
│         │  │                  │             │    │
│         │  └─────────────────┴─────────────┘    │
├─────────┴────────────────────────────────────────┤
│                   Status Bar                      │
└──────────────────────────────────────────────────┘

Outer Allotment: FileBrowser | EditorArea
Inner Allotment (existing): WYSIWYG | Source
```

### New Files

| File | Purpose |
|------|---------|
| `src/renderer/components/FileBrowser.tsx` | Tree view component with empty state and active state |
| `src/renderer/components/SavePrompt.tsx` | Modal dialog: Save / Don't Save / Cancel |
| `src/renderer/hooks/useFileBrowser.ts` | Directory reading, tree state management |

### Modified Files

| File | Changes |
|------|---------|
| `src/renderer/App.tsx` | Wrap existing Allotment in outer Allotment with FileBrowser pane |
| `src/renderer/stores/editor-store.ts` | Add `rootDirectory`, `showFileBrowser` state |
| `src/main/ipc-handlers.ts` | Add `fs:choose-directory`, `fs:read-directory`, `file:open-path` handlers |
| `src/main/file-service.ts` | Add `chooseDirectory()`, `readDirectory()`, `openFilePath()` functions |
| `src/preload/index.ts` | Expose `chooseDirectory()`, `readDirectory()`, `openFilePath()` |
| `src/preload/index.d.ts` | Type declarations for new API methods |
| `src/renderer/app.css` | Styles for file browser and save prompt |

## Component Details

### FileBrowser.tsx

**Empty state** (no root directory):
- Centered "Choose Folder" button
- Calls `fs:choose-directory` which opens native OS folder picker

**Active state** (root directory set):
- Header bar: root folder name + change folder button
- Scrollable tree view below
- Folders: `▸`/`▾` arrows, single click to expand/collapse
- Markdown files (`.md`, `.markdown`, `.mdown`, `.mkd`): white text, double-click to open
- Non-markdown files: grey text, no interaction (default cursor)
- Sort order: folders first, then files, both alphabetical
- Dotfiles/dotfolders included

### SavePrompt.tsx

Centered modal overlay shown when double-clicking a markdown file while `isDirty` is true.

- Message: "Do you want to save changes to {filename}?"
- **Save**: saves current file, then opens new file. If no `filePath` (untitled), triggers Save As first.
- **Don't Save**: discards changes, opens new file directly
- **Cancel**: closes modal, no action

### useFileBrowser.ts

Manages tree state:
- `expandedFolders: Set<string>` — which folders are expanded
- `directoryContents: Map<string, DirectoryEntry[]>` — cached directory listings
- `toggleFolder(path)` — expand/collapse, reads directory on first expand
- `refreshDirectory(path)` — re-reads a directory

## IPC Channels

### `fs:choose-directory`

Opens native folder picker dialog. Returns `string | null`.

### `fs:read-directory`

Takes a directory path. Returns array of:
```typescript
interface DirectoryEntry {
  name: string
  path: string
  isDirectory: boolean
  isMarkdown: boolean
}
```
Uses `fs.promises.readdir` with `withFileTypes: true`. Sorts folders first, then files, alphabetical within each group. Determines `isMarkdown` by extension match against `.md`, `.markdown`, `.mdown`, `.mkd`.

### `file:open-path`

Takes a file path directly (no dialog). Reads and returns `{ path: string, content: string }`. Used by the file browser to open a specific file without triggering the OS file picker.

## File Opening Flow

1. User double-clicks markdown file in tree
2. Check `isDirty` in store
3. If **not dirty**: call `file:open-path`, load content into editor, update store
4. If **dirty**: show SavePrompt modal
   - **Save** → save current file (Save As if untitled) → open new file
   - **Don't Save** → clear dirty flag → open new file
   - **Cancel** → close modal

## Store Additions

```typescript
// New state
rootDirectory: string | null
showFileBrowser: boolean

// New actions
setRootDirectory: (path: string | null) => void
setShowFileBrowser: (show: boolean) => void
toggleFileBrowser: () => void
```

## No File Watching

The tree reads directory contents on folder expand. No live watching for v1. If a refresh mechanism is needed later, a refresh button can be added to the header.
