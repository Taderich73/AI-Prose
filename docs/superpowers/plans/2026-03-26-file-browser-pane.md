# File Browser Pane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a left-hand file browser pane with tree navigation, markdown-only file opening, and a save prompt for unsaved changes.

**Architecture:** Nested Allotment layout — outer split for file browser | editor area, inner split (existing) for WYSIWYG | source. New IPC channels for directory reading and direct file opening. Zustand store extended with browser state.

**Tech Stack:** React 19, Electron 35, Zustand 5, Allotment, TypeScript, Node fs/promises

---

### Task 1: Backend — File Service Functions

Add three new functions to the main process file service for directory operations and direct file opening.

**Files:**
- Modify: `src/main/file-service.ts`

- [ ] **Step 1: Add `chooseDirectory` function**

Add to the bottom of `src/main/file-service.ts`:

```typescript
export async function chooseDirectory(
  window: BrowserWindow
): Promise<string | null> {
  const { canceled, filePaths } = await dialog.showOpenDialog(window, {
    properties: ['openDirectory'],
  })

  if (canceled || filePaths.length === 0) return null
  return filePaths[0]
}
```

- [ ] **Step 2: Add `DirectoryEntry` interface and `readDirectory` function**

Add below `chooseDirectory` in `src/main/file-service.ts`:

```typescript
export interface DirectoryEntry {
  name: string
  path: string
  isDirectory: boolean
  isMarkdown: boolean
}

const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown', 'mdown', 'mkd'])

function isMarkdownFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return MARKDOWN_EXTENSIONS.has(ext)
}

export async function readDirectory(
  dirPath: string
): Promise<DirectoryEntry[]> {
  const { readdir } = await import('node:fs/promises')
  const { join } = await import('node:path')

  const entries = await readdir(dirPath, { withFileTypes: true })

  const result: DirectoryEntry[] = entries.map((entry) => ({
    name: entry.name,
    path: join(dirPath, entry.name),
    isDirectory: entry.isDirectory(),
    isMarkdown: !entry.isDirectory() && isMarkdownFile(entry.name),
  }))

  result.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return result
}
```

- [ ] **Step 3: Add `openFilePath` function**

Add below `readDirectory` in `src/main/file-service.ts`:

```typescript
export async function openFilePath(
  filePath: string
): Promise<FileResult> {
  const content = await readFile(filePath, 'utf-8')
  return { path: filePath, content }
}
```

- [ ] **Step 4: Verify the file compiles**

Run: `npx tsc --noEmit --project tsconfig.node.json 2>&1 | head -20`
Expected: No errors related to file-service.ts

- [ ] **Step 5: Commit**

```bash
git add src/main/file-service.ts
git commit -m "feat(file-service): add chooseDirectory, readDirectory, openFilePath"
```

---

### Task 2: Backend — IPC Handlers

Register IPC handlers for the three new file service functions.

**Files:**
- Modify: `src/main/ipc-handlers.ts`

- [ ] **Step 1: Update imports**

In `src/main/ipc-handlers.ts`, change the import on line 2 from:

```typescript
import { openFile, saveFile, saveFileAs } from './file-service'
```

to:

```typescript
import {
  openFile,
  saveFile,
  saveFileAs,
  chooseDirectory,
  readDirectory,
  openFilePath,
} from './file-service'
```

- [ ] **Step 2: Add three new handlers**

Add inside `registerIpcHandlers()` after the existing `file:save-as` handler (after line 22):

```typescript
  ipcMain.handle('fs:choose-directory', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return null
    return chooseDirectory(window)
  })

  ipcMain.handle(
    'fs:read-directory',
    async (_event, dirPath: string) => {
      return readDirectory(dirPath)
    }
  )

  ipcMain.handle(
    'file:open-path',
    async (_event, filePath: string) => {
      return openFilePath(filePath)
    }
  )
```

- [ ] **Step 3: Verify the file compiles**

Run: `npx tsc --noEmit --project tsconfig.node.json 2>&1 | head -20`
Expected: No errors related to ipc-handlers.ts

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc-handlers.ts
git commit -m "feat(ipc): register fs:choose-directory, fs:read-directory, file:open-path handlers"
```

---

### Task 3: Preload Bridge — Expose New API Methods

Expose the three new IPC channels to the renderer process through the context bridge.

**Files:**
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`

- [ ] **Step 1: Add methods to context bridge**

