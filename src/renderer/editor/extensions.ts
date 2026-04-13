import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from '@tiptap/markdown'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { Link } from '@tiptap/extension-link'
import { Image } from '@tiptap/extension-image'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import { RichClipboard } from './clipboard'

const lowlight = createLowlight(common)

export function getExtensions() {
  return [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3, 4, 5, 6],
      },
      codeBlock: false,
    }),
    Markdown.configure({
      transformPastedText: true,
      transformCopiedText: false,
    }),
    CodeBlockLowlight.configure({
      lowlight,
    }),
    Table.configure({
      resizable: true,
    }),
    TableRow,
    TableCell,
    TableHeader,
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        rel: 'noopener noreferrer',
        target: null,
      },
    }),
    Image.configure({
      inline: false,
      allowBase64: true,
    }),
    Placeholder.configure({
      placeholder: 'Start writing...',
    }),
    RichClipboard,
  ]
}
