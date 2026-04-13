import { useEditorStore } from '../stores/editor-store'

export function StatusBar() {
  const { filePath, isDirty, theme, resolvedTheme, cycleTheme } = useEditorStore()

  const fileName = filePath
    ? filePath.split('/').pop()
    : 'Untitled'

  const themeLabel =
    theme === 'system' ? 'System' : theme === 'light' ? 'Light' : 'Dark'

  return (
    <div className="status-bar">
      <span className="status-file">
        {fileName}
        {isDirty ? ' *' : ''}
      </span>
      <button
        className="status-theme-toggle"
        onClick={cycleTheme}
        title={`Theme: ${themeLabel}`}
      >
        {resolvedTheme === 'dark' ? '☀' : '🌙'}
      </button>
    </div>
  )
}
