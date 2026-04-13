import { useEditor, EditorContent } from '@tiptap/react'
import { useEffect } from 'react'
import { getExtensions } from '../editor/extensions'
import { getMarkdown } from '../editor/markdown-helpers'
import { useEditorStore } from '../stores/editor-store'

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
    },
    onFocus: () => {
      setActivePane('wysiwyg')
    },
  })

  useEffect(() => {
    onEditorReady(editor)
  }, [editor, onEditorReady])

  return (
    <div className="editor-pane">
      <EditorContent editor={editor} />
    </div>
  )
}
