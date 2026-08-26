import { Check, Clipboard } from 'lucide-react'
import { forwardRef, useEffect, useRef, useState } from 'react'

import { Button } from '../ui/button'
import { Input } from '../ui/input'

import { useInputPaddingButton } from '../../hooks/ui/inputs'

import { cn } from '../../lib/utils'

/**
 * The copy button, and the "did that work?" tick it turns into.
 *
 * A toast for a two-character action is more interruption than the action was
 * worth, so the acknowledgement stays on the control that did it. Shared with
 * `KeyValue`, which offers the same affordance without an input around it.
 */
export const CopyButton = forwardRef<
  HTMLButtonElement,
  {
    className?: string
    disabled?: boolean
    /**
     * Read lazily, so a caller can hand over text it only knows at click time
     * — `KeyValue` reads it back off its own rendered `<dd>`.
     */
    getValue: () => string | null | undefined
  }
>(({ className, disabled, getValue }, ref) => {
  const [copied, setCopied] = useState(false)
  const $timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => () => clearTimeout($timer.current), [])

  const handleCopy = () => {
    const value = getValue()

    if (!value) {
      return
    }

    window.navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(true)
        clearTimeout($timer.current)
        $timer.current = setTimeout(() => setCopied(false), 1600)
      })
      .catch(() => {})
  }

  return (
    <Button
      aria-label="Copy"
      className={cn('px-0 text-muted-foreground', className)}
      disabled={disabled}
      onClick={handleCopy}
      ref={ref}
      size="icon"
      type="button"
      variant="ghost"
    >
      {copied ? (
        <Check className="size-4 text-success" />
      ) : (
        <Clipboard className="size-4" />
      )}
    </Button>
  )
})
CopyButton.displayName = 'CopyButton'

/**
 * A value you are meant to take somewhere else — a continuation URL, an
 * exchange code, an account id.
 *
 * Three screens built this by hand and all three needed the geometry
 * `useInputPaddingButton` provides: it measures the trailing button once and
 * hands the input its right padding as a custom property. Reusing the hook is
 * what keeps the text from sliding under the button when the locale changes.
 *
 * Read-only by design. The field exists to be copied out of, never typed in.
 */
export function CopyField({
  className,
  label,
  value,
}: {
  className?: string
  label?: string
  value: string | null | undefined
}) {
  const [$input, $button] = useInputPaddingButton()

  const id = label ? `copy-field-${label}` : undefined

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        /*
          Plain <label>: the shadcn Label bakes in a `text-sm` utility, which
          outranks the `.micro-label` component class and would quietly undo
          it.
        */
        <label
          className="micro-label"
          htmlFor={id}
        >
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <Input
          className="h-8 select-text pl-3 pr-[var(--pr-button-width)] text-[0.8125rem]"
          id={id}
          readOnly
          ref={$input}
          value={value ?? ''}
        />
        <CopyButton
          className="absolute right-0.5 size-7"
          disabled={!value}
          getValue={() => value}
          ref={$button}
        />
      </div>
    </div>
  )
}
