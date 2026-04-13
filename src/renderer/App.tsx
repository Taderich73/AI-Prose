import { useState, useCallback, useEffect } from 'react'
import { Editor } from '@tiptap/react'
import { EditorView } from '@codemirror/view'
import { Allotment } from 'allotment'
import 'allotment/dist/style.css'
import { Toolbar } from './components/Toolbar'
import { EditorPane } from './components/EditorPane'
import { SourcePane } from './components/SourcePane'
import { StatusBar } from './components/StatusBar'
import { FileBrowser } from './components/FileBrowser'
import { SavePrompt } from './components/SavePrompt'
import { useFileOps } from './hooks/useFileOps'
import { useMarkdownSync } from './hooks/useMarkdownSync'
import { setMarkdownContent as loadMarkdown } from './editor/markdown-helpers'
import { useEditorStore } from './stores/editor-store'
import './app.css'

export default function App() {
  const [editor, setEditor] = useState<Editor | null>(null)
  const [cmView, setCmView] = useState<EditorView | null>(null)
  const {
    filePath, isDirty, showSourcePane, showFileBrowser,
    toggleSourcePane, toggleFileBrowser,
    theme, setResolvedTheme, cycleTheme,
  } = useEditorStore()

  const handleEditorReady = useCallback((ed: Editor | null) => {
    setEditor(ed)
  }, [])

  const handleCmViewReady = useCallback((view: EditorView | null) => {
    setCmView(view)
  }, [])

  const { handleNew, handleOpen, handleSave } = useFileOps(editor)
  useMarkdownSync(editor, cmView)

  const [pendingFilePath, setPendingFilePath] = useState<string | null>(null)

  const openFileByPath = useCallback(
    async (targetPath: string) => {
      if (!editor) return
      const result = await window.api.openFilePath(targetPath)
      loadMarkdown(editor, result.content)
      useEditorStore.getState().setFilePath(result.path)
      useEditorStore.getState().setMarkdownContent(result.content)
      useEditorStore.getState().setDirty(false)
    },
    [editor]
  )

  const handleBrowserOpenFile = useCallback(
    (targetPath: string) => {
      if (isDirty) {
        setPendingFilePath(targetPath)
      } else {
        openFileByPath(targetPath)
      }
    },
    [isDirty, openFileByPath]
  )

  const handleSavePromptSave = useCallback(async () => {
    await handleSave()
    if (pendingFilePath) {
      await openFileByPath(pendingFilePath)
      setPendingFilePath(null)
    }
  }, [handleSave, pendingFilePath, openFileByPath])

  const handleSavePromptDontSave = useCallback(() => {
    if (pendingFilePath) {
      useEditorStore.getState().setDirty(false)
      openFileByPath(pendingFilePath)
      setPendingFilePath(null)
    }
  }, [pendingFilePath, openFileByPath])

  const handleSavePromptCancel = useCallback(() => {
    setPendingFilePath(null)
  }, [])

  useEffect(() => {
    window.api.onMenuToggleSource(toggleSourcePane)
    return () => {
      window.api.removeAllListeners('menu:toggle-source')
    }
  }, [toggleSourcePane])

  useEffect(() => {
    window.api.onMenuToggleFileBrowser(toggleFileBrowser)
    return () => {
      window.api.removeAllListeners('menu:toggle-file-browser')
    }
  }, [toggleFileBrowser])

  useEffect(() => {
    window.api.onMenuToggleDarkMode(cycleTheme)
    return () => {
      window.api.removeAllListeners('menu:toggle-dark-mode')
    }
  }, [cycleTheme])

  // Theme: resolve preference → actual theme, sync to DOM
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    function resolve() {
      const preference = useEditorStore.getState().theme
      const isDark =
        preference === 'dark' || (preference === 'system' && mediaQuery.matches)
      const resolved = isDark ? 'dark' : 'light'
      document.documentElement.setAttribute('data-theme', resolved)
      setResolvedTheme(resolved)
    }

    resolve()
    mediaQuery.addEventListener('change', resolve)
    return () => mediaQuery.removeEventListener('change', resolve)
  }, [theme, setResolvedTheme])

  // Window title
  const fileName = filePath ? filePath.split('/').pop() : 'Untitled'
  const title = `${isDirty ? '* ' : ''}${fileName} — AI-Prose`
  if (document.title !== title) {
    document.title = title
  }

  return (
    <div className="app">
      <Toolbar editor={editor} onNew={handleNew} onOpen={handleOpen} onSave={handleSave} />
      <div className="editor-container">
        <Allotment>
          {showFileBrowser && (
            <Allotment.Pane preferredSize={220} minSize={150} maxSize={400}>
              <FileBrowser onOpenFile={handleBrowserOpenFile} />
            </Allotment.Pane>
          )}
          <Allotment.Pane>
            <Allotment defaultSizes={[60, 40]}>
              <Allotment.Pane minSize={300}>
                <EditorPane onEditorReady={handleEditorReady} />
              </Allotment.Pane>
              {showSourcePane && (
                <Allotment.Pane minSize={250}>
                  <SourcePane onViewReady={handleCmViewReady} />
                </Allotment.Pane>
              )}
            </Allotment>
          </Allotment.Pane>
        </Allotment>
      </div>
      <StatusBar />
      {pendingFilePath && (
        <SavePrompt
          fileName={filePath ? filePath.split('/').pop()! : 'Untitled'}
          onSave={handleSavePromptSave}
          onDontSave={handleSavePromptDontSave}
          onCancel={handleSavePromptCancel}
        />
      )}
    </div>
  )
}
