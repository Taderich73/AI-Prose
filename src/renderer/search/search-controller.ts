import type { ActivePane } from '../stores/editor-store'

export interface SearchController {
  /** Recompute matches from the current store state and repaint decorations. */
  refresh: () => void
  /** Move active match forward (wrap to first if at end). */
  findNext: () => void
  /** Move active match backward (wrap to last if at start). */
  findPrev: () => void
  /** Replace the current active match with the store's replacement, then advance. */
  replace: () => void
  /** Replace every match in the document in a single transaction. */
  replaceAll: () => void
  /** Clear decorations and forget search state (called when the bar closes). */
  clear: () => void
}

const controllers: Record<ActivePane, SearchController | null> = {
  wysiwyg: null,
  source: null,
}

export function registerSearchController(
  pane: ActivePane,
  controller: SearchController | null
): void {
  controllers[pane] = controller
}

export function getSearchController(pane: ActivePane): SearchController | null {
  return controllers[pane]
}
