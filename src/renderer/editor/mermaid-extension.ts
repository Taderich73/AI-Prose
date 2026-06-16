import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import type { Node as PMNode } from '@tiptap/pm/model'
import { useEditorStore } from '../stores/editor-store'
import {
  renderMermaid,
  bumpGeneration,
  getGeneration,
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
  contentDOM: HTMLElement

  private node: PMNode
  private destroyed = false
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private unsubscribeTheme: () => void

  private svgEl: HTMLDivElement
  private errorEl: HTMLDivElement
  private codeEl: HTMLElement

  constructor(props: NodeViewConstructorProps) {
    this.node = props.node

    const pre = document.createElement('pre')
    pre.classList.add('mermaid-block')

    const error = document.createElement('div')
    error.classList.add('mermaid-error')
    error.style.display = 'none'

    const svg = document.createElement('div')
    svg.classList.add('mermaid-svg')

    const code = document.createElement('code')
    code.classList.add('mermaid-source', 'language-mermaid')

    pre.appendChild(error)
    pre.appendChild(svg)
    pre.appendChild(code)

    this.dom = pre
    this.contentDOM = code
    this.svgEl = svg
    this.errorEl = error
    this.codeEl = code

    let previousTheme = useEditorStore.getState().resolvedTheme
    this.unsubscribeTheme = useEditorStore.subscribe((state) => {
      if (state.resolvedTheme === previousTheme) return
      previousTheme = state.resolvedTheme
      bumpGeneration()
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

  // ProseMirror should not redirect text input events through the rendered SVG
  // since editing happens in the source pane. Telling PM that this NodeView
  // doesn't handle events keeps clicks from misbehaving.
  stopEvent(): boolean {
    return false
  }

  // The contentDOM hosts the mermaid source text. We hide it visually but PM
  // still uses it to track the node's text content for the markdown roundtrip.
  ignoreMutation(): boolean {
    return false
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
    const myGeneration = getGeneration()
    const theme = useEditorStore.getState().resolvedTheme
    const code = this.node.textContent
    const result = await renderMermaid(code, theme)
    if (this.destroyed) return
    if (myGeneration !== getGeneration()) return
    this.applyResult(result)
  }

  private applyResult(result: { svg: string } | { error: string }): void {
    if ('svg' in result) {
      this.errorEl.style.display = 'none'
      this.errorEl.textContent = ''
      this.svgEl.innerHTML = result.svg
      this.codeEl.style.display = 'none'
    } else {
      this.errorEl.textContent = result.error
      this.errorEl.style.display = ''
      this.svgEl.innerHTML = ''
      // Reveal the source so the user can see what they typed. ProseMirror
      // owns the content of codeEl (it's our contentDOM), so we don't write
      // text into it — we just unhide it.
      this.codeEl.style.display = ''
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
