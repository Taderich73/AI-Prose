import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import type { Node as PMNode } from '@tiptap/pm/model'
import { useEditorStore } from '../stores/editor-store'
import {
  renderMermaid,
} from './mermaid-renderer'

const RENDER_DEBOUNCE_MS = 250
const lowlight = createLowlight(common)

interface NodeViewConstructorProps {
  node: PMNode
}

interface PassthroughView {
  dom: HTMLElement
  contentDOM: HTMLElement
}

function buildPassthroughCodeBlock(node: PMNode): PassthroughView {
  const pre = document.createElement('pre')
  const code = document.createElement('code')
  if (node.attrs.language) {
    code.className = `language-${node.attrs.language}`
  }
  pre.appendChild(code)
  return { dom: pre, contentDOM: code }
}

class MermaidNodeView {
  dom: HTMLPreElement

  private node: PMNode
  private destroyed = false
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private unsubscribeTheme: () => void

  private svgEl: HTMLDivElement
  private errorEl: HTMLDivElement
  private sourceEl: HTMLElement

  constructor(props: NodeViewConstructorProps) {
    this.node = props.node

    const pre = document.createElement('pre')
    pre.classList.add('mermaid-block')
    // Atomic NodeView: editing happens in the source pane, not here. Marking
    // the whole subtree non-editable prevents the browser from trying to put
    // a cursor inside the rendered SVG (mermaid uses <foreignObject> with
    // HTML labels by default, which would otherwise inherit contentEditable
    // from the editor and create a focus trap).
    pre.contentEditable = 'false'

    const error = document.createElement('div')
    error.classList.add('mermaid-error')
    error.style.display = 'none'

    const svg = document.createElement('div')
    svg.classList.add('mermaid-svg')

    const source = document.createElement('code')
    source.classList.add('mermaid-source', 'language-mermaid')
    source.style.display = 'none'

    pre.appendChild(error)
    pre.appendChild(svg)
    pre.appendChild(source)

    this.dom = pre
    this.svgEl = svg
    this.errorEl = error
    this.sourceEl = source

    let previousTheme = useEditorStore.getState().resolvedTheme
    this.unsubscribeTheme = useEditorStore.subscribe((state) => {
      if (state.resolvedTheme === previousTheme) return
      previousTheme = state.resolvedTheme
      this.scheduleRender(0)
    })

    this.scheduleRender(0)
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false
    if (node.attrs.language !== 'mermaid') return false
    const codeChanged = node.textContent !== this.node.textContent
    this.node = node
    if (codeChanged) {
      this.scheduleRender(RENDER_DEBOUNCE_MS)
    }
    return true
  }

  destroy(): void {
    this.destroyed = true
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    this.unsubscribeTheme()
  }

  // No contentDOM — this is an atomic NodeView in WYSIWYG. PM tracks the
  // source text in its data model (the node's children), so the markdown
  // roundtrip is unaffected. All clicks/keys on the rendered diagram are
  // ours to ignore; let PM handle selection at the node boundary.
  stopEvent(): boolean {
    return false
  }

  // PM should ignore all mutations under this NodeView — none of them affect
  // the source text (which lives in the PM data model, not in our DOM).
  ignoreMutation(): boolean {
    return true
  }

  private scheduleRender(delayMs: number): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    if (delayMs <= 0) {
      this.debounceTimer = null
      void this.doRender()
      return
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      void this.doRender()
    }, delayMs)
  }

  private async doRender(): Promise<void> {
    if (this.destroyed) return
    const theme = useEditorStore.getState().resolvedTheme
    const code = this.node.textContent
    const result = await renderMermaid(code, theme)
    if (this.destroyed) return
    if (theme !== useEditorStore.getState().resolvedTheme) return
    this.applyResult(result, code)
  }

  private applyResult(
    result: { svg: string } | { error: string },
    sourceCode: string
  ): void {
    if ('svg' in result) {
      this.errorEl.style.display = 'none'
      this.errorEl.textContent = ''
      this.svgEl.innerHTML = result.svg
      this.sourceEl.style.display = 'none'
      this.sourceEl.textContent = ''
    } else {
      this.errorEl.textContent = result.error
      this.errorEl.style.display = ''
      this.svgEl.innerHTML = ''
      // Show the user what they typed alongside the error. Read from the PM
      // node's text content directly (we have no contentDOM).
      this.sourceEl.textContent = sourceCode
      this.sourceEl.style.display = ''
    }
  }
}

export const MermaidCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ({ node }) => {
      if (node.attrs.language === 'mermaid') {
        return new MermaidNodeView({ node })
      }
      return buildPassthroughCodeBlock(node)
    }
  },
}).configure({
  lowlight,
})
