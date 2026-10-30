import { useEffect, useRef } from 'react'
import { Editor } from '@tiptap/react'
import { EditorView } from '@codemirror/view'
import { replaceSourceContent } from '../codemirror/setup'
import { setMarkdownContent as loadMarkdown } from '../editor/markdown-helpers'
import { useEditorStore } from '../stores/editor-store'

const SYNC_DEBOUNCE_MS = 300

/**
 * Bidirectional sync between TipTap (WYSIWYG) and CodeMirror (source).
 *
 * Rules:
 * - Only the *passive* pane receives updates (the active pane drives).
 * - Cross-pane sync is debounced to avoid performance issues during rapid typing.
 * - The `activePane` store field tracks which pane the user last focused.
 */
export function useMarkdownSync(
  editor: Editor | null,
  cmView: EditorView | null
) {
  const { markdownContent, activePane, documentVersion } = useEditorStore()
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSyncingRef = useRef(false)

  // A newly loaded document replaces the source pane's contents even when that
  // pane has focus, or typing there would overwrite the document with old text.
  useEffect(() => {
    if (cmView) {
      replaceSourceContent(cmView, useEditorStore.getState().markdownContent)
    }
  }, [documentVersion, cmView])

  // WYSIWYG → Source: when TipTap produces new markdown, push to CodeMirror
  useEffect(() => {
    if (!cmView || activePane !== 'wysiwyg' || isSyncingRef.current) return

    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current)
    }

    syncTimerRef.current = setTimeout(() => {
      isSyncingRef.current = true
      replaceSourceContent(cmView, markdownContent)
      isSyncingRef.current = false
    }, SYNC_DEBOUNCE_MS)

    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current)
      }
    }
  }, [markdownContent, cmView, activePane])

  // Source → WYSIWYG: when CodeMirror produces new markdown, push to TipTap
  useEffect(() => {
    if (!editor || activePane !== 'source' || isSyncingRef.current) return

    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current)
    }

    syncTimerRef.current = setTimeout(() => {
      isSyncingRef.current = true
      loadMarkdown(editor, markdownContent)
      isSyncingRef.current = false
    }, SYNC_DEBOUNCE_MS)

    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current)
      }
    }
  }, [markdownContent, editor, activePane])
}
