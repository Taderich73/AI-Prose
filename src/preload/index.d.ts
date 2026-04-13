export interface FileResult {
  path: string
  content: string
}

export interface SaveResult {
  path: string
  success: boolean
}

export interface DirectoryEntry {
  name: string
  path: string
  isDirectory: boolean
  isMarkdown: boolean
}

export interface ElectronAPI {
  openFile: () => Promise<FileResult | null>
  saveFile: (path: string, content: string) => Promise<{ success: boolean }>
  saveFileAs: (content: string) => Promise<SaveResult | null>
  chooseDirectory: () => Promise<string | null>
  readDirectory: (dirPath: string) => Promise<DirectoryEntry[]>
  openFilePath: (filePath: string) => Promise<FileResult>

  onMenuNew: (callback: () => void) => void
  onMenuOpen: (callback: () => void) => void
  onMenuSave: (callback: () => void) => void
  onMenuSaveAs: (callback: () => void) => void
  onMenuToggleSource: (callback: () => void) => void
  onMenuToggleFileBrowser: (callback: () => void) => void
  onMenuToggleDarkMode: (callback: () => void) => void
  onMenuUndo: (callback: () => void) => void
  onMenuRedo: (callback: () => void) => void

  removeAllListeners: (channel: string) => void
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
