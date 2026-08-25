import type { ButtonHTMLAttributes } from 'react'

import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef } from 'react'

import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background select-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:select-none',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground [&:not(:disabled)]:hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground [&:not(:disabled)]:hover:bg-destructive/90',
        outline:
          'border border-input bg-background [&:not(:disabled)]:hover:bg-accent [&:not(:disabled)]:hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground [&:not(:disabled)]:hover:bg-secondary/80',
        ghost:
          '[&:not(:disabled)]:hover:bg-accent [&:not(:disabled)]:hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 [&:not(:disabled)]:hover:underline',
      },
      /*
       * Fluent's control sizes: 32px standard, 24–28px compact. The 40px
       * default this replaces is a web scale — sized for touch on a phone,
       * on an app that only ever runs under a mouse.
       */
      size: {
        default: 'h-8 px-4 py-1',
        sm: 'h-7 rounded-md px-3',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
