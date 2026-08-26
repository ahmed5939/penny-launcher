import type { PropsWithChildren } from 'react'

import { useIntersectingElement } from '../-hooks'

import { cn } from '../../../lib/utils'

/**
 * A section heading: an 11px label with a hairline rule running off to the
 * right, and a 2px tick that fades in once the heading pins.
 *
 * The tick and the rule take the section's own colour, so a zone heading and
 * the 3px rails of the rows beneath it read as one system. `accent` is any CSS
 * colour — sections that are not zones pass nothing and get the primary.
 */
export function TitleSection({
  accent,
  children,
  deps,
  id,
}: PropsWithChildren<{
  accent?: string
  deps?: unknown
  id?: string
}>) {
  const $title = useIntersectingElement({ deps })

  const onScrollTop = () => {
    const childElement = document.querySelector(
      `[aria-labelledby=${id}]`
    ) as HTMLElement | null

    if (!childElement) {
      return
    }

    document.querySelector('.main-wrapper-content')?.scroll({
      behavior: 'smooth',
      top: childElement.offsetTop,
    })
  }

  return (
    <div
      className={cn(
        'sticky-title sticky -top-[1px] z-10 pt-[1px]',
        '[&.is-sticky_.tick]:opacity-100',
        '[&.is-sticky_h2]:border-border/60'
      )}
      ref={$title}
    >
      <h2
        className="flex items-center gap-2.5 border-b border-transparent bg-background/95 py-2.5 transition-colors"
        onClick={onScrollTop}
        id={id}
      >
        {/*
          Pinned state is a fade, not a slide: nothing may move under the
          pointer while the list is scrolling past it.
        */}
        <span
          aria-hidden
          className="tick h-3 w-[2px] shrink-0 rounded-full opacity-0 transition-opacity"
          style={{ backgroundColor: accent ?? 'hsl(var(--primary))' }}
        />
        <span className="section-label">{children}</span>
        {/* The rule is what carries the eye across, so it bleeds right and fades. */}
        <span
          aria-hidden
          className="h-px min-w-8 flex-1"
          style={{
            backgroundImage: `linear-gradient(to right, ${accent ?? 'hsl(var(--border))'}, transparent)`,
          }}
        />
      </h2>
    </div>
  )
}
