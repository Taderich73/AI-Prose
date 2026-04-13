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
