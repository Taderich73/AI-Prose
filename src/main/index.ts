import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { registerIpcHandlers } from './ipc-handlers'
import { buildMenu } from './menu'
import { pathFromArgv, queueOpenPath } from './pending-open'

let mainWindow: BrowserWindow | null = null

/**
 * Open a link from a document in the user's browser.
 *
 * Only http and https are allowed, because the OS would otherwise launch
 * whichever app handles the scheme, on the say-so of an untrusted document.
 *
 * Args:
 *     url: The link target.
 */
function openInBrowser(url: string): void {
  try {
    const { protocol } = new URL(url)
    if (protocol !== 'http:' && protocol !== 'https:') return
  } catch {
    return
  }
  shell.openExternal(url).catch((error) => {
    console.error(`Failed to open ${url}:`, error)
  })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    title: 'AI-Prose',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // Documents are untrusted, and the preload bridge follows the window to any
  // page it navigates to, so the window must never leave the app's own page.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    event.preventDefault()
    openInBrowser(url)
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openInBrowser(url)
    return { action: 'deny' }
  })

  // Load the renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function focusMainWindow(): void {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
}

// macOS delivers Finder double-clicks and "Open With" as an Apple Event that
// can arrive before the ready event, so this stays at module scope.
app.on('open-file', (event, filePath) => {
  event.preventDefault()
  queueOpenPath(filePath)
  focusMainWindow()
})

// Without the lock, opening a file from Finder on Windows or Linux starts a
// second copy of the app instead of reusing the window that is already up.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const filePath = pathFromArgv(argv)
    if (filePath) queueOpenPath(filePath)
    focusMainWindow()
  })

  app.whenReady().then(() => {
    registerIpcHandlers()
    buildMenu()

    const launchPath = pathFromArgv(process.argv)
    if (launchPath) queueOpenPath(launchPath)

    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}
