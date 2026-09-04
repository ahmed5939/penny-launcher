/** Keep the callback with the edit, so a later render cannot change its owner. */
export function createDeferredCommit<T>(delay: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: { value: T; commit: (value: T) => void } | undefined
  const flush = () => {
    clearTimeout(timer)
    timer = undefined
    const current = pending
    pending = undefined
    current?.commit(current.value)
  }
  return {
    flush,
    schedule: (value: T, commit: (value: T) => void) => {
      clearTimeout(timer)
      pending = { value, commit }
      timer = setTimeout(flush, delay)
    },
  }
}
