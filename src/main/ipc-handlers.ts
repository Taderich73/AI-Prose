import { ipcMain, BrowserWindow, IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  openFile,
  saveFile,
  saveFileAs,
  chooseDirectory,
  readDirectory,
  openFilePath,
} from './file-service'
import { takePendingOpenPath } from './pending-open'

/**
 * Check that an IPC call comes from the app's own page.
 *
 * Args:
 *     event: The invoke event identifying the calling frame.
 *
 * Returns:
 *     True when the frame is the bundled renderer or the dev server.
 */
function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  try {
    const senderUrl = new URL(event.senderFrame?.url ?? '')
    const devUrl = process.env.ELECTRON_RENDERER_URL
    if (devUrl) return senderUrl.origin === new URL(devUrl).origin
    return (
      senderUrl.protocol === 'file:' &&
      fileURLToPath(senderUrl) === join(__dirname, '../renderer/index.html')
    )
  } catch {
    return false
  }
}

/**
 * Register an IPC handler that refuses callers other than the app's own page.
 *
 * Args:
 *     channel: IPC channel name.
 *     listener: Handler to run for trusted callers.
 */
function handleTrusted<Args extends unknown[], Result>(
  channel: string,
  listener: (event: IpcMainInvokeEvent, ...args: Args) => Result
): void {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedSender(event)) {
      throw new Error(`Blocked ${channel} from untrusted sender`)
    }
    return listener(event, ...(args as Args))
  })
}

export function registerIpcHandlers(): void {
  handleTrusted('file:open', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return null
    return openFile(window)
  })

  handleTrusted(
    'file:save',
    async (_event, filePath: string, content: string) => {
      return saveFile(filePath, content)
    }
  )

  handleTrusted('file:save-as', async (event, content: string) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return null
    return saveFileAs(window, content)
  })

  handleTrusted('fs:choose-directory', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return null
    return chooseDirectory(window)
  })

  handleTrusted(
    'fs:read-directory',
    async (_event, dirPath: string) => {
      return readDirectory(dirPath)
    }
  )

  handleTrusted(
    'file:open-path',
    async (_event, filePath: string) => {
      return openFilePath(filePath)
    }
  )

  handleTrusted('file:take-pending-open', async () => {
    return takePendingOpenPath()
  })
}
