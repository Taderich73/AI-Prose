import { EditorState, Extension } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'

const baseTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '14px',
    fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
  },
  '.cm-content': {
    padding: '16px 0',
    lineHeight: '1.6',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    borderRight: '1px solid var(--border-color)',
    color: 'var(--text-secondary)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
  },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: 'var(--accent-color)',
  },
  '&.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
})

export function getCodeMirrorExtensions(
  onUpdate: (content: string) => void,
  onFocus: () => void,
  isDark: boolean
): Extension[] {
  return [
    baseTheme,
    ...(isDark ? [oneDark] : []),
    lineNumbers(),
    highlightActiveLine(),
    history(),
    markdown(),
    syntaxHighlighting(defaultHighlightStyle),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onUpdate(update.state.doc.toString())
      }
      if (update.focusChanged && update.view.hasFocus) {
        onFocus()
      }
    }),
  ]
}

export function createEditorState(
  content: string,
  extensions: Extension[]
): EditorState {
  return EditorState.create({
    doc: content,
    extensions,
  })
}
