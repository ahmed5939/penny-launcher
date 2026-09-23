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

function offenders(pattern: RegExp, allow: ReadonlyArray<string> = []) {
  return files.filter((file) => pattern.test(file.source) && !allow.includes(file.path)).map((file) => file.path)
}

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

  it('sizes type in rem, never px', () => {
    expect(offenders(/text-\[\d+px\]/)).toEqual([])
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
