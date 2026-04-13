import { dialog, BrowserWindow } from 'electron'
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

export interface FileResult {
  path: string
  content: string
}

export interface SaveResult {
  path: string
  success: boolean
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
  await writeFile(filePath, content, 'utf-8')
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

  await writeFile(filePath, content, 'utf-8')
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
