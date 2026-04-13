import { Editor } from '@tiptap/react'

/**
 * Serialize the current TipTap document to a markdown string.
 *
 * IMPORTANT: `manager.serialize()` expects `JSONContent` (plain JSON with
 * `type` as a string), NOT a ProseMirror `Node`.  Use `editor.getJSON()`
 * — this matches the canonical `editor.getMarkdown()` added by the
 * `@tiptap/markdown` extension itself.
 */
export function getMarkdown(editor: Editor): string {
  const manager = editor.storage.markdown?.manager
  if (!manager) return ''
  return manager.serialize(editor.getJSON()) ?? ''
}

/**
 * Parse a markdown string to a ProseMirror-compatible JSON document,
 * then load it into the editor **without** triggering `onUpdate`.
 *
 * `emitUpdate: false` prevents the editor's `onUpdate` callback from firing,
 * which avoids sync loops when this function is called by the cross-pane
 * sync hook or during file-open.
 */
export function setMarkdownContent(editor: Editor, markdown: string): void {
  const manager = editor.storage.markdown?.manager
  if (!manager) {
    editor.commands.setContent(markdown, { emitUpdate: false })
    return
  }
  const doc = manager.parse(markdown)
  editor.commands.setContent(doc, { emitUpdate: false })
}
