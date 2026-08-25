import { cn } from '../../lib/utils'

/**
 * Marks a tool that is new and still settling.
 *
 * Beta tools sit in their natural section rather than a quarantine menu —
 * they are meant to be used — but the badge sets the expectation that the
 * behaviour may still move under you.
 */
export function BetaBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded border border-primary/30 bg-primary/10 px-1',
        'text-[0.6rem] font-semibold uppercase leading-4 tracking-wide text-primary',
        className
      )}
    >
      Beta
    </span>
  )
}
