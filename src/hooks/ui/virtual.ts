import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * The app scrolls in one place — the `ScrollArea` viewport in `layouts/main`
 * — so a long list on a page does not get its own scrollbar. It virtualises
 * against that viewport instead, which is what these two hooks are for.
 */
const scrollViewportSelector = '.main-wrapper-content'

/**
 * The page's scroll container, once it exists.
 *
 * State rather than a ref: a virtualiser has to re-run its measurement pass
 * the moment the element is found, and a ref assignment would not tell it.
 */
export function useScrollViewport() {
  const [element, setElement] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setElement(
      document.querySelector<HTMLElement>(scrollViewportSelector) ?? null
    )
  }, [])

  return element
}

/**
 * How far a list sits below the top of the scroll content — the virtualiser's
 * `scrollMargin`.
 *
 * Measured from bounding rects rather than `offsetTop`, because `offsetTop` is
 * relative to the nearest positioned ancestor and the panels above a list are
 * free to gain one. Re-measured whenever anything above the list changes
 * height: a stats row appearing, a warning callout, the window resizing.
 */
export function useScrollMargin(
  ref: React.RefObject<HTMLElement>,
  scrollElement: HTMLElement | null
) {
  const [margin, setMargin] = useState(0)
  const $margin = useRef(0)

  useLayoutEffect(() => {
    const element = ref.current

    if (!element || !scrollElement) {
      return
    }

    const measure = () => {
      const next =
        element.getBoundingClientRect().top -
        scrollElement.getBoundingClientRect().top +
        scrollElement.scrollTop

      /*
       * Guarded because the observer below also fires for the list's own
       * growth as rows measure themselves, and a `setState` per row would
       * turn the first paint into a loop.
       */
      if (Math.abs(next - $margin.current) >= 1) {
        $margin.current = next
        setMargin(next)
      }
    }

    measure()

    const observer = new ResizeObserver(measure)
    const content = scrollElement.firstElementChild

    observer.observe(scrollElement)

    if (content) {
      observer.observe(content)
    }

    return () => observer.disconnect()
  }, [ref, scrollElement])

  return margin
}

/**
 * How many fixed-minimum columns fit the element's current width — the same
 * arithmetic `grid-template-columns: repeat(auto-fill, minmax(N, 1fr))` does,
 * which a virtualiser has to know to slice items into rows.
 */
export function useColumnCount(
  ref: React.RefObject<HTMLElement>,
  { gap, minWidth }: { gap: number; minWidth: number }
) {
  const [columns, setColumns] = useState(1)

  useLayoutEffect(() => {
    const element = ref.current

    if (!element) {
      return
    }

    const measure = () => {
      const width = element.clientWidth

      setColumns(
        Math.max(1, Math.floor((width + gap) / (minWidth + gap)))
      )
    }

    measure()

    const observer = new ResizeObserver(measure)

    observer.observe(element)

    return () => observer.disconnect()
  }, [gap, minWidth, ref])

  return columns
}
