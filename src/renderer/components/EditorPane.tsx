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
