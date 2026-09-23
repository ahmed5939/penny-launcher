import type { ReactNode } from 'react'

import { RefreshCw, Search } from 'lucide-react'

import { Chip } from './chip'
import { PanelFooter } from './panel'
import { ScopeToolbar } from './scope-toolbar'

import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'

import { cn } from '../../lib/utils'

/**
 * The page-level controls every tool screen was writing for itself.
 *
 * Before these existed the same dropdown was written three times under three
 * names (`Picker`, `LauncherSelect`, a raw `<select>`), pagination four times
 * with plain unstyled buttons, and every Refresh button chose its own
 * spinner. See `UX-STANDARD.md` at the repo root for when to use each.
 */

export type PickerOption<T extends string = string> = { value: T; label: string; disabled?: boolean }

/**
 * A labelled dropdown. The label is for screen readers — the selected value
 * is what a sighted user reads, so options should say what they mean on
 * their own ("All rarities", not "All").
 */
export function Picker<T extends string>({
  className,
  disabled,
  label,
  onChange,
  options,
  value,
}: {
  className?: string
  disabled?: boolean
  label: string
  onChange: (value: T) => void
  options: ReadonlyArray<PickerOption<T>>
  value: T
}) {
  return (
    <Select disabled={disabled} onValueChange={(next) => onChange(next as T)} value={value}>
      <SelectTrigger aria-label={label} className={cn('h-8 w-auto min-w-36 gap-2', className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem disabled={option.disabled} key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Search box with the leading glyph. Grows to fill the toolbar row. */
export function SearchField({
  className,
  label,
  onChange,
  placeholder,
  value,
}: {
  className?: string
  /** Accessible name; the placeholder alone is not one. */
  label: string
  onChange: (value: string) => void
  placeholder?: string
  value: string
}) {
  return (
    <span className={cn('relative min-w-48 flex-1', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input aria-label={label} className="h-8 pl-9" onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type="search" value={value} />
    </span>
  )
}

/**
 * The filter strip between a panel's header and its content. Hairline below,
 * body gutter either side, controls levelled to 32px by `ScopeToolbar`.
 */
export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('border-b border-border/60 px-5 py-3', className)}>
      <ScopeToolbar>{children}</ScopeToolbar>
    </div>
  )
}

/**
 * Previous / page n of m / Next, as the panel's footer. Renders nothing when
 * everything fits on one page, so callers never need to guard it.
 */
export function Pager({ onPageChange, page, pageSize, total }: { onPageChange: (page: number) => void; page: number; pageSize: number; total: number }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  const current = Math.min(page, pages - 1)
  return (
    <PanelFooter className="justify-between">
      <span className="text-xs text-muted-foreground">
        <span className="figure">{(current * pageSize + 1).toLocaleString()}</span>–<span className="figure">{Math.min(total, (current + 1) * pageSize).toLocaleString()}</span> of <span className="figure">{total.toLocaleString()}</span>
      </span>
      <span className="flex items-center gap-2">
        <Button disabled={current === 0} onClick={() => onPageChange(current - 1)} size="sm" variant="outline">Previous</Button>
        <span className="text-xs text-muted-foreground">Page <span className="figure">{current + 1}</span> of <span className="figure">{pages}</span></span>
        <Button disabled={current >= pages - 1} onClick={() => onPageChange(current + 1)} size="sm" variant="outline">Next</Button>
      </span>
    </PanelFooter>
  )
}

/** Clamp a page index after the list under it shrank, and slice to it. */
export function paginate<T>(items: ReadonlyArray<T>, page: number, pageSize: number) {
  const pages = Math.max(1, Math.ceil(items.length / pageSize))
  const current = Math.min(page, pages - 1)
  return { page: current, items: items.slice(current * pageSize, (current + 1) * pageSize) }
}

/** The page-level Refresh. The glyph spins while loading; the word changes too, for anyone who cannot see it. */
export function RefreshButton({ disabled, label = 'Refresh', loading, onClick }: { disabled?: boolean; label?: string; loading: boolean; onClick: () => void }) {
  return (
    <Button disabled={disabled || loading} onClick={onClick} variant="outline">
      <RefreshCw className={cn('mr-2 size-4', loading && 'animate-spin')} />
      {loading ? 'Loading…' : label}
    </Button>
  )
}

/**
 * The status chips for `PageHeader`. `beta` for anything still being
 * validated against live accounts; `readOnly` for any tool that must never
 * change the account — saying so up front is what lets people trust it.
 */
export function ToolBadges({ beta, readOnly }: { beta?: boolean; readOnly?: boolean }) {
  if (!beta && !readOnly) return null
  return (
    <>
      {beta && <Chip tone="accent">Beta</Chip>}
      {readOnly && <Chip>Read-only</Chip>}
    </>
  )
}

/** Hands the user a JSON file. Used by every "Export" action. */
export function downloadJson(filename: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
