import type { ReactNode, RefObject } from 'react'

import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

import { useScrollMargin, useScrollViewport } from '../hooks/ui/virtual'

import { cn } from '../lib/utils'

/**
 * A long list, of which only the part near the viewport exists.
 *
 * It virtualises against the app's single scroll pane rather than growing a
 * scrollbar of its own — a box that scrolls inside a page that also scrolls
 * is a worse thing to use than a long page — which is what `scrollMargin` is
 * for: the offset from the top of the scrolled content down to this list.
 *
 * Line heights are measured rather than declared. Callers give an estimate
 * good enough for the scrollbar, and every line reports its real height as it
 * mounts. Two consequences worth knowing: a line must not carry
 * `content-visibility: auto` (a skipped element measures as its
 * `contain-intrinsic-size`, not its real height), and a line must not be
 * `position: sticky` (there is nothing stable to stick to inside a
 * transformed window).
 */
export function VirtualList({
  className,
  count,
  estimateSize,
  getKey,
  overscan = 4,
  renderLine,
  sizerRef,
}: {
  className?: string
  count: number
  /** A first guess at a line's height, in pixels. */
  estimateSize: (index: number) => number
  getKey: (index: number) => string
  overscan?: number
  renderLine: (index: number) => ReactNode
  /**
   * The element whose width is the list's content width. Handed back so a
   * caller sizing a grid can measure it without guessing at padding.
   */
  sizerRef?: RefObject<HTMLDivElement>
}) {
  const $list = useRef<HTMLDivElement>(null)

  const scrollElement = useScrollViewport()
  const scrollMargin = useScrollMargin($list, scrollElement)

  const virtualizer = useVirtualizer({
    count,
    estimateSize,
    overscan,
    scrollMargin,
    getItemKey: getKey,
    getScrollElement: () => scrollElement,
  })

  const lines = virtualizer.getVirtualItems()

  return (
    <div
      className={cn(className)}
      ref={$list}
    >
      <div
        className="relative w-full"
        ref={sizerRef}
        style={{ height: virtualizer.getTotalSize() }}
      >
        <div
          className="absolute left-0 top-0 w-full"
          style={{
            transform: `translateY(${(lines[0]?.start ?? 0) - scrollMargin}px)`,
          }}
        >
          {lines.map((line) => (
            <div
              data-index={line.index}
              key={line.key}
              ref={virtualizer.measureElement}
            >
              {renderLine(line.index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
