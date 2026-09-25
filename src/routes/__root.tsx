import {
  createRootRoute,
  Outlet,
  useRouterState,
} from '@tanstack/react-router'
import { useEffect, useRef } from 'react'

import { MainLayout } from '../layouts/main'

export const Route = createRootRoute({
  component: () => {
    const pathname = useScrollMemory()

    return (
      <>
        <MainLayout>
          {/*
            Keyed on the path so each page plays the short entrance in
            `globals.css` (`.page-enter`) once, the way a Windows app fades a
            new page in rather than swapping it under the cursor.
          */}
          <div className="page-enter flex flex-col gap-4 lg:gap-6" key={pathname}>
            <Outlet />
          </div>
        </MainLayout>
      </>
    )
  },
})

/** Scroll offsets by history entry, so Back returns to where you were. */
const offsets = new Map<string, number>()
const maxOffsets = 100

/**
 * A new page opens at the top; Back and Forward land where you left it, as
 * Explorer and Settings do. The scroller is the content pane, not the
 * window, so the router's own restoration never saw it.
 *
 * Pages that load their data a beat later are not tall enough to restore
 * into on the first frame, so the restore retries briefly until they are.
 */
function useScrollMemory() {
  const location = useRouterState({ select: (state) => state.location })
  const key = (location.state as { key?: string } | undefined)?.key ?? location.href
  const $main = useRef<HTMLElement | null>(null)
  // Set during render, so it already names the next entry when the old
  // page's removal clamps the offset and fires one last scroll event.
  const $liveKey = useRef(key)
  $liveKey.current = key

  const scroller = () => {
    $main.current ??= document.querySelector<HTMLElement>('.main-wrapper-content')

    return $main.current
  }

  /*
   * Track the offset as it changes rather than reading it on the way out: by
   * the time an effect cleanup runs, the old page is already gone and the
   * browser has clamped the offset to the new, shorter one.
   */
  useEffect(() => {
    const element = scroller()
    if (!element) return

    const remember = () => {
      if ($liveKey.current !== key) return
      offsets.delete(key)
      offsets.set(key, element.scrollTop)
      if (offsets.size > maxOffsets) {
        offsets.delete(offsets.keys().next().value as string)
      }
    }
    element.addEventListener('scroll', remember, { passive: true })

    return () => element.removeEventListener('scroll', remember)
  }, [key])

  useEffect(() => {
    const element = scroller()
    if (!element) return

    const target = offsets.get(key) ?? 0
    element.scrollTo({ behavior: 'instant', top: target })
    if (target === 0) return

    let frame = 0
    const started = performance.now()
    const settle = () => {
      if (element.scrollTop >= target - 1) return
      element.scrollTo({ behavior: 'instant', top: target })
      if (performance.now() - started < 800) frame = requestAnimationFrame(settle)
    }
    frame = requestAnimationFrame(settle)

    // A wheel or key press means the user has taken over; stop chasing.
    const stop = () => cancelAnimationFrame(frame)
    element.addEventListener('wheel', stop, { once: true, passive: true })
    element.addEventListener('keydown', stop, { once: true })

    return () => {
      cancelAnimationFrame(frame)
      element.removeEventListener('wheel', stop)
      element.removeEventListener('keydown', stop)
    }
  }, [key])

  return location.pathname
}
