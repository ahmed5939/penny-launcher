import { useEffect, useRef, useState } from 'react'

const DURATION_MS = 1200

/**
 * A figure that eases up from the last value it showed to the new one.
 *
 * Brought over from the Penny database site's `StatCard`. It always settles
 * on the exact target — the final frame sets it directly and a timer
 * guarantees it even when `requestAnimationFrame` is starved in a hidden
 * window — and it does nothing at all under `prefers-reduced-motion`.
 *
 * Use it on a headline number the page is proud of, not on every count.
 */
export function AnimatedNumber({ format = (n) => n.toLocaleString(), value }: { format?: (n: number) => string; value: number }) {
  const target = Number.isFinite(value) ? value : 0
  const [display, setDisplay] = useState(target)
  const shown = useRef(target)
  shown.current = display

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(target)
      return
    }
    const from = shown.current
    if (from === target) return
    const decimals = Math.min(2, (String(target).split('.')[1] ?? '').length)
    const factor = 10 ** decimals
    let raf = 0
    let startedAt: number | null = null
    const tick = (now: number) => {
      if (startedAt === null) startedAt = now
      const t = Math.min(1, (now - startedAt) / DURATION_MS)
      if (t >= 1) {
        setDisplay(target)
        return
      }
      const eased = 1 - (1 - t) ** 3
      setDisplay(Math.round((from + (target - from) * eased) * factor) / factor)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const settle = window.setTimeout(() => {
      cancelAnimationFrame(raf)
      setDisplay(target)
    }, DURATION_MS + 200)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(settle)
    }
  }, [target])

  return <>{format(display)}</>
}
