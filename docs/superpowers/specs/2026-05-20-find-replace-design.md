# Find / Replace — Design

**Status:** Approved
**Date:** 2026-05-20
**Scope:** Single-document find and find-and-replace, operating on the active editor pane (WYSIWYG or markdown source). "Recursive" in the user's original request is interpreted as Replace All (every match replaced in one pass).

## Goals

- Find text within the currently active pane (Tiptap WYSIWYG or CodeMirror source).
- Navigate forward/backward through matches.
- Replace the current match.
- Replace all matches in the active pane in a single pass (one undo step).
- Provide case-sensitive and whole-word matching options.
- Show a match counter (`current / total`).

## Non-goals (v1)

- Regex search.
- Multi-line search.
- Search across files.
- Search-in-selection only.

## UX

### Triggers

| Action | Shortcut |
|---|---|
| Open find bar (find-only) | `Cmd+F` |
| Open find bar with replace row | `Cmd+Option+F` |
| Close find bar | `Esc` |
| Next match | `Enter` (when find input focused) |
| Previous match | `Shift+Enter` (when find input focused) |

A toggle button inside the find bar switches between find-only and find-and-replace modes without leaving the bar.

### Placement

A thin bar pinned to the top of the *active* pane. Active pane is tracked via the existing `activePane` field on the editor store (already set on focus in `EditorPane` and `SourcePane`). The bar visually belongs to its pane so it is unambiguous what is being searched.

Switching panes while the bar is open closes and reopens it for the new pane to avoid stale match state.

### Layout

```
[ find input ........ ] [Aa] [\b] [3/17] [↑] [↓] [×]
[ replace input ..... ]                  [Replace] [Replace All]
```

- `Aa` — case-sensitive toggle (default off)
- `\b` — whole-word toggle (default off)
- `3/17` — current match index / total match count
- `↑` / `↓` — previous / next match
- `×` — close
- `Replace` — replace the current match, then advance to the next
- `Replace All` — replace every match in the active pane in one pass

Empty query: counter shows `0/0`; navigation and replace controls are disabled.

## Architecture

### New module: `src/renderer/search/`

| File | Purpose |
|---|---|
| `search-store.ts` | Zustand slice. Fields: `query`, `replacement`, `caseSensitive`, `wholeWord`, `isOpen`, `mode: 'find' \| 'replace'`, `matchCount`, `currentMatch`. Plus actions for each. |
| `FindBar.tsx` | Bar UI. Reads/writes the store; forwards next/prev/replace/replaceAll to the active pane's controller. |
| `tiptap-search-extension.ts` | Tiptap extension. Builds a ProseMirror `DecorationSet` from the current query over the doc's text content. Commands: `findNext`, `findPrev`, `replace`, `replaceAll`. Re-runs on doc changes or query/option changes. |
| `codemirror-search-binding.ts` | Thin adapter over `@codemirror/search`. Applies the shared query/options to a `SearchCursor`; maintains decorations via a `StateField`. |
| `search-controller.ts` | Tiny registry. Each pane registers a controller (`{ findNext, findPrev, replace, replaceAll, getCounts }`) on mount. `FindBar` calls the controller for the active pane. |

### Wiring

- `App.tsx` mounts `<FindBar />` above the Allotment split. The bar renders only when `isOpen`.
- `EditorPane` registers a Tiptap controller via the extension's commands when its editor is ready.
- `SourcePane` registers a CodeMirror controller wrapping `@codemirror/search` when its `EditorView` is ready.
- Global keydown handling for `Cmd+F` / `Cmd+Option+F` / `Esc` lives in `App.tsx`.
- CodeMirror's built-in `openSearchPanel` keymap is disabled so our bar drives the source pane.

### Tiptap search extension — behavior

- Plugin state: `{ query, options, matches: {from, to}[], activeIndex }`.
- `apply(tr, state)`: recompute matches when the doc, query, or options change. Walk the doc's text content; whole-word matching uses `\b` boundaries over the concatenated text; case-insensitive comparison lowercases both sides.
- Decorations: `Decoration.inline(from, to, { class: 'find-match' })` for all matches; the active one additionally gets `find-match-current`.
- `replace`: replace the active match's range with the replacement string via `tr.insertText`, which preserves surrounding marks. Then advance `activeIndex` to the next match (recomputed post-transaction).
- `replaceAll`: iterate matches in reverse order so earlier ranges stay valid, batch into a single transaction → one undo step.

### CodeMirror binding — behavior

- Use `SearchCursor` from `@codemirror/search` with a `normalize` fn that lowercases when case-insensitive.
- Whole-word: wrap the query in `\b` boundaries via `RegExpCursor`, or perform a post-filter on the matches (whichever is simpler in practice — both are acceptable; the implementer chooses).
- Maintain a `StateField<DecorationSet>` for highlights: `Decoration.mark({ class: 'find-match' })` for all matches; current match gets `find-match-current`.
- `replaceAll`: one `EditorView.dispatch` with a single transaction → one undo step.

### Styling

- Two new CSS classes in `app.css`:
  - `.find-match` — subtle yellow background.
  - `.find-match-current` — stronger highlight plus outline.
- Dark-mode variants under `[data-theme="dark"]`.
- `FindBar` styled to match the density of `Toolbar` and `StatusBar`.

### Dependency

- Add `@codemirror/search` (same author group as the existing CodeMirror packages).

## Edge cases

- **Doc edits while bar is open.** Matches recompute on every doc change; active match jumps to the closest remaining one (by original position), or `0/0` if none.
- **Whole-word in WYSIWYG.** Word boundaries are evaluated against the doc's plain text content (ignoring inline marks). Replacement preserves the marks at the match's boundaries by using `tr.insertText` against the range.
- **Tables, code blocks, task lists.** Searched as plain text (their text content is part of the doc's text). Replacements happen in-place; the syntax highlighter for code blocks re-runs after the transaction.
- **Multi-line find.** Out of scope. A literal `\n` typed in the input is treated as the two characters `\` and `n`; an actual newline keypress is ignored.
- **Replace with the same string as find.** No-op transaction so the document is not marked dirty.
- **Pane switch with bar open.** Bar closes and reopens for the new pane; query and options are preserved but match state is recomputed.
- **Empty query.** Counter shows `0/0`; `↑` / `↓` / `Replace` / `Replace All` are disabled.

## Testing

Manual smoke test against a fixture markdown file containing headings, paragraphs, ordered and unordered lists, a table, a fenced code block, a task list, and inline links:

1. `Cmd+F` opens the bar at the top of the active pane.
2. Typing populates the counter and highlights matches.
3. `Enter` / `Shift+Enter` cycle forward and backward; active highlight follows.
4. `Aa` toggles case sensitivity; counter and highlights update.
5. `\b` toggles whole-word matching; counter and highlights update.
6. `Cmd+Option+F` expands to replace mode; `Replace` swaps the current match and advances.
7. `Replace All` replaces every match in one pass; `Cmd+Z` restores the entire document in one undo step.
8. Steps 1–7 repeated with focus in the source pane (toggle with `Cmd+\`).
9. `Esc` closes the bar.
10. Pane switch with bar open closes and reopens it for the new pane.

No automated tests are added; the project has none today and introducing a framework is out of scope for this feature.

## Out of scope (deferred)

- Regex matching (CodeMirror has `RegExpCursor`; Tiptap side would need a regex-aware matcher).
- Multi-line search.
- Search across files (depends on the file-browser pane).
- Search within selection only.
