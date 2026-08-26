import * as React from 'react'

import { cn } from '../../lib/utils'

export type TextareaProps =
  React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-16 w-full rounded-lg border border-input [border-bottom-color:hsl(var(--control-stroke))] bg-background px-3 py-2 text-sm placeholder:text-muted-foreground disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea }
