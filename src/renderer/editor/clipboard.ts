import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { DOMSerializer, Fragment, Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { Slice } from '@tiptap/pm/model'
import { getCachedSvg } from './mermaid-renderer'
import { useEditorStore } from '../stores/editor-store'

/**
 * RichClipboard — TipTap extension for rich-text clipboard copy.
 *
 * Overrides ProseMirror's `clipboardSerializer` so that Cmd+C / Edit > Copy
 * produces HTML with **inline styles** (not CSS classes).  External apps like
 * Jira, Google Docs, Confluence, and Slack strip CSS classes but honour
 * inline styles, so this makes pasted content retain its formatting.
 *
 * Also overrides `clipboardTextSerializer` to emit clean markdown for the
 * `text/plain` clipboard slot.
 */

// ---------------------------------------------------------------------------
// Inline style map — tag name → CSS properties
// ---------------------------------------------------------------------------

const TAG_STYLES: Record<string, Record<string, string>> = {
  H1: {
    'font-size': '2em',
    'font-weight': 'bold',
    'margin': '0.67em 0',
    'line-height': '1.3',
  },
  H2: {
    'font-size': '1.5em',
    'font-weight': 'bold',
    'margin': '0.83em 0',
    'line-height': '1.3',
  },
  H3: {
    'font-size': '1.17em',
    'font-weight': 'bold',
    'margin': '1em 0',
    'line-height': '1.3',
  },
  H4: {
    'font-size': '1em',
    'font-weight': 'bold',
    'margin': '1.33em 0',
    'line-height': '1.3',
  },
  H5: {
    'font-size': '0.83em',
    'font-weight': 'bold',
    'margin': '1.67em 0',
    'line-height': '1.3',
  },
  H6: {
    'font-size': '0.67em',
    'font-weight': 'bold',
    'margin': '2.33em 0',
    'line-height': '1.3',
  },
  P: {
    'margin': '8px 0',
    'line-height': '1.6',
  },
  STRONG: { 'font-weight': 'bold' },
  B: { 'font-weight': 'bold' },
  EM: { 'font-style': 'italic' },
  I: { 'font-style': 'italic' },
  S: { 'text-decoration': 'line-through' },
  DEL: { 'text-decoration': 'line-through' },
  CODE: {
    'font-family': "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
    'background-color': '#f4f4f5',
    'padding': '2px 4px',
    'border-radius': '3px',
    'font-size': '0.9em',
  },
  PRE: {
    'font-family': "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
    'background-color': '#f4f4f5',
    'padding': '12px 16px',
    'border-radius': '6px',
    'overflow-x': 'auto',
    'white-space': 'pre',
    'font-size': '0.9em',
    'line-height': '1.5',
  },
  A: {
    'color': '#2563eb',
    'text-decoration': 'underline',
  },
  BLOCKQUOTE: {
    'border-left': '3px solid #d1d5db',
    'padding-left': '12px',
    'margin-left': '0',
    'color': '#6b7280',
  },
  TABLE: {
    'border-collapse': 'collapse',
    'width': '100%',
    'margin': '16px 0',
  },
  TH: {
    'border': '1px solid #d1d5db',
    'padding': '8px 12px',
    'font-weight': 'bold',
    'background-color': '#f9fafb',
    'text-align': 'left',
  },
  TD: {
    'border': '1px solid #d1d5db',
    'padding': '8px 12px',
    'text-align': 'left',
  },
  UL: {
    'padding-left': '24px',
    'margin': '8px 0',
    'list-style-type': 'disc',
  },
  OL: {
    'padding-left': '24px',
    'margin': '8px 0',
    'list-style-type': 'decimal',
  },
  LI: {
    'margin': '4px 0',
  },
  HR: {
    'border': 'none',
    'border-top': '1px solid #d1d5db',
    'margin': '16px 0',
  },
  IMG: {
    'max-width': '100%',
    'height': 'auto',
  },
}

// ---------------------------------------------------------------------------
// DOM walker
// ---------------------------------------------------------------------------

/**
 * Recursively apply inline styles to every element in the tree.
 *
 * Also normalises task-list items: the `<input type="checkbox">` / `<label>`
 * rendered by TipTap is replaced with a Unicode checkbox character (☑ / ☐)
 * so that external apps display the state correctly without form controls.
 */
function applyInlineStyles(element: Element): void {
  if (!(element instanceof HTMLElement)) {
    // Recurse into child elements (e.g. inside a DocumentFragment)
    for (const child of Array.from(element.children)) {
      applyInlineStyles(child)
    }
    return
  }

  // Mermaid block — substitute the cached SVG into the HTML clipboard slot.
  if (element.tagName === 'PRE') {
    const codeChild = element.querySelector(':scope > code')
    if (codeChild && codeChild.classList.contains('language-mermaid')) {
      const theme = useEditorStore.getState().resolvedTheme
      const svg = getCachedSvg(codeChild.textContent ?? '', theme)
      if (svg) {
        element.innerHTML = svg
        element.style.setProperty('background-color', 'transparent')
        element.style.setProperty('padding', '0')
        element.style.setProperty('text-align', 'center')
        return
      }
      // No cached SVG (error state or eviction) — fall through to default styling.
    }
  }

  // Apply tag-level styles
  const styles = TAG_STYLES[element.tagName]
  if (styles) {
    for (const [prop, value] of Object.entries(styles)) {
      element.style.setProperty(prop, value)
    }
  }

  // Task-list item normalisation
  if (
    element.tagName === 'LI' &&
    element.getAttribute('data-type') === 'taskItem'
  ) {
    normaliseTaskItem(element)
  }

  // Recurse into children
  for (const child of Array.from(element.children)) {
    applyInlineStyles(child)
  }
}

/**
 * Replace the TipTap checkbox `<label><input><span></label><div>…</div>`
 * structure with a simple `☑ text` or `☐ text` so external apps render it.
 */
function normaliseTaskItem(li: HTMLElement): void {
  const checked = li.getAttribute('data-checked') === 'true'

  // Remove the <label> containing the <input> checkbox
  const label = li.querySelector('label')
  if (label) {
    label.remove()
  }

  // Unwrap the <div> content wrapper — move its children directly into <li>
  const contentDiv = li.querySelector('div')
  if (contentDiv) {
    while (contentDiv.firstChild) {
      li.appendChild(contentDiv.firstChild)
    }
    contentDiv.remove()
  }

  // Prepend the checkbox character
  const prefix = document.createTextNode(checked ? '\u2611 ' : '\u2610 ')
  li.insertBefore(prefix, li.firstChild)

  // Remove bullet marker
  li.style.setProperty('list-style-type', 'none')
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export const RichClipboard = Extension.create({
  name: 'richClipboard',

  addProseMirrorPlugins() {
    const { editor } = this

    return [
      new Plugin({
        key: new PluginKey('richClipboard'),
        props: {
          // -----------------------------------------------------------
          // HTML clipboard — default serialisation + inline styles
          // -----------------------------------------------------------
          clipboardSerializer: {
            serializeFragment(
              fragment: Fragment,
              options?: { document?: Document }
            ) {
              // Use the schema's default serialiser to produce DOM nodes
              const defaultSerializer = DOMSerializer.fromSchema(
                editor.schema
              )
              const dom = defaultSerializer.serializeFragment(
                fragment,
                options
              )

              // Wrap in a temporary container so we can walk the tree
              const container = document.createElement('div')
              container.appendChild(dom)

              // Apply inline styles to every element
              applyInlineStyles(container)

              // Extract back to a DocumentFragment
              const result = document.createDocumentFragment()
              while (container.firstChild) {
                result.appendChild(container.firstChild)
              }
              return result
            },

            // Pass-through for single-node serialisation
            serializeNode(
              node: ProseMirrorNode,
              options?: { document?: Document }
            ) {
              const defaultSerializer = DOMSerializer.fromSchema(
                editor.schema
              )
              return defaultSerializer.serializeNode(node, options)
            },
          } as unknown as DOMSerializer,

          // -----------------------------------------------------------
          // Plain-text clipboard — emit markdown instead of raw text
          // -----------------------------------------------------------
          clipboardTextSerializer: (slice: Slice) => {
            const manager = editor.storage.markdown?.manager
            if (!manager) return ''

            // Build a temporary doc-level JSONContent from the slice
            const contentJson: Record<string, unknown>[] = []
            slice.content.forEach((child: ProseMirrorNode) => {
              contentJson.push(child.toJSON())
            })

            const docJson = { type: 'doc', content: contentJson }
            try {
              return manager.serialize(docJson) ?? ''
            } catch {
              return ''
            }
          },
        },
      }),
    ]
  },
})
