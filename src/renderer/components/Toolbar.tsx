import { useState, useCallback } from 'react'
import { Editor } from '@tiptap/react'

interface ToolbarProps {
  editor: Editor | null
  onNew?: () => void
  onOpenFolder?: () => void
  onSave?: () => void
  onRefresh?: () => void
}

export function Toolbar({ editor, onNew, onOpenFolder, onSave, onRefresh }: ToolbarProps) {
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [showTableDialog, setShowTableDialog] = useState(false)
  const [tableRows, setTableRows] = useState('3')
  const [tableCols, setTableCols] = useState('3')
  const [showImageDialog, setShowImageDialog] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [imageAlt, setImageAlt] = useState('')

  const insertLink = useCallback(() => {
    if (!editor || !linkUrl) return
    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: linkUrl })
      .run()
    setLinkUrl('')
    setShowLinkDialog(false)
  }, [editor, linkUrl])

  const removeLink = useCallback(() => {
    if (!editor) return
    editor.chain().focus().unsetLink().run()
    setShowLinkDialog(false)
  }, [editor])

  const openLinkDialog = useCallback(() => {
    if (!editor) return
    const existing = editor.getAttributes('link').href || ''
    setLinkUrl(existing)
    setShowLinkDialog(true)
  }, [editor])

  const insertTable = useCallback(() => {
    if (!editor) return
    const rows = parseInt(tableRows) || 3
    const cols = parseInt(tableCols) || 3
    editor
      .chain()
      .focus()
      .insertTable({ rows, cols, withHeaderRow: true })
      .run()
    setShowTableDialog(false)
  }, [editor, tableRows, tableCols])

  const insertImage = useCallback(() => {
    if (!editor || !imageUrl) return
    editor.chain().focus().setImage({ src: imageUrl, alt: imageAlt }).run()
    setImageUrl('')
    setImageAlt('')
    setShowImageDialog(false)
  }, [editor, imageUrl, imageAlt])

  if (!editor) return null

  return (
    <div className="toolbar">
      {/* File operations */}
      <button onClick={onNew} title="New (Cmd+N)">
        &#128196;
      </button>
      <button onClick={onOpenFolder} title="Open Folder">
        &#128194;
      </button>
      <button onClick={onSave} title="Save (Cmd+S)">
        &#128190;
      </button>
      <button onClick={onRefresh} title="Refresh folder contents">
        &#128260;
      </button>

      <span className="toolbar-separator" />

      {/* Text formatting */}
      <ToolbarButton
        editor={editor}
        action="bold"
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (Cmd+B)"
        label={<strong>B</strong>}
      />
      <ToolbarButton
        editor={editor}
        action="italic"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (Cmd+I)"
        label={<em>I</em>}
      />
      <ToolbarButton
        editor={editor}
        action="strike"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough (Cmd+Shift+S)"
        label={<s>S</s>}
      />
      <ToolbarButton
        editor={editor}
        action="code"
        onClick={() => editor.chain().focus().toggleCode().run()}
        title="Inline Code (Cmd+E)"
        label={<span className="toolbar-mono">{'{}'}</span>}
      />

      <span className="toolbar-separator" />

      {/* Headings */}
      <HeadingDropdown editor={editor} />

      <span className="toolbar-separator" />

      {/* Lists */}
      <ToolbarButton
        editor={editor}
        action="bulletList"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet List"
        label={<span>&#8226;</span>}
      />
      <ToolbarButton
        editor={editor}
        action="orderedList"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Numbered List"
        label={<span>1.</span>}
      />
      <ToolbarButton
        editor={editor}
        action="taskList"
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        title="Task List"
        label={<span>&#9744;</span>}
      />

      <span className="toolbar-separator" />

      {/* Block elements */}
      <ToolbarButton
        editor={editor}
        action="blockquote"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Blockquote"
        label={<span>&ldquo;</span>}
      />
      <ToolbarButton
        editor={editor}
        action="codeBlock"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        title="Code Block"
        label={<span className="toolbar-mono">{'</>'}</span>}
      />
      <button
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal Rule"
      >
        &mdash;
      </button>

      <span className="toolbar-separator" />

      {/* Insert elements */}
      <button
        className={editor.isActive('link') ? 'active' : ''}
        onClick={openLinkDialog}
        title="Insert Link (Cmd+K)"
      >
        &#128279;
      </button>
      <button
        onClick={() => setShowImageDialog(true)}
        title="Insert Image"
      >
        &#128444;
      </button>
      <button
        onClick={() => setShowTableDialog(true)}
        title="Insert Table"
      >
        &#9638;
      </button>

      {/* Table operations (visible when inside a table) */}
      {editor.isActive('table') && (
        <>
          <span className="toolbar-separator" />
          <button
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            title="Add Column"
          >
            +C
          </button>
          <button
            onClick={() => editor.chain().focus().addRowAfter().run()}
            title="Add Row"
          >
            +R
          </button>
          <button
            onClick={() => editor.chain().focus().deleteColumn().run()}
            title="Delete Column"
          >
            -C
          </button>
          <button
            onClick={() => editor.chain().focus().deleteRow().run()}
            title="Delete Row"
          >
            -R
          </button>
          <button
            onClick={() => editor.chain().focus().deleteTable().run()}
            title="Delete Table"
            className="toolbar-danger"
          >
            &#10005;T
          </button>
        </>
      )}

      {/* Link dialog */}
      {showLinkDialog && (
        <Dialog onClose={() => setShowLinkDialog(false)} title="Link">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.com"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && insertLink()}
          />
          <div className="dialog-actions">
            <button onClick={insertLink} className="dialog-primary">
              {editor.isActive('link') ? 'Update' : 'Insert'}
            </button>
            {editor.isActive('link') && (
              <button onClick={removeLink} className="dialog-danger">
                Remove
              </button>
            )}
            <button onClick={() => setShowLinkDialog(false)}>Cancel</button>
          </div>
        </Dialog>
      )}

      {/* Image dialog */}
      {showImageDialog && (
        <Dialog onClose={() => setShowImageDialog(false)} title="Image">
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://example.com/image.png"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && insertImage()}
          />
          <input
            type="text"
            value={imageAlt}
            onChange={(e) => setImageAlt(e.target.value)}
            placeholder="Alt text (optional)"
            onKeyDown={(e) => e.key === 'Enter' && insertImage()}
          />
          <div className="dialog-actions">
            <button onClick={insertImage} className="dialog-primary">
              Insert
            </button>
            <button onClick={() => setShowImageDialog(false)}>Cancel</button>
          </div>
        </Dialog>
      )}

      {/* Table dialog */}
      {showTableDialog && (
        <Dialog onClose={() => setShowTableDialog(false)} title="Table">
          <div className="dialog-row">
            <label>
              Rows
              <input
                type="number"
                value={tableRows}
                onChange={(e) => setTableRows(e.target.value)}
                min="1"
                max="20"
              />
            </label>
            <label>
              Columns
              <input
                type="number"
                value={tableCols}
                onChange={(e) => setTableCols(e.target.value)}
                min="1"
                max="10"
              />
            </label>
          </div>
          <div className="dialog-actions">
            <button onClick={insertTable} className="dialog-primary">
              Insert
            </button>
            <button onClick={() => setShowTableDialog(false)}>Cancel</button>
          </div>
        </Dialog>
      )}
    </div>
  )
}

/* --- Sub-components --- */

interface ToolbarButtonProps {
  editor: Editor
  action: string
  onClick: () => void
  title: string
  label: React.ReactNode
}

function ToolbarButton({ editor, action, onClick, title, label }: ToolbarButtonProps) {
  return (
    <button
      className={editor.isActive(action) ? 'active' : ''}
      onClick={onClick}
      title={title}
    >
      {label}
    </button>
  )
}

function HeadingDropdown({ editor }: { editor: Editor }) {
  const activeLevel = ([1, 2, 3, 4, 5, 6] as const).find((l) =>
    editor.isActive('heading', { level: l })
  )

  return (
    <select
      className="toolbar-select"
      value={activeLevel ?? 0}
      onChange={(e) => {
        const level = parseInt(e.target.value)
        if (level === 0) {
          editor.chain().focus().setParagraph().run()
        } else {
          editor
            .chain()
            .focus()
            .toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 })
            .run()
        }
      }}
    >
      <option value={0}>Paragraph</option>
      <option value={1}>Heading 1</option>
      <option value={2}>Heading 2</option>
      <option value={3}>Heading 3</option>
      <option value={4}>Heading 4</option>
      <option value={5}>Heading 5</option>
      <option value={6}>Heading 6</option>
    </select>
  )
}

interface DialogProps {
  onClose: () => void
  title: string
  children: React.ReactNode
}

function Dialog({ onClose, title, children }: DialogProps) {
  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">{title}</div>
        <div className="dialog-body">{children}</div>
      </div>
    </div>
  )
}
