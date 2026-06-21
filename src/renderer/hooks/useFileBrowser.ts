import { useState, useCallback, useRef } from 'react'

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

  // Mirror state in a ref so refresh() can read the latest loaded directories
  // without being recreated on every tree mutation.
  const stateRef = useRef(state)
  stateRef.current = state

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

  // Re-read every directory currently loaded (the root plus any expanded
  // subfolders) so newly added or removed files surface without collapsing
  // the tree. Expansion state is preserved because only contents are updated.
  const refresh = useCallback(
    async (rootDir?: string | null) => {
      const dirs = new Set(stateRef.current.directoryContents.keys())
      if (rootDir) dirs.add(rootDir)
      await Promise.all(Array.from(dirs).map((dir) => loadDirectory(dir)))
    },
    [loadDirectory]
  )

  return {
    toggleFolder,
    isExpanded,
    isLoading,
    getContents,
    loadDirectory,
    reset,
    refresh,
  }
}
