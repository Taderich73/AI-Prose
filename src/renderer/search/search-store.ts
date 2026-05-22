import { create } from 'zustand'

export type SearchMode = 'find' | 'replace'

interface SearchState {
  isOpen: boolean
  mode: SearchMode
  query: string
  replacement: string
  caseSensitive: boolean
  wholeWord: boolean
  matchCount: number
  // 1-based index of the active match for display; 0 when no active match.
  currentMatch: number

  open: (mode: SearchMode) => void
  close: () => void
  setMode: (mode: SearchMode) => void
  setQuery: (query: string) => void
  setReplacement: (replacement: string) => void
  toggleCaseSensitive: () => void
  toggleWholeWord: () => void
  setMatchInfo: (matchCount: number, currentMatch: number) => void
  reset: () => void
}

export const useSearchStore = create<SearchState>((set) => ({
  isOpen: false,
  mode: 'find',
  query: '',
  replacement: '',
  caseSensitive: false,
  wholeWord: false,
  matchCount: 0,
  currentMatch: 0,

  open: (mode) => set({ isOpen: true, mode }),
  close: () => set({ isOpen: false, matchCount: 0, currentMatch: 0 }),
  setMode: (mode) => set({ mode }),
  setQuery: (query) => set({ query }),
  setReplacement: (replacement) => set({ replacement }),
  toggleCaseSensitive: () => set((s) => ({ caseSensitive: !s.caseSensitive })),
  toggleWholeWord: () => set((s) => ({ wholeWord: !s.wholeWord })),
  setMatchInfo: (matchCount, currentMatch) => set({ matchCount, currentMatch }),
  reset: () =>
    set({
      isOpen: false,
      mode: 'find',
      query: '',
      replacement: '',
      caseSensitive: false,
      wholeWord: false,
      matchCount: 0,
      currentMatch: 0,
    }),
}))
