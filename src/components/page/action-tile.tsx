import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '../../lib/utils'

/**
 * One discrete action, presented as a whole tile you press.
 *
 * Pages like Party are just a handful of one-shot commands. Wrapping each in
 * a card with a header, a body and a button in the footer spent four rows of
 * chrome on a single verb. Here the tile *is* the button, so the actions can
 * sit in a grid and be scanned at once.
 */
export function ActionTile({
  description,
  disabled,
  icon: Icon,
  onClick,
  title,
  tone = 'default',
  trailing,
}: {
  description?: ReactNode
  disabled?: boolean
  icon: LucideIcon
  onClick?: () => void
  title: ReactNode
  tone?: 'default' | 'danger'
  /** Status or count shown on the right — a spinner, a badge. */
  trailing?: ReactNode
}) {
  const danger = tone === 'danger'

  return (
    <button
      type="button"
      className={cn(
        'panel group flex w-full items-start gap-3.5 p-4 text-left transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        !disabled &&
          (danger
            ? 'hover:border-destructive/50 hover:bg-destructive/[0.07]'
            : 'hover:border-primary/40 hover:bg-accent/30')
      )}
      disabled={disabled}
      onClick={onClick}
    >
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-lg transition-colors',
          danger
            ? 'bg-destructive/10 text-destructive'
            : 'bg-primary/10 text-primary',
          !disabled &&
            (danger
              ? 'group-hover:bg-destructive/20'
              : 'group-hover:bg-primary/20')
        )}
      >
        <Icon className="size-[1.125rem]" />
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block text-sm font-semibold leading-tight',
            danger && 'text-destructive'
          )}
        >
          {title}
        </span>
        {description && (
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
            {description}
          </span>
        )}
      </span>

      {trailing && (
        <span className="shrink-0 self-center">{trailing}</span>
      )}
    </button>
  )
}
