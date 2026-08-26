import type { InputHTMLAttributes } from 'react'

import { forwardRef } from 'react'

import { cn } from '../../lib/utils'

export type InputProps = InputHTMLAttributes<HTMLInputElement>

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          /*
           * 32px, the same as Button. Every toolbar in the app was ragged
           * because this shipped the web's touch-sized 40px next to a 32px
           * button. The bottom edge is a shade stronger than the other
           * three — what makes a WinUI text field look recessed without a
           * shadow, and the same stroke `.panel` uses.
           */
          'flex h-8 w-full rounded-lg border border-input [border-bottom-color:hsl(var(--control-stroke))] bg-background px-3 py-1 text-sm placeholder:text-muted-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
