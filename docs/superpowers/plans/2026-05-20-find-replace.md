# Find / Replace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add single-document find and find-and-replace to AI-Prose, operating on the active pane (Tiptap WYSIWYG or CodeMirror source), with case-sensitive, whole-word, match counter, and one-pass Replace All in a single undo step.

**Architecture:** A shared Zustand store holds the search query, options, and match info. A controller registry lets each pane register a small adapter (`findNext`, `findPrev`, `replace`, `replaceAll`, `refresh`, `clear`). Each pane (`EditorPane`, `SourcePane`) renders its own `<FindBar pane="…" />` instance, which only shows when the bar is open *and* that pane is the active one — so the bar visually belongs to whichever pane is focused. The Tiptap side uses a custom ProseMirror plugin with `DecorationSet` for highlights; the CodeMirror side uses `@codemirror/search`'s `RegExpCursor` with a `StateField`-backed `DecorationSet`.

**Tech Stack:** React 19, Zustand 5, Tiptap 3 (ProseMirror), CodeMirror 6, `@codemirror/search` (new), Electron 35, TypeScript 5.7.

**Testing note:** The project has no test framework today and the design spec explicitly does not add one. Verification per task is `npm run typecheck`. A final manual smoke test follows the spec's procedure.

**Spec:** `docs/superpowers/specs/2026-05-20-find-replace-design.md`

---

## File Structure

**New files:**

| Path | Responsibility |
|---|---|
| `src/renderer/search/search-store.ts` | Zustand store: query, replacement, options, match counts, open/mode state, actions. |
| `src/renderer/search/search-controller.ts` | `SearchController` interface + module-level registry indexed by `'wysiwyg' \| 'source'`. |
| `src/renderer/search/tiptap-search-extension.ts` | Tiptap extension wrapping a ProseMirror plugin: maintains matches in plugin state, exposes commands for refresh/navigate/replace, paints decorations. |
| `src/renderer/search/codemirror-search-binding.ts` | Factory that returns a CodeMirror `Extension` (StateField + StateEffects + keymap-disable) and a `SearchController` bound to a given `EditorView`. |
| `src/renderer/search/match-regex.ts` | One tiny helper: build the search `RegExp` from query/options. Shared by both panes. |
| `src/renderer/search/FindBar.tsx` | The UI bar (takes a `pane` prop). Renders only when `isOpen && activePane === pane`. Calls the controller for that pane. |

**Modified files:**

| Path | Change |
|---|---|
| `package.json` | Add `@codemirror/search` dependency. |
| `src/renderer/editor/extensions.ts` | Include `SearchExtension` in the returned extensions array. |
| `src/renderer/codemirror/setup.ts` | Include the search binding extension in `getCodeMirrorExtensions`. |
| `src/renderer/components/EditorPane.tsx` | Wrap in a `.pane-container` flex column; render `<FindBar pane="wysiwyg" />` at the top. Register a Tiptap-backed `SearchController` when the editor is ready. |
| `src/renderer/components/SourcePane.tsx` | Wrap in a `.pane-container` flex column; render `<FindBar pane="source" />` at the top. Register a CodeMirror-backed `SearchController` when the view is ready. |
| `src/renderer/App.tsx` | Wire `Cmd+F` / `Cmd+Option+F` / `Esc` global keydown handlers. (FindBar instances are mounted inside each pane.) |
| `src/renderer/app.css` | `.pane-container`, `.find-bar`, `.find-bar__input`, `.find-bar__toggle`, `.find-match`, `.find-match-current` styles (light + dark). |

---

## Task 1: Install `@codemirror/search`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

Run:
```bash
npm install @codemirror/search@^6
```
Expected: `package.json` gains `"@codemirror/search": "^6.x.x"` in `dependencies`; `package-lock.json` updates.

- [ ] **Step 2: Typecheck still passes**

