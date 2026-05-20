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
