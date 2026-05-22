export interface MatchOptions {
  caseSensitive: boolean
  wholeWord: boolean
}

const REGEX_META = /[.*+?^${}()|[\]\\]/g

export function escapeRegex(input: string): string {
  return input.replace(REGEX_META, '\\$&')
}

/**
 * Build a global RegExp from the user's query and options. Returns null if
 * the query is empty (callers should treat this as "no search active").
 */
export function buildSearchRegex(
  query: string,
  options: MatchOptions
): RegExp | null {
  if (!query) return null
  const escaped = escapeRegex(query)
  const pattern = options.wholeWord ? `\\b${escaped}\\b` : escaped
  const flags = options.caseSensitive ? 'g' : 'gi'
  try {
    return new RegExp(pattern, flags)
  } catch {
    return null
  }
}
