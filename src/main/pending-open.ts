import { app, BrowserWindow } from 'electron'
import { statSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Files the OS asked us to open before a renderer was ready to receive them.
 *
 * The renderer cannot load a document until its editor instance exists, so
 * paths are parked here and pulled once it can accept them.
 */
const pendingPaths: string[] = []

/**
 * Park a file the OS asked us to open and nudge any live window to collect it.
 *
 * Args:
 *     filePath: Path supplied by the OS, from an Apple Event or the argv.
 */
export function queueOpenPath(filePath: string): void {
  pendingPaths.push(filePath)
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('file:pending-open')
  }
}

/**
 * Hand over the most recent parked path and clear the queue.
 *
 * Returns:
 *     The path to open, or null when nothing is waiting. The newest request
 *     wins because the editor holds one document at a time.
 */
export function takePendingOpenPath(): string | null {
  const filePath = pendingPaths.pop() ?? null
  pendingPaths.length = 0
  return filePath
}

function isReadableFile(candidate: string): boolean {
  try {
    return statSync(resolve(candidate)).isFile()
  } catch {
    return false
  }
}

/**
 * Pick the document path out of a process argument list.
 *
 * Windows and Linux pass the file as an argument rather than an event. The
 * leading entries differ between a packaged app and `electron-vite dev`, and
 * the remaining args are checked against the filesystem so switches and the
 * dev entry point are never mistaken for documents.
 *
 * Args:
 *     argv: Argument list from process.argv or the second-instance event.
 *
 * Returns:
 *     An absolute path, or null when no argument names a readable file.
 */
export function pathFromArgv(argv: string[]): string | null {
  const args = argv.slice(app.isPackaged ? 1 : 2)
  const candidate = args.find(
    (arg) => !arg.startsWith('-') && isReadableFile(arg)
  )
  return candidate ? resolve(candidate) : null
}
