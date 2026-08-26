import type { ReactNode } from 'react'

import { useRef } from 'react'

import { CopyButton } from './copy-field'

import { cn } from '../../lib/utils'

/**
 * One fact: what it is called, and what it says.
 *
 * Renders a `<dt>`/`<dd>` pair and nothing else, so it always needs a `<dl>`
 * around it — a description list is what this actually is, and giving the pair
 * its real markup is free.
 *
 * The label is a caption, so it takes the caption rank and the value stays at
 * body size. That inversion is the point: the label is scaffolding you read
 * once, the value is what you came for.
 */
export function KeyValue({
  className,
  copyable,
  label,
  value,
}: {
  className?: string
  /** Offer a copy button. The text copied is whatever the value renders to. */
  copyable?: boolean
  label: ReactNode
  value: ReactNode
}) {
  /*
   * Copying reads the rendered text back off the element rather than taking a
   * string prop, because `value` is a node as often as it is a string — an
   * account id wrapped in a mono span copies the same either way.
   */
  const $value = useRef<HTMLSpanElement>(null)

  return (
    <div className={cn('min-w-0', className)}>
      <dt className="micro-label">{label}</dt>
      <dd className="mt-1 flex items-center gap-1 text-[0.8125rem] leading-tight text-foreground/85">
        <span
          className="min-w-0 flex-1"
          ref={$value}
        >
          {value}
        </span>
        {copyable && (
          <CopyButton
            className="size-6 shrink-0"
            getValue={() => $value.current?.textContent}
          />
        )}
      </dd>
    </div>
  )
}