In `src/preload/index.ts`, add these three methods inside the `contextBridge.exposeInMainWorld('api', {` object, after the `saveFileAs` line (after line 7):

```typescript
  chooseDirectory: () => ipcRenderer.invoke('fs:choose-directory'),
  readDirectory: (dirPath: string) =>
    ipcRenderer.invoke('fs:read-directory', dirPath),
  openFilePath: (filePath: string) =>
    ipcRenderer.invoke('file:open-path', filePath),
```

- [ ] **Step 2: Add type declarations**

In `src/preload/index.d.ts`, add the `DirectoryEntry` interface before the `ElectronAPI` interface (before line 11):

```typescript
export interface DirectoryEntry {
  name: string
  path: string
  isDirectory: boolean
  isMarkdown: boolean
}
```

Then add these three method signatures inside the `ElectronAPI` interface, after the `saveFileAs` line (after line 14, accounting for the new interface above):

```typescript
  chooseDirectory: () => Promise<string | null>
  readDirectory: (dirPath: string) => Promise<DirectoryEntry[]>
  openFilePath: (filePath: string) => Promise<FileResult>
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit --project tsconfig.node.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/preload/index.ts src/preload/index.d.ts
git commit -m "feat(preload): expose chooseDirectory, readDirectory, openFilePath to renderer"
```

---

### Task 4: Store — Add File Browser State

Extend the Zustand store with file browser state and actions.

**Files:**
- Modify: `src/renderer/stores/editor-store.ts`

- [ ] **Step 1: Add file browser state and actions to the interface**

In `src/renderer/stores/editor-store.ts`, add these fields to the `EditorState` interface after `activePane: ActivePane` (after line 10):

```typescript
  rootDirectory: string | null
  showFileBrowser: boolean
```

And add these actions after `reset: () => void` (after line 17):

```typescript
  setRootDirectory: (path: string | null) => void
  setShowFileBrowser: (show: boolean) => void
  toggleFileBrowser: () => void
```

- [ ] **Step 2: Add initial state and action implementations**

In the `create<EditorState>` call, add after `activePane: 'wysiwyg',` (after line 25):

```typescript
  rootDirectory: null,
  showFileBrowser: true,
```

And add after the `reset` action implementation (after line 34):

```typescript
  setRootDirectory: (path) => set({ rootDirectory: path }),
  setShowFileBrowser: (show) => set({ showFileBrowser: show }),
  toggleFileBrowser: () =>
    set((state) => ({ showFileBrowser: !state.showFileBrowser })),
```

- [ ] **Step 3: Verify the app still compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/renderer/stores/editor-store.ts
git commit -m "feat(store): add rootDirectory, showFileBrowser state and actions"
```

---

### Task 5: Hook — useFileBrowser

Create the custom hook that manages directory tree state, folder expansion, and directory reading.

**Files:**
- Create: `src/renderer/hooks/useFileBrowser.ts`

- [ ] **Step 1: Create the hook**

Create `src/renderer/hooks/useFileBrowser.ts`:

```typescript
import { useState, useCallback } from 'react'

interface DirectoryEntry {
  name: string
  path: string
  isDirectory: boolean
  isMarkdown: boolean
}

interface FileBrowserState {
  expandedFolders: Set<string>
  directoryContents: Map<string, DirectoryEntry[]>
  loading: Set<string>
}

