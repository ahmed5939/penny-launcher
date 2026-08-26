import type { ButtonHTMLAttributes } from 'react'

import { Check, Minus } from 'lucide-react'
import { forwardRef } from 'react'

import { cn } from '../../lib/utils'

export type CheckboxProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange' | 'type' | 'value'
> & {
  /** `'indeterminate'` renders the dash, for a partially selected group. */
  checked?: boolean | 'indeterminate'
  size?: 'default' | 'sm'

  onCheckedChange?: (checked: boolean) => void
}

/**
 * A checkbox, at the control radius.
 *
 * Not a Radix wrapper — `@radix-ui/react-checkbox` is not a dependency, and
 * the hidden input it adds only matters inside a native `<form>`, which no
 * caller here is. This renders what Radix renders anyway: a button carrying
 * `role="checkbox"` and `aria-checked`, so screen readers and keyboard
 * activation behave identically.
 *
 * It exists because the account list drew its own at `rounded-[3px]` — one
 * pixel off the 4px control radius, which is exactly the kind of drift a
 * primitive prevents.
 */
const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(
  (
    {
      checked = false,
      className,
      onCheckedChange,
      onClick,
      size = 'default',
      ...props
    },
    ref
  ) => {
    const indeterminate = checked === 'indeterminate'
    const isChecked = checked === true
    const compact = size === 'sm'

    return (
      <button
        ref={ref}
        type="button"
        role="checkbox"
        aria-checked={indeterminate ? 'mixed' : isChecked}
        data-state={
          indeterminate
            ? 'indeterminate'
            : isChecked
              ? 'checked'
              : 'unchecked'
        }
        className={cn(
          'grid shrink-0 place-items-center rounded-lg border transition-colors disabled:opacity-50',
          compact ? 'size-4' : 'size-5',
          isChecked || indeterminate
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-muted-foreground/50 [&:not(:disabled)]:hover:border-muted-foreground',
          className
        )}
        {...props}
        onClick={(event) => {
          onClick?.(event)

          /*
           * A caller that already handled the click — a row that toggles
           * itself, say — calls `preventDefault` and owns the state change.
           */
          if (!event.defaultPrevented) {
            onCheckedChange?.(!isChecked)
          }
        }}
      >
        {indeterminate ? (
          <Minus className={compact ? 'size-3' : 'size-3.5'} />
        ) : (
          isChecked && (
            <Check className={compact ? 'size-3' : 'size-3.5'} />
          )
        )}
      </button>
    )
  }
)
Checkbox.displayName = 'Checkbox'

export { Checkbox }
