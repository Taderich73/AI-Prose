import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  openFile: () => ipcRenderer.invoke('file:open'),
  saveFile: (path: string, content: string) =>
    ipcRenderer.invoke('file:save', path, content),
  saveFileAs: (content: string) => ipcRenderer.invoke('file:save-as', content),
  chooseDirectory: () => ipcRenderer.invoke('fs:choose-directory'),
  readDirectory: (dirPath: string) =>
    ipcRenderer.invoke('fs:read-directory', dirPath),
  openFilePath: (filePath: string) =>
    ipcRenderer.invoke('file:open-path', filePath),

  onMenuNew: (cb: () => void) => {
    ipcRenderer.on('menu:new', cb)
  },
  onMenuOpen: (cb: () => void) => {
    ipcRenderer.on('menu:open', cb)
  },
  onMenuSave: (cb: () => void) => {
    ipcRenderer.on('menu:save', cb)
  },
  onMenuSaveAs: (cb: () => void) => {
    ipcRenderer.on('menu:save-as', cb)
  },
  onMenuToggleSource: (cb: () => void) => {
    ipcRenderer.on('menu:toggle-source', cb)
  },
  onMenuToggleFileBrowser: (cb: () => void) => {
    ipcRenderer.on('menu:toggle-file-browser', cb)
  },
  onMenuToggleDarkMode: (cb: () => void) => {
    ipcRenderer.on('menu:toggle-dark-mode', cb)
  },
  onMenuUndo: (cb: () => void) => {
    ipcRenderer.on('menu:undo', cb)
  },
  onMenuRedo: (cb: () => void) => {
    ipcRenderer.on('menu:redo', cb)
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  },
})