export function useFileBrowser() {
  const [state, setState] = useState<FileBrowserState>({
    expandedFolders: new Set(),
    directoryContents: new Map(),
    loading: new Set(),
  })

  const loadDirectory = useCallback(async (dirPath: string) => {
    setState((prev) => ({
      ...prev,
      loading: new Set(prev.loading).add(dirPath),
    }))

    try {
      const entries = await window.api.readDirectory(dirPath)
      setState((prev) => {
        const newContents = new Map(prev.directoryContents)
        newContents.set(dirPath, entries)
        const newLoading = new Set(prev.loading)
        newLoading.delete(dirPath)
        return { ...prev, directoryContents: newContents, loading: newLoading }
      })
    } catch {
      setState((prev) => {
        const newLoading = new Set(prev.loading)
        newLoading.delete(dirPath)
        return { ...prev, loading: newLoading }
      })
    }
  }, [])

  const toggleFolder = useCallback(
    async (dirPath: string) => {
      setState((prev) => {
        const newExpanded = new Set(prev.expandedFolders)
        if (newExpanded.has(dirPath)) {
          newExpanded.delete(dirPath)
          return { ...prev, expandedFolders: newExpanded }
        }
        newExpanded.add(dirPath)
        return { ...prev, expandedFolders: newExpanded }
      })

      if (!state.directoryContents.has(dirPath)) {
        await loadDirectory(dirPath)
      }
    },
    [state.directoryContents, loadDirectory]
  )

  const isExpanded = useCallback(
    (dirPath: string) => state.expandedFolders.has(dirPath),
    [state.expandedFolders]
  )

  const isLoading = useCallback(
    (dirPath: string) => state.loading.has(dirPath),
    [state.loading]
  )

  const getContents = useCallback(
    (dirPath: string) => state.directoryContents.get(dirPath) ?? [],
    [state.directoryContents]
  )

  const reset = useCallback(() => {
    setState({
      expandedFolders: new Set(),
      directoryContents: new Map(),
      loading: new Set(),
    })
  }, [])

  return {
    toggleFolder,
    isExpanded,
    isLoading,
    getContents,
    loadDirectory,
    reset,
  }
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer/hooks/useFileBrowser.ts
git commit -m "feat(hooks): add useFileBrowser hook for tree state management"
```

---

### Task 6: Component — SavePrompt

Create the save prompt modal component.

**Files:**
- Create: `src/renderer/components/SavePrompt.tsx`

- [ ] **Step 1: Create the component**

Create `src/renderer/components/SavePrompt.tsx`:

```typescript
interface SavePromptProps {
  fileName: string
  onSave: () => void
  onDontSave: () => void
  onCancel: () => void
}

export function SavePrompt({
  fileName,
  onSave,
  onDontSave,
  onCancel,
}: SavePromptProps) {
  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">Unsaved Changes</div>
        <div className="dialog-body">
          <p>Do you want to save changes to {fileName}?</p>
          <div className="dialog-actions">
            <button onClick={onDontSave}>Don&apos;t Save</button>
            <button onClick={onCancel}>Cancel</button>
            <button className="dialog-primary" onClick={onSave}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/SavePrompt.tsx
git commit -m "feat(components): add SavePrompt modal with Save/Don't Save/Cancel"
```

---

### Task 7: Component — FileBrowser

Create the file browser component with empty state, header, and recursive tree view.

**Files:**
- Create: `src/renderer/components/FileBrowser.tsx`

- [ ] **Step 1: Create the component**

Create `src/renderer/components/FileBrowser.tsx`:

```typescript
import { useCallback, useEffect } from 'react'
import { useEditorStore } from '../stores/editor-store'
import { useFileBrowser } from '../hooks/useFileBrowser'

interface TreeNodeProps {
  name: string
  path: string
  isDirectory: boolean
  isMarkdown: boolean
  depth: number
  isExpanded: boolean
  isLoading: boolean
  children: React.ReactNode
  onToggleFolder: (path: string) => void
  onOpenFile: (path: string) => void
}

function TreeNode({
  name,
  isDirectory,
  isMarkdown,
  depth,
  isExpanded,
  isLoading,
  children,
  path,
  onToggleFolder,
  onOpenFile,
}: TreeNodeProps) {
  const handleClick = () => {
    if (isDirectory) onToggleFolder(path)
  }

  const handleDoubleClick = () => {
    if (!isDirectory && isMarkdown) onOpenFile(path)
  }

  const arrow = isDirectory ? (isExpanded ? '▾' : '▸') : ' '
  const icon = isDirectory ? '📁' : '📄'
  const isDisabled = !isDirectory && !isMarkdown

  return (
    <div>
      <div
        className={`tree-node ${isDisabled ? 'tree-node-disabled' : ''} ${
          isDirectory ? 'tree-node-folder' : ''
        } ${!isDirectory && isMarkdown ? 'tree-node-markdown' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        <span className="tree-arrow">{arrow}</span>
        <span className="tree-icon">{icon}</span>
        <span className="tree-name">{name}</span>
        {isLoading && <span className="tree-loading">…</span>}
      </div>
      {isDirectory && isExpanded && (
        <div className="tree-children">{children}</div>
      )}
    </div>
  )
}

interface FileBrowserProps {
  onOpenFile: (path: string) => void
}

export function FileBrowser({ onOpenFile }: FileBrowserProps) {
  const { rootDirectory, setRootDirectory } = useEditorStore()
  const { toggleFolder, isExpanded, isLoading, getContents, loadDirectory, reset } =
    useFileBrowser()

  const handleChooseFolder = useCallback(async () => {
    const dir = await window.api.chooseDirectory()
    if (dir) {
      reset()
      setRootDirectory(dir)
    }
  }, [reset, setRootDirectory])

  useEffect(() => {
    if (rootDirectory) {
      loadDirectory(rootDirectory)
    }
  }, [rootDirectory, loadDirectory])

  if (!rootDirectory) {
    return (
      <div className="file-browser">
        <div className="file-browser-empty">
          <button className="file-browser-choose" onClick={handleChooseFolder}>
            Choose Folder
          </button>
        </div>
      </div>
    )
  }

  const rootName = rootDirectory.split('/').pop() ?? rootDirectory

  function renderTree(dirPath: string, depth: number) {
    const contents = getContents(dirPath)
    return contents.map((entry) => (
      <TreeNode
        key={entry.path}
        name={entry.name}
        path={entry.path}
        isDirectory={entry.isDirectory}
        isMarkdown={entry.isMarkdown}
        depth={depth}
        isExpanded={isExpanded(entry.path)}
        isLoading={isLoading(entry.path)}
        onToggleFolder={toggleFolder}
        onOpenFile={onOpenFile}
      >
        {entry.isDirectory && isExpanded(entry.path)
          ? renderTree(entry.path, depth + 1)
          : null}
      </TreeNode>
    ))
  }

  return (
    <div className="file-browser">
      <div className="file-browser-header">
        <span className="file-browser-root-name" title={rootDirectory}>
          {rootName}
        </span>
        <button
          className="file-browser-change"
          onClick={handleChooseFolder}
          title="Change folder"
        >
          ···
        </button>
      </div>
      <div className="file-browser-tree">{renderTree(rootDirectory, 0)}</div>
    </div>
  )
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/FileBrowser.tsx
git commit -m "feat(components): add FileBrowser with tree view, empty state, and folder navigation"
```

---

### Task 8: CSS — File Browser and Save Prompt Styles

Add styles for the file browser pane, tree nodes, and save prompt.

**Files:**
- Modify: `src/renderer/app.css`

- [ ] **Step 1: Add file browser styles**

Append to the end of `src/renderer/app.css`:

```css
/* File browser */
.file-browser {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  border-right: 1px solid var(--border-color);
  user-select: none;
}

.file-browser-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-browser-choose {
  padding: 8px 20px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
}

.file-browser-choose:hover {
  background: var(--bg-secondary);
}

.file-browser-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.file-browser-root-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-browser-change {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 16px;
  padding: 0 4px;
  border-radius: 4px;
  line-height: 1;
}

.file-browser-change:hover {
  background: var(--button-hover);
  color: var(--text-primary);
}

.file-browser-tree {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: default;
  white-space: nowrap;
}

.tree-node-folder {
  cursor: pointer;
}

.tree-node-folder:hover {
  background: var(--button-hover);
}

.tree-node-markdown {
  cursor: pointer;
}

.tree-node-markdown:hover {
  background: var(--button-hover);
}

.tree-node-disabled {
  color: var(--text-secondary);
  opacity: 0.5;
}

.tree-arrow {
  width: 12px;
  font-size: 10px;
  text-align: center;
  flex-shrink: 0;
}

.tree-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.tree-name {
  overflow: hidden;
  text-overflow: ellipsis;
}

.tree-loading {
  color: var(--text-secondary);
  font-size: 12px;
  margin-left: 4px;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/app.css
git commit -m "feat(css): add file browser and tree node styles"
```

---

### Task 9: Integration — Wire FileBrowser and SavePrompt into App.tsx

Integrate the file browser into the layout with nested Allotment, and wire up the save prompt flow for opening files from the browser.

**Files:**
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Add imports**

In `src/renderer/App.tsx`, add these imports after the existing imports (after line 12):

```typescript
import { FileBrowser } from './components/FileBrowser'
import { SavePrompt } from './components/SavePrompt'
```

- [ ] **Step 2: Add state and file-open handler**

Add this import at the top of `App.tsx` (with the other imports):

```typescript
import { setMarkdownContent as loadMarkdown } from './editor/markdown-helpers'
```

Then add this state and handlers inside the `App` component, after `useMarkdownSync(editor, cmView)` (after line 30):

```typescript
  const [pendingFilePath, setPendingFilePath] = useState<string | null>(null)

  const openFileByPath = useCallback(
    async (targetPath: string) => {
      if (!editor) return
      const result = await window.api.openFilePath(targetPath)
      loadMarkdown(editor, result.content)
      useEditorStore.getState().setFilePath(result.path)
      useEditorStore.getState().setMarkdownContent(result.content)
      useEditorStore.getState().setDirty(false)
    },
    [editor]
  )

  const handleBrowserOpenFile = useCallback(
    (targetPath: string) => {
      if (isDirty) {
        setPendingFilePath(targetPath)
      } else {
        openFileByPath(targetPath)
      }
    },
    [isDirty, openFileByPath]
  )

  const handleSavePromptSave = useCallback(async () => {
    await handleSave()
    if (pendingFilePath) {
      await openFileByPath(pendingFilePath)
      setPendingFilePath(null)
    }
  }, [handleSave, pendingFilePath, openFileByPath])

  const handleSavePromptDontSave = useCallback(() => {
    if (pendingFilePath) {
      useEditorStore.getState().setDirty(false)
      openFileByPath(pendingFilePath)
      setPendingFilePath(null)
    }
  }, [pendingFilePath, openFileByPath])

  const handleSavePromptCancel = useCallback(() => {
    setPendingFilePath(null)
  }, [])
```

- [ ] **Step 3: Update the store destructure**

Change line 18-19 from:

```typescript
  const { filePath, isDirty, showSourcePane, toggleSourcePane } =
    useEditorStore()
```

to:

```typescript
  const { filePath, isDirty, showSourcePane, showFileBrowser, toggleSourcePane } =
    useEditorStore()
```

- [ ] **Step 4: Update the JSX layout**

Replace the return statement (lines 46-63) with:

```tsx
  return (
    <div className="app">
      <Toolbar editor={editor} onNew={handleNew} onOpen={handleOpen} onSave={handleSave} />
      <div className="editor-container">
        <Allotment>
          {showFileBrowser && (
            <Allotment.Pane preferredSize={220} minSize={150} maxSize={400}>
              <FileBrowser onOpenFile={handleBrowserOpenFile} />
            </Allotment.Pane>
          )}
          <Allotment.Pane>
            <Allotment defaultSizes={[60, 40]}>
              <Allotment.Pane minSize={300}>
                <EditorPane onEditorReady={handleEditorReady} />
              </Allotment.Pane>
              {showSourcePane && (
                <Allotment.Pane minSize={250}>
                  <SourcePane onViewReady={handleCmViewReady} />
                </Allotment.Pane>
              )}
            </Allotment>
          </Allotment.Pane>
        </Allotment>
      </div>
      <StatusBar />
      {pendingFilePath && (
        <SavePrompt
          fileName={filePath ? filePath.split('/').pop()! : 'Untitled'}
          onSave={handleSavePromptSave}
          onDontSave={handleSavePromptDontSave}
          onCancel={handleSavePromptCancel}
        />
      )}
    </div>
  )
```

- [ ] **Step 5: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat(app): integrate file browser pane with nested Allotment and save prompt"
```

---

### Task 10: Manual Smoke Test

Verify the feature works end-to-end in the running app.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify empty state**

- The left pane should show with a "Choose Folder" button centered
- Click "Choose Folder" — the native folder picker should open

- [ ] **Step 3: Verify tree navigation**

- Select a folder with markdown files
- The header should show the folder name
- Folders should appear with `▸` arrows
- Click a folder to expand — it should show `▾` and list contents
- Markdown files should be white, non-markdown files should be greyed out
- Dotfiles and dotfolders should be visible

- [ ] **Step 4: Verify file opening (no unsaved changes)**

- Double-click a markdown file
- It should load in the WYSIWYG editor
- The window title should update
- The status bar should show the filename

- [ ] **Step 5: Verify save prompt**

- Edit the open file (type something)
- Double-click a different markdown file in the browser
- The save prompt should appear with "Save / Don't Save / Cancel"
- Test each button:
  - **Cancel**: modal closes, original file stays open with changes
  - **Don't Save**: new file opens, changes discarded
  - **Save**: current file saves, then new file opens

- [ ] **Step 6: Verify pane resizing**

- Drag the divider between file browser and editor
- The file browser should resize smoothly

- [ ] **Step 7: Commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix: address smoke test issues in file browser"
```
