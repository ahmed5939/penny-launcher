import type { PropsWithChildren } from 'react'

import { useIntersectingElement } from '../-hooks'

import { cn } from '../../../lib/utils'

export function TitleSection({
  children,
  deps,
  id,
}: PropsWithChildren<{
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
        'sticky-title pt-[1px] -top-[1px] sticky z-10',
        '[&.is-sticky_h2]:border-muted-foreground/20',
        '[&.is-sticky_h2>span]:translate-x-4'
      )}
      ref={$title}
    >
      <h2
        className="bg-background/85 backdrop-blur border-muted-foreground/0 border-4 cursor-pointer font-bold mt-2 py-2 rounded-lg transition-colors"
        onClick={onScrollTop}
        id={id}
      >
        <span className="gap-2 inline-flex items-center transition-transform">
          <span className="h-5 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-indigo-400 to-violet-600" />
          {children}
        </span>
      </h2>
    </div>
  )
}
