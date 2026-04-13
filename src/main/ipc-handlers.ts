import { ipcMain, BrowserWindow } from 'electron'
import {
  openFile,
  saveFile,
  saveFileAs,
  chooseDirectory,
  readDirectory,
  openFilePath,
} from './file-service'

export function registerIpcHandlers(): void {
  ipcMain.handle('file:open', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return null
    return openFile(window)
  })

  ipcMain.handle(
    'file:save',
    async (_event, filePath: string, content: string) => {
      return saveFile(filePath, content)
    }
  )

  ipcMain.handle('file:save-as', async (event, content: string) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return null
    return saveFileAs(window, content)
  })

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
}
