import { useCallback, useLayoutEffect, useRef } from 'react'

/**
 * A callback whose identity never changes but whose body is always the latest
 * render's.
 *
 * The point is memoised children. A vault shelf is hundreds of `memo`'d
 * tiles, and a handler recreated every render defeats every one of them —
 * ticking a single tile would re-render the lot. The handlers this wraps read
 * state that changes on every click, so `useCallback` with honest
 * dependencies cannot help; a ref swapped in the commit phase can.
 *
 * React's own `useEffectEvent` is this, still unstable at the time of
 * writing. Do not call the result during render.
 */
export function useStableCallback<
  Callback extends (...args: Array<never>) => unknown,
>(callback: Callback): Callback {
  const $callback = useRef(callback)

  useLayoutEffect(() => {
    $callback.current = callback
  })

  return useCallback(
    ((...args: Parameters<Callback>) =>
      $callback.current(...args)) as Callback,
    []
  )
}
