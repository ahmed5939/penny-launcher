import type { Backdrop } from '../../config/backdrops'

import { useEffect } from 'react'

import { backdropFor } from '../../config/backdrops'
import { useBackdropStore } from '../../state/ui/backdrop'

/**
 * The key art behind a page's title row, chosen by route (see
 * `config/backdrops.ts`) unless the page picked its own. Home has its own
 * hero and gets none.
 */
export function PageBackdrop({ pathname }: { pathname: string }) {
  const override = useBackdropStore((state) => state.override)
  const backdrop = override ?? backdropFor(pathname)
  if (!backdrop) return null

  return (
    <div
      aria-hidden
      className="page-backdrop"
    >
      <img
        alt=""
        decoding="async"
        key={backdrop.src}
        src={backdrop.src}
        style={{ objectPosition: backdrop.position, opacity: backdrop.opacity }}
      />
    </div>
  )
}

/**
 * Swaps the page's art for one that depends on its data — Ventures shows
 * the account's season, not a fixed one. `null` keeps the route's art.
 */
export function usePageBackdrop(backdrop: Backdrop | null) {
  const setOverride = useBackdropStore((state) => state.setOverride)

  useEffect(() => {
    setOverride(backdrop)
  }, [backdrop, setOverride])

  useEffect(() => () => setOverride(null), [setOverride])
}
