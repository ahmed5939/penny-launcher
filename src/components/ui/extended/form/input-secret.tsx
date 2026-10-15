import type { ForwardedRef, ReactNode, RefCallback } from 'react'
import type { ButtonProps } from '../../button'
import type { InputProps } from '../../input'

import { Eye, EyeOff } from 'lucide-react'
import { forwardRef, useState } from 'react'

import { Button } from '../../button'
import { Input } from '../../input'

import { cn } from '../../../../lib/utils'

type Props = InputProps & {
  buttonProps?: ButtonProps
  inputProps?: InputProps & { ref?: RefCallback<HTMLInputElement> }
  iconButton?: ReactNode
}

export const InputSecret = forwardRef<HTMLInputElement, Props>(
  ({ buttonProps, iconButton, inputProps, ...props }, ref) => {
    const [isSecret, setIsSecret] = useState(true)
    const icon = isSecret ? <Eye size={16} /> : <EyeOff size={16} />
    const toggleProps = iconButton
      ? {}
      : {
          'aria-label': isSecret ? 'Show value' : 'Hide value',
          'aria-pressed': !isSecret,
        }

    return (
      <div className="flex items-center overflow-hidden relative rounded-lg">
        <Input
          {...props}
          {...inputProps}
          ref={(node) => {
            inputProps?.ref?.(node)
            assignRef(ref, node)
          }}
          className={cn(
            'pr-10 select-none',
            props.className,
            inputProps?.className
          )}
          type={isSecret ? 'password' : 'text'}
        />
        <Button
          variant="ghost"
          type="button"
          onClick={() => setIsSecret(!isSecret)}
          {...toggleProps}
          {...buttonProps}
          className={cn(
            'absolute p-0 right-1 size-8 z-20',
            buttonProps?.className
          )}
        >
          {iconButton ? iconButton : icon}
        </Button>
      </div>
    )
  }
)
InputSecret.displayName = 'InputSecret'

function assignRef<T>(ref: ForwardedRef<T>, node: T | null) {
  if (typeof ref === 'function') ref(node)
  else if (ref) ref.current = node
}
