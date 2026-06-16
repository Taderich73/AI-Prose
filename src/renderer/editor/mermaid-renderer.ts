type Theme = 'light' | 'dark'
type RenderResult = { svg: string } | { error: string }

const MAX_CACHE = 200
const IMPORT_FAILURE_COOLDOWN_MS = 60_000

// Avoid importing mermaid types at module load — they'd pull the library in
// eagerly and defeat lazy loading.
type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void
  parse: (code: string) => Promise<unknown> | unknown
  render: (id: string, code: string) => Promise<{ svg: string }>
}

let mermaidPromise: Promise<MermaidApi> | null = null
let mermaidFailedAt = 0
let activeTheme: Theme | null = null
let renderCounter = 0
let generation = 0

const cache = new Map<string, string>()

function cacheKey(code: string, theme: Theme): string {
  return `${theme}::${code}`
}

function cacheGet(key: string): string | undefined {
  const value = cache.get(key)
  if (value !== undefined) {
    // LRU touch
    cache.delete(key)
    cache.set(key, value)
  }
  return value
}

function cacheSet(key: string, value: string): void {
  if (cache.has(key)) cache.delete(key)
  cache.set(key, value)
  while (cache.size > MAX_CACHE) {
    const firstKey = cache.keys().next().value
    if (firstKey === undefined) break
    cache.delete(firstKey)
  }
}

export function getCachedSvg(code: string, theme: Theme): string | undefined {
  return cache.get(cacheKey(code, theme))
}

export function bumpGeneration(): number {
  return ++generation
}

export function getGeneration(): number {
  return generation
}

async function loadMermaid(): Promise<MermaidApi> {
  if (mermaidPromise) return mermaidPromise
  if (Date.now() - mermaidFailedAt < IMPORT_FAILURE_COOLDOWN_MS) {
    throw new Error('mermaid recently failed to load; cooling down')
  }
  mermaidPromise = import('mermaid')
    .then((mod) => mod.default as unknown as MermaidApi)
    .catch((err) => {
      mermaidFailedAt = Date.now()
      mermaidPromise = null
      throw err
    })
  return mermaidPromise
}

function configureTheme(mermaid: MermaidApi, theme: Theme): void {
  if (activeTheme === theme) return
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: theme === 'dark' ? 'dark' : 'default',
  })
  activeTheme = theme
}

function formatError(err: unknown): string {
  let message: string
  if (err instanceof Error) {
    message = err.message
  } else if (
    typeof err === 'object' &&
    err !== null &&
    'str' in err &&
    typeof (err as { str: unknown }).str === 'string'
  ) {
    message = (err as { str: string }).str
  } else {
    message = String(err)
  }
  return `Mermaid: ${message.slice(0, 200)}`
}

function logFailure(errorMessage: string, code: string): void {
  const snippet = code.length > 100 ? `${code.slice(0, 100)}…` : code
  console.warn(`[mermaid] ${errorMessage} — source: ${snippet}`)
}

export async function renderMermaid(code: string, theme: Theme): Promise<RenderResult> {
  const trimmed = code.trim()
  if (trimmed.length === 0) {
    return { error: 'Mermaid: empty diagram' }
  }

  const key = cacheKey(code, theme)
  const cached = cacheGet(key)
  if (cached !== undefined) return { svg: cached }

  let mermaid: MermaidApi
  try {
    mermaid = await loadMermaid()
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    const message = `Failed to load mermaid: ${detail}`
    logFailure(message, code)
    return { error: message }
  }

  try {
    configureTheme(mermaid, theme)
  } catch (err) {
    const message = formatError(err)
    logFailure(message, code)
    return { error: message }
  }

  try {
    await Promise.resolve(mermaid.parse(code))
  } catch (err) {
    const message = formatError(err)
    logFailure(message, code)
    return { error: message }
  }

  const id = `mmd-${++renderCounter}`
  try {
    const { svg } = await mermaid.render(id, code)
    cacheSet(key, svg)
    return { svg }
  } catch (err) {
    const message = formatError(err)
    logFailure(message, code)
    return { error: message }
  }
}
