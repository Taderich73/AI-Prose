import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import { useSearchStore } from './search-store'
import { buildSearchRegex } from './match-regex'

interface Match {
  from: number
  to: number
}

interface SearchPluginState {
  matches: Match[]
  activeIndex: number // -1 when no active match
  decorations: DecorationSet
}

const searchPluginKey = new PluginKey<SearchPluginState>('ai-prose-search')

const META_SET_MATCHES = 'searchSetMatches'
const META_SET_ACTIVE = 'searchSetActive'
const META_CLEAR = 'searchClear'

function findAllMatches(doc: PMNode, regex: RegExp): Match[] {
  const matches: Match[] = []
  doc.descendants((node, pos) => {
    if (!node.isText) return true
    const text = node.text ?? ''
    regex.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = regex.exec(text)) !== null) {
      const from = pos + m.index
      const to = from + m[0].length
      if (m[0].length === 0) {
        regex.lastIndex++
        continue
      }
      matches.push({ from, to })
    }
    return false
  })
  return matches
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    search: {
      searchRefresh: () => ReturnType
      searchFindNext: () => ReturnType
      searchFindPrev: () => ReturnType
      searchReplaceCurrent: () => ReturnType
      searchReplaceAll: () => ReturnType
      searchClear: () => ReturnType
    }
  }
}

export const SearchExtension = Extension.create({
  name: 'search',

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchPluginState>({
        key: searchPluginKey,
        state: {
          init(): SearchPluginState {
            return {
              matches: [],
              activeIndex: -1,
              decorations: DecorationSet.empty,
            }
          },
          apply(tr: Transaction, prev: SearchPluginState, _old, newState: EditorState): SearchPluginState {
            // Meta-driven updates.
            const setMatches = tr.getMeta(META_SET_MATCHES) as
              | { matches: Match[]; activeIndex: number }
              | undefined
            if (setMatches) {
              const { matches, activeIndex } = setMatches
              const decorations =
                matches.length === 0
                  ? DecorationSet.empty
                  : DecorationSet.create(
                      newState.doc,
                      matches.map((m, i) =>
                        Decoration.inline(m.from, m.to, {
                          class:
                            i === activeIndex
                              ? 'find-match find-match-current'
                              : 'find-match',
                        })
                      )
                    )
              return { matches, activeIndex, decorations }
            }
            const setActive = tr.getMeta(META_SET_ACTIVE) as number | undefined
            if (typeof setActive === 'number') {
              const decorations =
                prev.matches.length === 0
                  ? DecorationSet.empty
                  : DecorationSet.create(
                      newState.doc,
                      prev.matches.map((m, i) =>
                        Decoration.inline(m.from, m.to, {
                          class:
                            i === setActive
                              ? 'find-match find-match-current'
                              : 'find-match',
                        })
                      )
                    )
              return { ...prev, activeIndex: setActive, decorations }
            }
            if (tr.getMeta(META_CLEAR)) {
              return { matches: [], activeIndex: -1, decorations: DecorationSet.empty }
            }
            // Doc changes: re-map decoration positions; matches will be
            // re-derived by the next refresh() call.
            if (tr.docChanged) {
              return {
                ...prev,
                decorations: prev.decorations.map(tr.mapping, tr.doc),
                matches: prev.matches.map((m) => ({
                  from: tr.mapping.map(m.from),
                  to: tr.mapping.map(m.to),
                })),
              }
            }
            return prev
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)?.decorations ?? DecorationSet.empty
          },
        },
      }),
    ]
  },

  addCommands() {
    return {
      searchRefresh:
        () =>
        ({ state, dispatch }) => {
          const { query, caseSensitive, wholeWord } = useSearchStore.getState()
          const regex = buildSearchRegex(query, { caseSensitive, wholeWord })
          const matches = regex ? findAllMatches(state.doc, regex) : []
          const prevActive = searchPluginKey.getState(state)?.activeIndex ?? -1
          const activeIndex =
            matches.length === 0
              ? -1
              : prevActive >= 0 && prevActive < matches.length
                ? prevActive
                : 0
          if (dispatch) {
            // Update plugin state only — do not move the editor selection or
            // scroll while the user is still typing in the find input.
            dispatch(state.tr.setMeta(META_SET_MATCHES, { matches, activeIndex }))
            useSearchStore.setState({
              matchCount: matches.length,
              currentMatch: activeIndex >= 0 ? activeIndex + 1 : 0,
            })
          }
          return true
        },

      searchFindNext:
        () =>
        ({ state, dispatch }) => {
          const pluginState = searchPluginKey.getState(state)
          if (!pluginState || pluginState.matches.length === 0) return false
          const next = (pluginState.activeIndex + 1) % pluginState.matches.length
          if (dispatch) {
            const m = pluginState.matches[next]
            const tr = state.tr
              .setMeta(META_SET_ACTIVE, next)
              .setSelection(TextSelection.create(state.doc, m.from, m.to))
              .scrollIntoView()
            dispatch(tr)
            useSearchStore.setState({ currentMatch: next + 1 })
          }
          return true
        },

      searchFindPrev:
        () =>
        ({ state, dispatch }) => {
          const pluginState = searchPluginKey.getState(state)
          if (!pluginState || pluginState.matches.length === 0) return false
          const len = pluginState.matches.length
          const prev = (pluginState.activeIndex - 1 + len) % len
          if (dispatch) {
            const m = pluginState.matches[prev]
            const tr = state.tr
              .setMeta(META_SET_ACTIVE, prev)
              .setSelection(TextSelection.create(state.doc, m.from, m.to))
              .scrollIntoView()
            dispatch(tr)
            useSearchStore.setState({ currentMatch: prev + 1 })
          }
          return true
        },

      searchReplaceCurrent:
        () =>
        ({ state, dispatch, commands }) => {
          const pluginState = searchPluginKey.getState(state)
          if (!pluginState || pluginState.activeIndex < 0) return false
          const { replacement, query } = useSearchStore.getState()
          if (replacement === query) return false
          const match = pluginState.matches[pluginState.activeIndex]
          if (dispatch) {
            const tr = state.tr.insertText(replacement, match.from, match.to)
            dispatch(tr)
            // Re-run search to recompute matches & positions.
            queueMicrotask(() => commands.searchRefresh())
          }
          return true
        },

      searchReplaceAll:
        () =>
        ({ state, dispatch, commands }) => {
          const pluginState = searchPluginKey.getState(state)
          if (!pluginState || pluginState.matches.length === 0) return false
          const { replacement, query } = useSearchStore.getState()
          if (replacement === query) return false
          if (dispatch) {
            const tr = state.tr
            // Replace from last to first so earlier positions stay valid.
            for (let i = pluginState.matches.length - 1; i >= 0; i--) {
              const m = pluginState.matches[i]
              tr.insertText(replacement, m.from, m.to)
            }
            dispatch(tr)
            queueMicrotask(() => commands.searchRefresh())
          }
          return true
        },

      searchClear:
        () =>
        ({ state, dispatch }) => {
          if (dispatch) {
            dispatch(state.tr.setMeta(META_CLEAR, true))
            useSearchStore.setState({ matchCount: 0, currentMatch: 0 })
          }
          return true
        },
    }
  },
})
