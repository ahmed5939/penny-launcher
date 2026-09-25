import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Enforces the rules in `UX-STANDARD.md` that a machine can check.
 *
 * Every screen under `src/routes` and `src/features` is scanned. A failure
 * here means a page is building by hand something the page kit already
 * provides — use the kit component named in the message instead. Do not add
 * to an allow-list to make a new page pass; the lists hold only files that
 * predate the standard or have a stated reason.
 */

const root = join(__dirname, '..', '..', '..')
const scanned = ['src/routes', 'src/features']

function tsxFiles(dir: string): Array<string> {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return tsxFiles(path)
    return path.endsWith('.tsx') && !path.endsWith('.test.tsx') ? [path] : []
  })
}

const files = scanned.flatMap((dir) => tsxFiles(join(root, dir))).map((path) => ({
  path: relative(root, path).replaceAll('\\', '/'),
  source: readFileSync(path, 'utf8'),
}))

function offenders(pattern: RegExp, allow: ReadonlyArray<string> = [], pool = files) {
  return pool.filter((file) => pattern.test(file.source) && !allow.includes(file.path)).map((file) => file.path)
}

function sourceFiles(dir: string, extensions: ReadonlyArray<string>): Array<string> {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path, extensions)
    return extensions.some((ext) => path.endsWith(ext)) && !/\.test\.tsx?$/.test(path) ? [path] : []
  })
}

function load(paths: Array<string>) {
  return paths.map((path) => ({ path: relative(root, path).replaceAll('\\', '/'), source: readFileSync(path, 'utf8') }))
}

/** Everything that draws UI, kit included: the type scale and palette rules hold there too. */
const uiFiles = load(['src/routes', 'src/features', 'src/components', 'src/layouts'].flatMap((dir) => sourceFiles(join(root, dir), ['.tsx'])))

/** Screens plus their hooks, where toasts are raised. */
const screenLogic = load(['src/routes', 'src/features', 'src/components', 'src/bootstrap'].flatMap((dir) => sourceFiles(join(root, dir), ['.ts', '.tsx'])))

