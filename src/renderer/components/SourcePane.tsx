import { useRef, useEffect, useCallback } from 'react'
import { EditorView } from '@codemirror/view'
import { getCodeMirrorExtensions, createEditorState } from '../codemirror/setup'
import { useEditorStore } from '../stores/editor-store'
import {
  registerSearchController,
  getSearchController,
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
      if (useSearchStore.getState().isOpen) {
        getSearchController('source')?.refresh()
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
