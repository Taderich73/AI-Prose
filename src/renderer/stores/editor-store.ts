import { create } from 'zustand'

export type ActivePane = 'wysiwyg' | 'source'
export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

interface EditorState {
  filePath: string | null
  isDirty: boolean
  markdownContent: string
  showSourcePane: boolean
  activePane: ActivePane
  rootDirectory: string | null
  showFileBrowser: boolean
  theme: ThemePreference
  resolvedTheme: ResolvedTheme

  setTheme: (theme: ThemePreference) => void
  cycleTheme: () => void
  setResolvedTheme: (resolved: ResolvedTheme) => void

  setFilePath: (path: string | null) => void
  setDirty: (dirty: boolean) => void
  setMarkdownContent: (content: string) => void
  toggleSourcePane: () => void
  setActivePane: (pane: ActivePane) => void
  reset: () => void
  setRootDirectory: (path: string | null) => void
  setShowFileBrowser: (show: boolean) => void
  toggleFileBrowser: () => void
}

export const useEditorStore = create<EditorState>((set) => ({
  filePath: null,
  isDirty: false,
  markdownContent: '',
  showSourcePane: false,
  activePane: 'wysiwyg',
  rootDirectory: null,
  showFileBrowser: true,
  theme: (localStorage.getItem('theme') as ThemePreference) || 'system',
  resolvedTheme: 'light',

  setTheme: (theme) => {
    localStorage.setItem('theme', theme)
    set({ theme })
  },
  cycleTheme: () =>
    set((state) => {
      const next: ThemePreference =
        state.theme === 'system' ? 'light' : state.theme === 'light' ? 'dark' : 'system'
      localStorage.setItem('theme', next)
      return { theme: next }
    }),
  setResolvedTheme: (resolved) => set({ resolvedTheme: resolved }),

  setFilePath: (path) => set({ filePath: path }),
  setDirty: (dirty) => set({ isDirty: dirty }),
  setMarkdownContent: (content) => set({ markdownContent: content }),
  toggleSourcePane: () =>
    set((state) => ({ showSourcePane: !state.showSourcePane })),
  setActivePane: (pane) => set({ activePane: pane }),
  reset: () =>
    set({ filePath: null, isDirty: false, markdownContent: '' }),
  setRootDirectory: (path) => set({ rootDirectory: path }),
  setShowFileBrowser: (show) => set({ showFileBrowser: show }),
  toggleFileBrowser: () =>
    set((state) => ({ showFileBrowser: !state.showFileBrowser })),
}))