Run:
```bash
npm run typecheck
```
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add @codemirror/search for find/replace"
```

---

## Task 2: Search store

**Files:**
- Create: `src/renderer/search/search-store.ts`

- [ ] **Step 1: Create the store file**

Create `src/renderer/search/search-store.ts`:

```ts
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
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/search/search-store.ts
git commit -m "feat(search): add search store"
```

---

## Task 3: Match regex helper

**Files:**
- Create: `src/renderer/search/match-regex.ts`

- [ ] **Step 1: Create the helper**

Create `src/renderer/search/match-regex.ts`:

```ts
export interface MatchOptions {
  caseSensitive: boolean
  wholeWord: boolean
}

const REGEX_META = /[.*+?^${}()|[\]\\]/g

export function escapeRegex(input: string): string {
  return input.replace(REGEX_META, '\\$&')
}

/**
 * Build a global RegExp from the user's query and options. Returns null if
 * the query is empty (callers should treat this as "no search active").
 */
export function buildSearchRegex(
  query: string,
  options: MatchOptions
): RegExp | null {
  if (!query) return null
  const escaped = escapeRegex(query)
  const pattern = options.wholeWord ? `\\b${escaped}\\b` : escaped
  const flags = options.caseSensitive ? 'g' : 'gi'
  try {
    return new RegExp(pattern, flags)
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/search/match-regex.ts
git commit -m "feat(search): add match regex helper"
```

---

## Task 4: Search controller registry

**Files:**
- Create: `src/renderer/search/search-controller.ts`

- [ ] **Step 1: Create the registry**

Create `src/renderer/search/search-controller.ts`:

```ts
import type { ActivePane } from '../stores/editor-store'

export interface SearchController {
  /** Recompute matches from the current store state and repaint decorations. */
  refresh: () => void
  /** Move active match forward (wrap to first if at end). */
  findNext: () => void
  /** Move active match backward (wrap to last if at start). */
  findPrev: () => void
  /** Replace the current active match with the store's replacement, then advance. */
  replace: () => void
  /** Replace every match in the document in a single transaction. */
  replaceAll: () => void
  /** Clear decorations and forget search state (called when the bar closes). */
  clear: () => void
}

const controllers: Record<ActivePane, SearchController | null> = {
  wysiwyg: null,
  source: null,
}

export function registerSearchController(
  pane: ActivePane,
  controller: SearchController | null
): void {
  controllers[pane] = controller
}

export function getSearchController(pane: ActivePane): SearchController | null {
  return controllers[pane]
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/search/search-controller.ts
git commit -m "feat(search): add controller registry"
```

---

## Task 5: Tiptap search extension

**Files:**
- Create: `src/renderer/search/tiptap-search-extension.ts`
- Modify: `src/renderer/editor/extensions.ts`

- [ ] **Step 1: Create the extension**

Create `src/renderer/search/tiptap-search-extension.ts`:

```ts
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
```

- [ ] **Step 2: Wire the extension into the editor**

Edit `src/renderer/editor/extensions.ts`. At the top, after the existing imports, add:

```ts
import { SearchExtension } from '../search/tiptap-search-extension'
```

In the array returned by `getExtensions`, add `SearchExtension` after `RichClipboard`:

```ts
    RichClipboard,
    SearchExtension,
  ]
```

- [ ] **Step 3: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/search/tiptap-search-extension.ts src/renderer/editor/extensions.ts
git commit -m "feat(search): add Tiptap search extension"
```

---

## Task 6: CodeMirror search binding

**Files:**
- Create: `src/renderer/search/codemirror-search-binding.ts`
- Modify: `src/renderer/codemirror/setup.ts`

- [ ] **Step 1: Create the binding**

Create `src/renderer/search/codemirror-search-binding.ts`:

```ts
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
```

- [ ] **Step 2: Wire the binding into CodeMirror setup**

Edit `src/renderer/codemirror/setup.ts`. At the top, after the existing imports, add:

```ts
import { codeMirrorSearchExtension } from '../search/codemirror-search-binding'
```

In `getCodeMirrorExtensions`, add `codeMirrorSearchExtension()` to the returned array, after `syntaxHighlighting(defaultHighlightStyle)`:

```ts
    syntaxHighlighting(defaultHighlightStyle),
    codeMirrorSearchExtension(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
```

- [ ] **Step 3: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/search/codemirror-search-binding.ts src/renderer/codemirror/setup.ts
git commit -m "feat(search): add CodeMirror search binding"
```

---

## Task 7: FindBar component and styles

**Files:**
- Create: `src/renderer/search/FindBar.tsx`
- Modify: `src/renderer/app.css`

- [ ] **Step 1: Create the component**

Create `src/renderer/search/FindBar.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import { useEditorStore, type ActivePane } from '../stores/editor-store'
import { useSearchStore } from './search-store'
import { getSearchController } from './search-controller'

interface FindBarProps {
  pane: ActivePane
}

export function FindBar({ pane }: FindBarProps) {
  const {
    isOpen,
    mode,
    query,
    replacement,
    caseSensitive,
    wholeWord,
    matchCount,
    currentMatch,
    setQuery,
    setReplacement,
    setMode,
    toggleCaseSensitive,
    toggleWholeWord,
    close,
  } = useSearchStore()
  const activePane = useEditorStore((s) => s.activePane)
  const findInputRef = useRef<HTMLInputElement>(null)

  const isActive = isOpen && activePane === pane

  // Refresh matches when this bar becomes active or query/options change.
  useEffect(() => {
    if (!isActive) return
    const ctrl = getSearchController(pane)
    ctrl?.refresh()
  }, [isActive, query, caseSensitive, wholeWord, pane])

  // Focus the find input when this bar becomes active or mode changes.
  useEffect(() => {
    if (isActive) findInputRef.current?.select()
  }, [isActive, mode])

  // Clear this pane's decorations when the bar deactivates
  // (closed entirely, or the user switched to the other pane).
  useEffect(() => {
    if (isActive) return
    const ctrl = getSearchController(pane)
    ctrl?.clear()
  }, [isActive, pane])

  if (!isActive) return null

  const ctrl = () => getSearchController(pane)
  const onFindKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) ctrl()?.findPrev()
      else ctrl()?.findNext()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    }
  }
  const onReplaceKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    }
  }

  const counter = matchCount === 0 ? '0/0' : `${currentMatch}/${matchCount}`
  const disabled = matchCount === 0

  return (
    <div className="find-bar" role="search" aria-label="Find in document">
      <div className="find-bar__row">
        <input
          ref={findInputRef}
          className="find-bar__input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onFindKey}
          placeholder="Find"
          aria-label="Find"
        />
        <button
          className={`find-bar__toggle ${caseSensitive ? 'is-on' : ''}`}
          onClick={toggleCaseSensitive}
          title="Match case"
          aria-pressed={caseSensitive}
        >
          Aa
        </button>
        <button
          className={`find-bar__toggle ${wholeWord ? 'is-on' : ''}`}
          onClick={toggleWholeWord}
          title="Whole word"
          aria-pressed={wholeWord}
        >
          \b
        </button>
        <span className="find-bar__counter" aria-live="polite">{counter}</span>
        <button
          className="find-bar__btn"
          onClick={() => ctrl()?.findPrev()}
          disabled={disabled}
          title="Previous match"
        >
          ↑
        </button>
        <button
          className="find-bar__btn"
          onClick={() => ctrl()?.findNext()}
          disabled={disabled}
          title="Next match"
        >
          ↓
        </button>
        <button
          className="find-bar__btn"
          onClick={() => setMode(mode === 'find' ? 'replace' : 'find')}
          title={mode === 'find' ? 'Show replace' : 'Hide replace'}
          aria-pressed={mode === 'replace'}
        >
          {mode === 'find' ? '↧' : '↥'}
        </button>
        <button
          className="find-bar__btn"
          onClick={close}
          title="Close"
          aria-label="Close find bar"
        >
          ×
        </button>
      </div>
      {mode === 'replace' && (
        <div className="find-bar__row">
          <input
            className="find-bar__input"
            type="text"
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={onReplaceKey}
            placeholder="Replace"
            aria-label="Replace"
          />
          <button
            className="find-bar__btn"
            onClick={() => ctrl()?.replace()}
            disabled={disabled}
          >
            Replace
          </button>
          <button
            className="find-bar__btn"
            onClick={() => ctrl()?.replaceAll()}
            disabled={disabled}
          >
            Replace All
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add the styles**

Append to `src/renderer/app.css`:

```css
/* Pane wrapper that hosts a FindBar above the editor */
.pane-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.pane-container > .editor-pane,
.pane-container > .source-pane {
  flex: 1;
  height: auto;
  min-height: 0;
}

/* Find/Replace bar */
.find-bar {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 8px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  font-size: 13px;
  flex-shrink: 0;
}
.find-bar__row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.find-bar__input {
  flex: 1 1 auto;
  min-width: 0;
  padding: 4px 6px;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
}
.find-bar__input:focus {
  border-color: var(--accent-color);
}
.find-bar__toggle,
.find-bar__btn {
  padding: 3px 8px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
}
.find-bar__toggle:hover,
.find-bar__btn:hover:not(:disabled) {
  background: var(--button-hover);
}
.find-bar__toggle.is-on {
  background: var(--accent-color);
  color: #fff;
}
.find-bar__btn:disabled {
  opacity: 0.4;
  cursor: default;
}
.find-bar__counter {
  min-width: 44px;
  text-align: center;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

/* Match highlights (apply in both Tiptap and CodeMirror) */
.find-match {
  background: rgba(255, 213, 79, 0.55);
  border-radius: 2px;
}
.find-match-current {
  background: rgba(255, 167, 38, 0.85);
  outline: 1px solid rgba(230, 126, 0, 0.9);
}

[data-theme="dark"] .find-match {
  background: rgba(255, 213, 79, 0.25);
}
[data-theme="dark"] .find-match-current {
  background: rgba(255, 167, 38, 0.55);
  outline-color: rgba(255, 167, 38, 0.8);
}
```

- [ ] **Step 3: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/search/FindBar.tsx src/renderer/app.css
git commit -m "feat(search): add FindBar component and styles"
```

---

## Task 8: Register Tiptap controller from EditorPane

**Files:**
- Modify: `src/renderer/components/EditorPane.tsx`

- [ ] **Step 1: Add the controller registration and FindBar**

Edit `src/renderer/components/EditorPane.tsx`. Replace the entire file with:

```tsx
import { useEditor, EditorContent } from '@tiptap/react'
import { useEffect } from 'react'
import { getExtensions } from '../editor/extensions'
import { getMarkdown } from '../editor/markdown-helpers'
import { useEditorStore } from '../stores/editor-store'
import {
  registerSearchController,
  type SearchController,
} from '../search/search-controller'
import { useSearchStore } from '../search/search-store'
import { FindBar } from '../search/FindBar'

interface EditorPaneProps {
  onEditorReady: (editor: ReturnType<typeof useEditor>) => void
}

export function EditorPane({ onEditorReady }: EditorPaneProps) {
  const { setMarkdownContent, setDirty, setActivePane } = useEditorStore()

  const editor = useEditor({
    extensions: getExtensions(),
    content: '',
    onUpdate: ({ editor }) => {
      setMarkdownContent(getMarkdown(editor))
      setDirty(true)
      // Recompute matches after content edits if search is open.
      if (useSearchStore.getState().isOpen) {
        editor.commands.searchRefresh()
      }
    },
    onFocus: () => {
      setActivePane('wysiwyg')
    },
  })

  useEffect(() => {
    onEditorReady(editor)
  }, [editor, onEditorReady])

  // Register the search controller for this pane.
  useEffect(() => {
    if (!editor) return
    const controller: SearchController = {
      refresh: () => {
        editor.commands.searchRefresh()
      },
      findNext: () => {
        editor.commands.searchFindNext()
      },
      findPrev: () => {
        editor.commands.searchFindPrev()
      },
      replace: () => {
        editor.commands.searchReplaceCurrent()
      },
      replaceAll: () => {
        editor.commands.searchReplaceAll()
      },
      clear: () => {
        editor.commands.searchClear()
      },
    }
    registerSearchController('wysiwyg', controller)
    return () => {
      registerSearchController('wysiwyg', null)
    }
  }, [editor])

  return (
    <div className="pane-container">
      <FindBar pane="wysiwyg" />
      <div className="editor-pane">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/EditorPane.tsx
git commit -m "feat(search): register Tiptap search controller"
```

---

## Task 9: Register CodeMirror controller from SourcePane

**Files:**
- Modify: `src/renderer/components/SourcePane.tsx`

- [ ] **Step 1: Add the controller registration and FindBar**

Edit `src/renderer/components/SourcePane.tsx`. Replace the entire file with:

```tsx
import { useRef, useEffect, useCallback } from 'react'
import { EditorView } from '@codemirror/view'
import { getCodeMirrorExtensions, createEditorState } from '../codemirror/setup'
import { useEditorStore } from '../stores/editor-store'
import {
  registerSearchController,
} from '../search/search-controller'
import { createCodeMirrorSearchController } from '../search/codemirror-search-binding'
import { useSearchStore } from '../search/search-store'
import { FindBar } from '../search/FindBar'

interface SourcePaneProps {
  onViewReady: (view: EditorView | null) => void
}

export function SourcePane({ onViewReady }: SourcePaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const { markdownContent, setMarkdownContent, setDirty, setActivePane, resolvedTheme } =
    useEditorStore()

  const handleUpdate = useCallback(
    (content: string) => {
      setMarkdownContent(content)
      setDirty(true)
      // Recompute matches after content edits if search is open.
      if (useSearchStore.getState().isOpen && viewRef.current) {
        const ctrl = createCodeMirrorSearchController(viewRef.current)
        ctrl.refresh()
      }
    },
    [setMarkdownContent, setDirty]
  )

  const handleFocus = useCallback(() => {
    setActivePane('source')
  }, [setActivePane])

  // Create CodeMirror on mount and recreate on theme change
  useEffect(() => {
    if (!containerRef.current) return

    const isDark = resolvedTheme === 'dark'
    const currentContent = viewRef.current
      ? viewRef.current.state.doc.toString()
      : markdownContent

    const extensions = getCodeMirrorExtensions(handleUpdate, handleFocus, isDark)
    const state = createEditorState(currentContent, extensions)

    const view = new EditorView({
      state,
      parent: containerRef.current,
    })

    viewRef.current = view
    onViewReady(view)

    const controller = createCodeMirrorSearchController(view)
    registerSearchController('source', controller)

    return () => {
      registerSearchController('source', null)
      view.destroy()
      viewRef.current = null
      onViewReady(null)
    }
    // Recreate when theme changes. Content sync is handled by the sync hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTheme])

  return (
    <div className="pane-container">
      <FindBar pane="source" />
      <div ref={containerRef} className="source-pane" />
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/SourcePane.tsx
git commit -m "feat(search): register CodeMirror search controller"
```

---

## Task 10: Global shortcuts in App

**Files:**
- Modify: `src/renderer/App.tsx`

The FindBar itself is mounted inside each pane (Tasks 8 and 9). This task only adds the global keyboard handler for `Cmd+F`, `Cmd+Option+F`, and `Esc`.

- [ ] **Step 1: Add the search store import**

In `src/renderer/App.tsx`, after the existing imports, add:

```ts
import { useSearchStore } from './search/search-store'
```

- [ ] **Step 2: Add a global keydown effect**

Inside the `App` component, after the other `useEffect` calls (after the theme effect), add:

```ts
  // Global shortcuts for find / find-and-replace.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (e.key === 'Escape' && useSearchStore.getState().isOpen) {
        useSearchStore.getState().close()
        return
      }
      if (!meta) return
      if (e.key === 'f' && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        useSearchStore.getState().open('find')
      } else if (e.key === 'f' && e.altKey) {
        e.preventDefault()
        useSearchStore.getState().open('replace')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
```

- [ ] **Step 3: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat(search): wire global Cmd+F / Cmd+Opt+F / Esc shortcuts"
```

---

## Task 11: Manual smoke test

**Files:** none (verification only).

Prepare a fresh fixture file `test.md` if not already present:

```markdown
# Sample document

This is a paragraph with the word foo. Foo appears here. FOO appears here too.
food is similar but not the same word.

- list item with foo
- another item with foo
- code: `foo()`

| col | value |
|-----|-------|
| foo | bar   |

```code
function foo() { return foo }
```

- [ ] task with foo
- [ ] another task with food
```

- [ ] **Step 1: Build and launch**

Run:
```bash
npm run dev
```
Expected: app launches without console errors.

- [ ] **Step 2: Open the fixture**

Open `test.md` (Cmd+O). Confirm content loads in the WYSIWYG pane.

- [ ] **Step 3: Verify WYSIWYG find**

Click into the WYSIWYG pane to focus it, then press `Cmd+F`. Expected: bar appears at the top of the WYSIWYG pane (not above the source pane); find input is focused.
Type `foo`. Expected: highlights appear on every occurrence of "foo" *and* "Foo" *and* "FOO" *and* the "foo" inside "food"; counter shows `1/N` where N is the total match count.

- [ ] **Step 4: Verify navigation**

Press `Enter` repeatedly. Active highlight advances; counter updates `2/N`, `3/N`, … wraps back to `1/N`.
Press `Shift+Enter`. Active highlight steps back; counter decreases.

- [ ] **Step 5: Verify case-sensitive**

Click `Aa` toggle. Expected: matches now only include lowercase `foo` (excluding `Foo` and `FOO`). Counter updates. Click `Aa` again to disable.

- [ ] **Step 6: Verify whole-word**

Click `\b` toggle. Expected: matches no longer include the "foo" inside "food" (since "food" is one word). Counter updates. Click `\b` again to disable.

- [ ] **Step 7: Verify replace and replace-all**

Press `Cmd+Option+F`. Replace row appears. Type `bar` in the replace input. Click `Replace`. Expected: the current active match becomes `bar`; the search jumps to the next match.
Click `Replace All`. Expected: every remaining `foo` (under current options) becomes `bar` in one step.
Press `Cmd+Z`. Expected: a single undo restores the entire document.

- [ ] **Step 8: Verify source-pane behavior**

Press `Cmd+\` to show the source pane. Click into the source pane to focus it (status: `activePane` becomes `source`). Close any open bar with `Esc`, then press `Cmd+F` again. Expected: the bar now operates on the source pane — typing `bar` highlights matches in the markdown source. Repeat steps 4–7 against the source pane.

- [ ] **Step 9: Verify Esc closes**

Press `Esc`. Bar disappears; highlights clear in both panes.

- [ ] **Step 10: Verify pane-switch behavior**

With both panes visible (`Cmd+\` toggles the source pane), open the bar in the WYSIWYG pane (`Cmd+F` while focused there). Then click into the source pane. Expected: the bar visibly moves — the WYSIWYG instance disappears and the source-pane instance appears at the top of the source pane with the same query, options, and replacement preserved (held in the shared store). Highlights in the previous pane are cleared and matches in the new pane are computed. Switch back to the WYSIWYG pane; the bar follows again.

- [ ] **Step 11: Commit any tweaks**

If any styling, label, or shortcut adjustments were needed during smoke test, commit them:

```bash
git add -A
git commit -m "fix(search): smoke-test adjustments"
```

If no changes were needed, skip this step.

---

## Self-Review Notes

- Spec coverage: triggers Cmd+F / Cmd+Opt+F / Esc / Enter / Shift+Enter (T10 globals + T7 input handlers); placement pinned to active pane (T8/T9 mount FindBar inside each pane + T7 active-only render); layout (T7); case-sensitive and whole-word (T3 helper + T7 UI + T5/T6 consumers); counter (T7 + controllers' `syncCount`/`setState`); Replace All as one undo (T5 single transaction, T6 single `dispatch({changes})`); pane-switch behavior (T7 FindBar unmounts old pane → cleanup calls `clear` → new pane FindBar mounts → effect calls `refresh`); edge cases: empty query (`buildSearchRegex` returns null → 0 matches), no-op when replacement equals query (T5 and T6 short-circuit), doc edits while open (`onUpdate` calls `searchRefresh` in T8 / `controller.refresh` in T9); `@codemirror/search` dep (T1). All covered.
- Type consistency: `SearchController` interface defined in T4 and consumed identically in T8 (Tiptap) and T9 (CodeMirror via `createCodeMirrorSearchController`). `ActivePane` type imported from existing editor store in T4 and used as the `pane` prop in T7 and as the controller registry key. Search store action names match across the FindBar consumer (T7) and the controllers (T5/T6).
- No placeholders; every code step contains complete code or an exact edit instruction.
