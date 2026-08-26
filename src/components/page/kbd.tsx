import type { ReactNode } from 'react'

/**
 * A key on the keyboard, printed inline.
 *
 * Sized to sit on a line of body copy without pushing the leading around, and
 * drawn as a control — hairline ring, control radius — because that is what
 * the key it stands for is.
 */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-lg bg-muted/40 px-1.5 font-display text-[0.6875rem] font-semibold leading-none text-muted-foreground ring-1 ring-inset ring-border/60">
      {children}
    </kbd>
  )
}
