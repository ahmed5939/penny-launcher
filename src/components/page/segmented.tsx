import type { LucideIcon } from 'lucide-react'
import { useRef, type KeyboardEvent } from 'react'

import { cn } from '../../lib/utils'

export type SegmentedOption<T extends string> = {
  disabled?: boolean
  /** Draws the option as an icon; the label becomes its tooltip and accessible name. */
  icon?: LucideIcon
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
  label,
  onChange,
  options,
  value,
}: {
  className?: string
  label?: string
  onChange: (value: T) => void
  options: Array<SegmentedOption<T>>
  value: T
}) {
  const $buttons = useRef<Array<HTMLButtonElement | null>>([])

  const enabledFrom = (from: number, direction: 1 | -1) => {
    for (let offset = 1; offset <= options.length; offset++) {
      const index = (((from + direction * offset) % options.length) + options.length) % options.length
      if (!options[index].disabled) return index
    }

    return -1
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const from = $buttons.current.indexOf(event.target as HTMLButtonElement)
    let next: number

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = enabledFrom(from, 1)
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = enabledFrom(from, -1)
    else if (event.key === 'Home') next = enabledFrom(-1, 1)
    else if (event.key === 'End') next = enabledFrom(options.length, -1)
    else return

    event.preventDefault()
    if (next < 0 || options[next].value === value) return
    $buttons.current[next]?.focus()
    onChange(options[next].value)
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border border-border/70 bg-surface/70 p-0.5',
        className
      )}
      onKeyDown={onKeyDown}
    >
      {/*
        h-7 inside the 2px track: 28 + 4 puts the whole control at the standard
        32px, so a Segmented lines up with the buttons beside it in a toolbar.
      */}
      {options.map((option, index) => {
        const active = option.value === value
        const Icon = option.icon

        return (
          <button
            key={option.value}
            ref={(element) => {
              $buttons.current[index] = element
            }}
            type="button"
            role="radio"
            aria-label={Icon ? option.label : undefined}
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            disabled={option.disabled}
            className={cn(
              'h-7 rounded-lg text-xs font-semibold transition-colors',
              Icon ? 'grid w-8 place-items-center' : 'px-3',
              'disabled:opacity-40',
              active
                ? 'bg-primary/15 text-primary ring-1 ring-inset ring-primary/25'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => onChange(option.value)}
            title={Icon ? option.label : undefined}
          >
            {Icon ? <Icon className="size-4" /> : option.label}
          </button>
        )
      })}
    </div>
  )
}
