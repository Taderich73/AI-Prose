import { useCallback, useEffect } from 'react'
import { Editor } from '@tiptap/react'
import { getMarkdown, setMarkdownContent as loadMarkdown } from '../editor/markdown-helpers'
import { useEditorStore } from '../stores/editor-store'

export function useFileOps(editor: Editor | null) {
  const { filePath, setFilePath, setDirty, setMarkdownContent } =
    useEditorStore()

  const serializeMarkdown = useCallback((): string => {
    if (!editor) return ''
    return getMarkdown(editor)
  }, [editor])

  const handleNew = useCallback(() => {
    if (!editor) return
    editor.commands.clearContent()
    setFilePath(null)
    setMarkdownContent('')
    setDirty(false)
  }, [editor, setFilePath, setMarkdownContent, setDirty])

  const handleOpen = useCallback(async () => {
    if (!editor) return
    const result = await window.api.openFile()
    if (!result) return

    loadMarkdown(editor, result.content)
    setFilePath(result.path)
    setMarkdownContent(result.content)
    setDirty(false)
  }, [editor, setFilePath, setMarkdownContent, setDirty])

  const handleSave = useCallback(async () => {
    if (!editor) return
    const md = serializeMarkdown()

    if (filePath) {
      await window.api.saveFile(filePath, md)
      setDirty(false)
    } else {
      const result = await window.api.saveFileAs(md)
      if (result) {
        setFilePath(result.path)
        setDirty(false)
      }
    }
  }, [editor, filePath, serializeMarkdown, setFilePath, setDirty])

  const handleSaveAs = useCallback(async () => {
    if (!editor) return
    const md = serializeMarkdown()
    const result = await window.api.saveFileAs(md)
    if (result) {
      setFilePath(result.path)
      setDirty(false)
    }
  }, [editor, serializeMarkdown, setFilePath, setDirty])

  useEffect(() => {
    window.api.onMenuNew(handleNew)
    window.api.onMenuOpen(handleOpen)
    window.api.onMenuSave(handleSave)
    window.api.onMenuSaveAs(handleSaveAs)

    return () => {
      window.api.removeAllListeners('menu:new')
      window.api.removeAllListeners('menu:open')
      window.api.removeAllListeners('menu:save')
      window.api.removeAllListeners('menu:save-as')
    }
  }, [handleNew, handleOpen, handleSave, handleSaveAs])

  return { handleNew, handleOpen, handleSave, handleSaveAs }
}
