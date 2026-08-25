import { cn } from '../../lib/utils'

export type SegmentedOption<T extends string> = {
  disabled?: boolean
  label: string
  value: T
}

/**
 * Two or three mutually exclusive views, switched in place.
 *
 * A sliding control rather than tabs: tabs imply the panels below are peers
 * of equal weight and each deserves its own underline. These are filters on
 * one body of content, and the control is small enough to sit next to other
 * page toolbar items.
 */
export function Segmented<T extends string>({
  className,
  onChange,
  options,
  value,
}: {
  className?: string
  onChange: (value: T) => void
  options: Array<SegmentedOption<T>>
  value: T
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border border-border/70 bg-surface/70 p-0.5',
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={option.disabled}
            className={cn(
              'rounded-[calc(var(--radius)-4px)] px-3 py-1.5 text-xs font-semibold transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-40',
              active
                ? 'bg-primary/15 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.25)]'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
