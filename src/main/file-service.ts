import { dialog, BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import { open, readFile, readdir, realpath, rename, rm, stat } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

export interface FileResult {
  path: string
  content: string
}

export interface SaveResult {
  path: string
  success: boolean
}

/**
 * Replace a file's contents so that a failure leaves the original intact.
 *
 * A plain write empties the file before writing to it, so a crash or failed
 * write loses the document. Writing beside it and renaming over it is atomic.
 *
 * Args:
 *     filePath: File to create or replace. Symlinks are followed so the link
 *         itself survives.
 *     content: Text to store.
 */
async function writeFileAtomic(
  filePath: string,
  content: string
): Promise<void> {
  const target = await realpath(filePath).catch(() => filePath)
  const existing = await stat(target).catch(() => null)
  const tempPath = join(
    dirname(target),
    `.${basename(target)}.${randomUUID()}.tmp`
  )

  try {
    const handle = await open(tempPath, 'wx')
    try {
      await handle.writeFile(content, 'utf-8')
      if (existing) await handle.chmod(existing.mode)
      await handle.sync()
    } finally {
      await handle.close()
    }
    await rename(tempPath, target)
  } catch (error) {
    await rm(tempPath, { force: true })
    throw error
  }
}

export async function openFile(
  window: BrowserWindow
): Promise<FileResult | null> {
  const { canceled, filePaths } = await dialog.showOpenDialog(window, {
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] },
      { name: 'Text', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  })

  if (canceled || filePaths.length === 0) return null

  const filePath = filePaths[0]
  const content = await readFile(filePath, 'utf-8')
  return { path: filePath, content }
}

export async function saveFile(
  filePath: string,
  content: string
): Promise<{ success: boolean }> {
  await writeFileAtomic(filePath, content)
  return { success: true }
}

export async function saveFileAs(
  window: BrowserWindow,
  content: string
): Promise<SaveResult | null> {
  const { canceled, filePath } = await dialog.showSaveDialog(window, {
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    defaultPath: 'untitled.md',
  })

  if (canceled || !filePath) return null

  await writeFileAtomic(filePath, content)
  return { path: filePath, success: true }
}

export async function chooseDirectory(
  window: BrowserWindow
): Promise<string | null> {
  const { canceled, filePaths } = await dialog.showOpenDialog(window, {
    properties: ['openDirectory'],
  })

  if (canceled || filePaths.length === 0) return null
  return filePaths[0]
}

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

export async function openFilePath(
  filePath: string
): Promise<FileResult> {
  const content = await readFile(filePath, 'utf-8')
  return { path: filePath, content }
}
