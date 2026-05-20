import { EditorView, Decoration, DecorationSet } from '@codemirror/view'
import {
  StateEffect,
  StateField,
  EditorSelection,
  type Extension,
} from '@codemirror/state'
import { RegExpCursor } from '@codemirror/search'
import { useSearchStore } from './search-store'
import { buildSearchRegex } from './match-regex'
import type { SearchController } from './search-controller'

interface CmMatch {
  from: number
  to: number
}

interface CmSearchState {
  matches: CmMatch[]
  activeIndex: number // -1 when no active
}

const setSearchState = StateEffect.define<CmSearchState>()
const clearSearch = StateEffect.define<null>()

const matchMark = Decoration.mark({ class: 'find-match' })
const activeMark = Decoration.mark({ class: 'find-match find-match-current' })

const searchField = StateField.define<{
  state: CmSearchState
  decorations: DecorationSet
}>({
  create() {
    return {
      state: { matches: [], activeIndex: -1 },
      decorations: Decoration.none,
    }
  },
  update(value, tr) {
    let next = value
    for (const e of tr.effects) {
      if (e.is(setSearchState)) {
        const s = e.value
        const decorations =
          s.matches.length === 0
            ? Decoration.none
            : Decoration.set(
                s.matches.map((m, i) =>
                  (i === s.activeIndex ? activeMark : matchMark).range(m.from, m.to)
                ),
                true
              )
        next = { state: s, decorations }
      } else if (e.is(clearSearch)) {
        next = {
          state: { matches: [], activeIndex: -1 },
          decorations: Decoration.none,
        }
      }
    }
    if (tr.docChanged && next === value && value.state.matches.length > 0) {
      // Remap on edits; the controller will refresh shortly to recompute.
      const remapped = value.state.matches
        .map((m) => ({
          from: tr.changes.mapPos(m.from),
          to: tr.changes.mapPos(m.to),
        }))
        .filter((m) => m.to > m.from)
      const decorations =
        remapped.length === 0
          ? Decoration.none
          : Decoration.set(
              remapped.map((m, i) =>
                (i === value.state.activeIndex && i < remapped.length
                  ? activeMark
                  : matchMark
                ).range(m.from, m.to)
              ),
              true
            )
      next = {
        state: {
          matches: remapped,
          activeIndex:
            value.state.activeIndex >= 0 && value.state.activeIndex < remapped.length
              ? value.state.activeIndex
              : remapped.length === 0
                ? -1
                : 0,
        },
        decorations,
      }
    }
    return next
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.decorations),
})

function computeMatches(view: EditorView): CmMatch[] {
  const { query, caseSensitive, wholeWord } = useSearchStore.getState()
  const regex = buildSearchRegex(query, { caseSensitive, wholeWord })
  if (!regex) return []
  const matches: CmMatch[] = []
  const cursor = new RegExpCursor(view.state.doc, regex.source, {
    ignoreCase: !caseSensitive,
  })
  while (!cursor.next().done) {
    const v = cursor.value
    if (v.from === v.to) continue
    matches.push({ from: v.from, to: v.to })
  }
  return matches
}

export function codeMirrorSearchExtension(): Extension {
  return [searchField]
}

export function createCodeMirrorSearchController(view: EditorView): SearchController {
  function syncCount(state: CmSearchState) {
    useSearchStore.setState({
      matchCount: state.matches.length,
      currentMatch: state.activeIndex >= 0 ? state.activeIndex + 1 : 0,
    })
  }

  function scrollActiveIntoView(state: CmSearchState) {
    if (state.activeIndex < 0) return
    const m = state.matches[state.activeIndex]
    view.dispatch({
      effects: EditorView.scrollIntoView(EditorSelection.range(m.from, m.to)),
    })
  }

  function refresh() {
    const matches = computeMatches(view)
    const prev = view.state.field(searchField).state.activeIndex
    const activeIndex =
      matches.length === 0
        ? -1
        : prev >= 0 && prev < matches.length
          ? prev
          : 0
    const nextState: CmSearchState = { matches, activeIndex }
    view.dispatch({ effects: setSearchState.of(nextState) })
    syncCount(nextState)
    // Do not scroll on plain refresh: the user may still be typing the query.
  }

  function step(direction: 1 | -1) {
    const current = view.state.field(searchField).state
    const len = current.matches.length
    if (len === 0) return
    const nextIndex =
      direction === 1
        ? (current.activeIndex + 1) % len
        : (current.activeIndex - 1 + len) % len
    const nextState: CmSearchState = { ...current, activeIndex: nextIndex }
    view.dispatch({ effects: setSearchState.of(nextState) })
    syncCount(nextState)
    scrollActiveIntoView(nextState)
  }

  return {
    refresh,
    findNext: () => step(1),
    findPrev: () => step(-1),
    replace() {
      const current = view.state.field(searchField).state
      if (current.activeIndex < 0) return
      const { query, replacement } = useSearchStore.getState()
      if (replacement === query) return
      const m = current.matches[current.activeIndex]
      view.dispatch({
        changes: { from: m.from, to: m.to, insert: replacement },
      })
      queueMicrotask(refresh)
    },
    replaceAll() {
      const current = view.state.field(searchField).state
      if (current.matches.length === 0) return
      const { query, replacement } = useSearchStore.getState()
      if (replacement === query) return
      const changes = current.matches.map((m) => ({
        from: m.from,
        to: m.to,
        insert: replacement,
      }))
      view.dispatch({ changes })
      queueMicrotask(refresh)
    },
    clear() {
      view.dispatch({ effects: clearSearch.of(null) })
      useSearchStore.setState({ matchCount: 0, currentMatch: 0 })
    },
  }
}
