import type { ReactNode } from 'react'

import { cn } from '../../lib/utils'

/**
 * A labelled control on its own divided row.
 *
 * Forms in this app were stacks of bare inputs where the placeholder was the
 * only clue what a field did. A row gives the label somewhere permanent to
 * live and leaves room for a hint under it. Wrap a group in `FieldGroup` and
 * the rows share dividers instead of each carrying a border.
 */
export function FieldGroup({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('divide-y divide-border/50', className)}>
      {children}
    </div>
  )
}

export function FieldRow({
  children,
  className,
  hint,
  label,
  /** Put the control under the label instead of beside it. */
  stacked = false,
}: {
  children: ReactNode
  className?: string
  hint?: ReactNode
  label?: ReactNode
  stacked?: boolean
}) {
  if (stacked) {
    return (
      <div className={cn('space-y-2 py-4 first:pt-0 last:pb-0', className)}>
        {label && (
          <p className="text-[0.8125rem] font-medium leading-none">
            {label}
          </p>
        )}
        {children}
        {hint && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4 first:pt-0 last:pb-0',
        className
      )}
    >
      <div className="min-w-0 flex-1 basis-48">
        {label && (
          <p className="text-[0.8125rem] font-medium leading-none">
            {label}
          </p>
        )}
        {hint && (
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
