import type { ReactNode } from 'react'

import { cn } from '../../lib/utils'

/**
 * The strip that decides what a page is showing: a search box, an account or
 * filter combobox, and the buttons that act on the result.
 *
 * Twenty-eight files build this row, and between them they put three control
 * heights on one line — a 40px Input beside a 32px Button beside a 28px
 * Combobox trigger. Until those primitives are brought to Fluent's 32px on
 * their own, the toolbar levels its own contents, so a screen cannot end up
 * ragged just by picking the wrong one.
 *
 * Direct-child buttons only. A button nested inside a control — the
 * Combobox's own clear affordance, an input's trailing action — is positioned
 * against that control and must keep its own size.
 */
export function ScopeToolbar({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2',
        '[&_input]:h-8 [&_[role=combobox]]:h-8 [&>button]:h-8',
        className
      )}
    >
      {children}
    </div>
  )
}
