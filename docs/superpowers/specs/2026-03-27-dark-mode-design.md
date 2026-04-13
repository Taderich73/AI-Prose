# Dark Mode Support

## Overview

Add dark mode to the markdown editor with system preference detection, manual override, and localStorage persistence. Toggle lives in the status bar.

## Theme State Management

### Store Changes (Zustand)

Add to `editor-store.ts`:

- `theme: 'light' | 'dark' | 'system'` — user's preference (default: `'system'`)
- `resolvedTheme: 'light' | 'dark'` — computed from preference + OS setting
- `setTheme(theme)` — update preference, persist to `localStorage`, update `resolvedTheme`
- `cycleTheme()` — cycles system → light → dark → system

### Initialization

1. On app load, read `localStorage.getItem('theme')` — default to `'system'` if absent
2. If `'system'`, evaluate `window.matchMedia('(prefers-color-scheme: dark)')`
3. Register `matchMedia` change listener to update `resolvedTheme` when OS preference changes (only relevant when user preference is `'system'`)
4. Apply `data-theme="dark"` or `data-theme="light"` attribute on `document.documentElement`

### Persistence

- Key: `theme` in `localStorage`
- Values: `'light'`, `'dark'`, `'system'`
- Written on every `setTheme()` call

## CSS Implementation

### Dark Variables

Define under `[data-theme="dark"]` selector in `app.css`:

```css
[data-theme="dark"] {
  --bg-primary: #1a1a1a;
  --bg-secondary: #242424;
  --bg-toolbar: #2a2a2a;
  --text-primary: #e4e4e4;
  --text-secondary: #a0a0a0;
  --border-color: #333333;
  --accent-color: #3b82f6;
  --accent-hover: #60a5fa;
  --button-hover: #333333;
  --button-active: #444444;
}
```

### Syntax Highlighting (Dark)

Adjust the hardcoded syntax highlighting colors (lines ~330-358 in `app.css`) for dark backgrounds. Scope under `[data-theme="dark"]`.

### Dialogs & Overlays

Dialog backdrop and surfaces need dark variants:
- Dialog background: `var(--bg-primary)` (already using variables — should inherit)
- Overlay: adjust opacity if needed for dark backgrounds
- Input fields within dialogs: dark background, light text, darker border

### Scrollbars

Add dark scrollbar styles under `[data-theme="dark"]` for WebKit scrollbars.

## CodeMirror Integration

### Current State

- `@codemirror/theme-one-dark` is already a dependency
- Currently the light theme CSS overrides it

### Changes

- In `codemirror/setup.ts`, accept a `theme` parameter
- When `resolvedTheme === 'dark'`, include `oneDark` extension
- When `resolvedTheme === 'light'`, use default (or a light theme extension)
- `SourcePane` re-creates or reconfigures CodeMirror when `resolvedTheme` changes

## Toggle UI

### Location

Status bar, right side — after existing content, before the right edge.

### Behavior

- **Icon:** Sun (☀) when dark mode is active (clicking switches to light), Moon (🌙) when light mode is active
- **Click:** Calls `cycleTheme()` — system → light → dark → system
- **Tooltip:** Shows current state — "Theme: System", "Theme: Light", "Theme: Dark"

### Visual

- Same size/style as other status bar text
- Subtle, not attention-grabbing
- Icon only, no label

## Electron Considerations

### Title Bar

The app uses a standard Electron `BrowserWindow` with default frame. The native title bar follows the OS theme automatically — no IPC needed.

### Menu

Add "Toggle Dark Mode" to the View menu with `Cmd+D` / `Ctrl+D` shortcut. This calls `cycleTheme()` via IPC, same as the status bar button.

## Component Impact

All components use CSS variables already, so dark mode is inherited automatically:
- **Toolbar** — inherits via `--bg-toolbar`, `--text-primary`, `--border-color`
- **EditorPane (Tiptap)** — inherits via `--bg-primary`, `--text-primary`
- **SourcePane (CodeMirror)** — needs explicit theme swap (see above)
- **FileBrowser** — inherits via CSS variables
- **SavePrompt dialog** — inherits via CSS variables
- **StatusBar** — inherits + hosts the toggle button

## Scope Boundaries

### Included
- Dark/light CSS variable sets
- System preference detection with manual override
- localStorage persistence
- Status bar toggle (cycle through system/light/dark)
- View menu item with keyboard shortcut
- CodeMirror theme switching
- Dark syntax highlighting colors
- Scrollbar styling

### Not Included
- Per-document themes
- Custom color picker or theme editor
- "Dim" or "high contrast" modes
- Scheduled theme switching
- Tiptap content area custom styling beyond CSS variables (prose content inherits from variables)

## Files to Modify

| File | Change |
|------|--------|
| `src/renderer/app.css` | Add `[data-theme="dark"]` variable block, dark syntax highlighting, dark scrollbars |
| `src/renderer/stores/editor-store.ts` | Add `theme`, `resolvedTheme`, `setTheme()`, `cycleTheme()` |
| `src/renderer/components/StatusBar.tsx` | Add theme toggle icon button |
| `src/renderer/components/SourcePane.tsx` | Pass resolved theme to CodeMirror setup |
| `src/renderer/codemirror/setup.ts` | Accept theme param, conditionally apply oneDark |
| `src/renderer/App.tsx` | Initialize theme on mount, sync `data-theme` attribute, register matchMedia listener |
| `src/main/index.ts` | Add "Toggle Dark Mode" to View menu with IPC |
| `src/preload/index.ts` | Expose theme toggle IPC if needed for menu |
