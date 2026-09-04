import { useEffect, useMemo } from 'react'
import { createDeferredCommit } from '../../lib/navigation/deferred-commit'

/** Save the final edit on blur or navigation, as well as after the delay. */
export function useDeferredCommit<T>(
  commit: (value: T) => void,
  delay: number,
) {
  const pending = useMemo(() => createDeferredCommit<T>(delay), [delay])
  useEffect(() => () => pending.flush(), [pending])
  return {
    schedule: (value: T) => pending.schedule(value, commit),
    flush: pending.flush,
  }
}