describe('UX standard', () => {
  it('scans the screens', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it('uses kit controls, not raw HTML ones (Picker, Dialog)', () => {
    expect(offenders(/<select[\s>]/)).toEqual([])
    expect(offenders(/<dialog[\s>]/)).toEqual([])
  })

  it('styles with Tailwind and the kit, never an inline stylesheet', () => {
    expect(offenders(/<style[\s>]|const css = `/)).toEqual([])
  })

  it('does not re-declare kit components locally (Picker, Pager)', () => {
    expect(offenders(/function (Picker|LauncherSelect|Pager|Pagination|SearchBox|RefreshButton)\b/)).toEqual([])
  })

  it('paginates with Pager, not hand-built Previous/Next rows', () => {
    expect(offenders(/>\s*Previous\s*</)).toEqual([])
  })

  it('sizes type from the named scale, never text-[…]', () => {
    // text-3xs … text-display-lg live in tailwind.config.js.
    expect(offenders(/text-\[\d/, [], uiFiles)).toEqual([])
    expect(readFileSync(join(root, 'src/globals.css'), 'utf8')).not.toMatch(/text-\[\d/)
  })

  it('takes status colour from theme tokens, not the Tailwind palette', () => {
    const allow = [
      // three.js scene code, not DOM styling.
      'src/routes/stw-operations/outpost/-blueprint-3d.tsx',
    ]
    expect(offenders(/\b(text|bg|border|fill|ring|from|to|stroke)-(red|green|yellow|blue|orange|amber|emerald|lime|sky|purple|pink|rose|violet|indigo|teal|cyan)-\d/, allow, uiFiles)).toEqual([])
  })

  it('filters lists with SearchField, not a raw Input', () => {
    const allow = [
      // Account look-ups and add-account fields in submit forms, not list filters.
      'src/routes/-index/alerts-done/-search-form.tsx',
      'src/routes/account-management/eula/-page.tsx',
      'src/routes/advanced-mode/matchmaking-track/-page.tsx',
      'src/routes/settings/-account-customization/-index.tsx',
      'src/routes/stw-operations/xpboosts/-page.tsx',
    ]
    expect(offenders(/<Input\b[^>]*placeholder=[^>]*(search|Search)/, allow)).toEqual([])
  })

  it('reloads page data with RefreshButton, not a hand-built one', () => {
    // RefreshCw is RefreshButton's icon. Files here use it for another action.
    const allow = [
      // "Check for updates" on the game install.
      'src/routes/-index/-game-install.tsx',
      // "Revert all", "Regenerate" and per-patch re-scan buttons.
      'src/routes/settings/tweaks/-page.tsx',
    ]
    expect(offenders(/<RefreshCw\b/, allow)).toEqual([])
  })

  it('titles sections with PanelHeader, not a bare <h2>', () => {
    const allow = [
      // The <h2> is the title inside a header strip that is itself the panel header.
      'src/routes/-index/-components/-title.tsx',
      'src/routes/advanced-mode/matchmaking-track/-live-mission.tsx',
      'src/routes/stw-operations/leaderboards/-page.tsx',
      'src/routes/stw-operations/outpost/-page.tsx',
      'src/routes/stw-operations/timeline/-page.tsx',
      'src/features/quest-history/view.tsx',
      // Captions over tiles and lists that already draw their own panels.
      'src/routes/-index/-home/-index.tsx',
      'src/routes/-index/alerts-done/-rewards-summary.tsx',
    ]
    expect(offenders(/<h2[\s>]/, allow)).toEqual([])
  })

  it('shows failures in a Callout, not red text', () => {
    const allow = [
      // A one-word "Wrong key" hint directly under the access-key field.
      'src/routes/settings/-page.tsx',
      'src/routes/settings/tweaks/-page.tsx',
    ]
    expect(offenders(/<p\b[^>]*text-destructive/, allow)).toEqual([])
  })

  it('labels in normal case, not uppercase letter-spaced eyebrows', () => {
    expect(offenders(/uppercase[^'"`\n]*tracking-\[|tracking-\[[^'"`\n]*uppercase/, [], uiFiles)).toEqual([])
  })

  it('keeps the arrow cursor, as Windows controls do', () => {
    // The hand is the hyperlink cursor; globals.css sets the default.
    expect(offenders(/\bcursor-pointer\b/, [], uiFiles)).toEqual([])
  })

  it('opens flyouts the way Windows does, not with a zoom from 95%', () => {
    // Menus fade and slide from their anchor; dialogs settle from 105%.
    expect(offenders(/\bzoom-(in|out)-95\b/, [], uiFiles)).toEqual([])
  })

  it('gives every toast a tone (success, error, warning, info)', () => {
    const allow = [
      // The toaster itself, and the re-export every screen imports.
      'src/components/ui/sonner.tsx',
      'src/lib/notifications.ts',
    ]
    expect(offenders(/(^|[^.\w])toast\(/m, allow, screenLogic)).toEqual([])
  })

  it('takes colour from tokens or config palettes, not hex literals', () => {
    const allow = [
      // three.js materials need literal colours.
      'src/routes/stw-operations/outpost/-blueprint-3d.tsx',
      'src/routes/stw-operations/outpost/-blueprint-canvas-3d.tsx',
      'src/routes/stw-operations/outpost/-page.tsx',
      // Predate the standard; move to a palette when next touched.
      'src/routes/account-management/gifts-information/-page.tsx',
      'src/routes/stw-operations/timeline/-page.tsx',
    ]
    expect(offenders(/['"`]#[0-9a-fA-F]{6}\b/, allow)).toEqual([])
  })

  it('opens pages with PageHeader, not a bare <h1>', () => {
    const allow = [
      // The home hero and the alert detail sheet are not tool pages.
      'src/routes/-index/-hero.tsx',
      'src/routes/-index/alerts-done/-basic-information.tsx',
    ]
    expect(offenders(/<h1[\s>]/, allow)).toEqual([])
  })

  it('marks read-only and beta tools with ToolBadges, not hand-made chips', () => {
    expect(offenders(/<Chip[^>]*>\s*(Beta|Read-only)\s*<\/Chip>/)).toEqual([])
  })
})
